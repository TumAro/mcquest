// Pure marking engine. No fs, no console, no process — importable by the
// browser player (Phase 3) and the results screen (Phase 6) as-is, and
// unit-tested with no fixtures.

import { inferType, slugify } from './rules.mjs';

/**
 * Parse a `wrong` deduction value written as a plain number or an `a/b`
 * fraction string (e.g. "-1/3") into its exact numeric value. Returns `null`
 * when the value is neither — a non-finite number, an unparseable string, a
 * fraction with a zero denominator, or any other type (including booleans).
 */
function parseDeduction(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const m = /^(-?\d+)\/(-?\d+)$/.exec(value.trim());
    if (!m) return null;
    const denominator = parseInt(m[2], 10);
    if (denominator === 0) return null;
    return parseInt(m[1], 10) / denominator;
  }
  return null;
}

/**
 * Resolve the wrong-answer deduction for `(exam, type, marks)` against a
 * loaded `exams.json`. Matches `exam` against the config's keys by slug, so
 * odd spacing or casing in a folder name still resolves. Falls back to
 * `config.default` when no exam entry matches. Returns the deduction as a
 * number, or `null` when the exam entry exists but has nothing configured
 * for that marks value — a real authoring gap the caller decides how loudly
 * to report.
 */
export function findRule(config, exam, type, marks) {
  const targetSlug = slugify(exam);

  let entry = null;
  for (const key of Object.keys(config)) {
    if (key.startsWith('_') || key === 'default') continue;
    if (slugify(key) === targetSlug) {
      entry = config[key];
      break;
    }
  }
  if (!entry) entry = config.default;
  if (!entry) return null;

  const typeEntry = entry[type];
  if (!typeEntry || typeof typeEntry !== 'object') return null;

  const wrong = typeEntry.wrong;
  if (wrong && typeof wrong === 'object' && !Array.isArray(wrong)) {
    const marksKey = String(marks);
    if (!(marksKey in wrong)) return null;
    return parseDeduction(wrong[marksKey]);
  }
  return parseDeduction(wrong);
}

/**
 * All-or-nothing option-based correctness, shared by `single` and `multi`:
 * the set of selected indices must equal the set of correct indices exactly.
 * Built on Sets so a duplicated index in the response can never masquerade
 * as a longer, differently-shaped selection, and selection order never
 * matters. This is precisely what all-or-nothing means, so `single` and
 * `multi` differ only in their deduction, never in how correctness is
 * decided.
 */
function isCorrectOptionSet(question, response) {
  const responseSet = new Set(response);
  const correctSet = new Set(question.correct);
  if (responseSet.size !== correctSet.size) return false;
  for (const idx of responseSet) {
    if (!correctSet.has(idx)) return false;
  }
  return true;
}

/**
 * Numeric correctness: the response is correct when it falls inside the
 * normalized `{min, max}` bounds, inclusive at both ends. Throws, naming the
 * question id, when the response is not a finite number — a text value
 * arriving here is the most dangerous input in the project, since coerced,
 * an empty box becomes a zero that sits inside the accepted range of any
 * question whose answer is near zero. Throws, naming the question id, when
 * `answer` is not an object carrying two finite bounds — an unnormalized
 * bank question would otherwise compare against an undefined bound and mark
 * every response wrong while deducting nothing, invisibly.
 */
function isCorrectNumeric(question, response) {
  if (typeof response !== 'number' || !Number.isFinite(response)) {
    throw new Error(
      `question ${question.id}: expected a finite number response, got ${JSON.stringify(response)}`
    );
  }
  const answer = question.answer;
  if (
    !answer ||
    typeof answer !== 'object' ||
    Array.isArray(answer) ||
    !Number.isFinite(answer.min) ||
    !Number.isFinite(answer.max)
  ) {
    throw new Error(
      `question ${question.id}: numeric answer must be a normalized {min, max} object with finite bounds, got ${JSON.stringify(answer)}`
    );
  }
  return response >= answer.min && response <= answer.max;
}

/**
 * Score one question against one response. Returns `{ status, score }` where
 * `status` is one of `correct`, `wrong`, `unattempted`. A `response` of
 * `null`, `undefined`, or an empty array is unattempted and scores zero,
 * deducting nothing. For an option-based question (single or multi) the
 * response must be an array of option indices; anything else throws, naming
 * the question, rather than being silently reinterpreted. For a numeric
 * question the response must be a finite number and the question's `answer`
 * must already be normalized to `{min, max}`; either violation throws,
 * naming the question — see `isCorrectNumeric`.
 */
export function scoreQuestion(config, question, response) {
  const type = inferType(question);
  const marks = question.marks;

  const unattempted =
    response === null || response === undefined || (Array.isArray(response) && response.length === 0);
  if (unattempted) {
    return { status: 'unattempted', score: 0 };
  }

  const optionBased = type === 'single' || type === 'multi';
  if (optionBased && (!Array.isArray(response) || !response.every((x) => typeof x === 'number'))) {
    throw new Error(
      `question ${question.id}: expected an array of option indices, got ${JSON.stringify(response)}`
    );
  }

  let correct;
  if (optionBased) {
    correct = isCorrectOptionSet(question, response);
  } else if (type === 'numeric') {
    correct = isCorrectNumeric(question, response);
  } else {
    throw new Error(`question ${question.id}: unknown question type "${type}"`);
  }

  if (correct) {
    return { status: 'correct', score: marks };
  }

  const deduction = findRule(config, question.exam, type, marks);
  if (deduction === null) {
    throw new Error(
      `question ${question.id}: no wrong-answer rule for exam "${question.exam}", type "${type}", marks ${marks}`
    );
  }
  return { status: 'wrong', score: deduction };
}

/**
 * Score a full attempt: `responses` is a plain object keyed by question id
 * (the shape that survives a round trip through browser storage with no
 * conversion step). Calls `scoreQuestion` once per question, in order, and
 * folds the results — no rounding, since rounding for display is the
 * results screen's decision and a value rounded twice is a value rounded
 * wrongly. `max` sums every question's `marks`, including the unattempted
 * ones. `results` mirrors the question order so the review screen can walk
 * it against the questions without re-scoring.
 */
export function scoreAttempt(config, questions, responses) {
  let score = 0;
  let max = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  const results = [];

  for (const question of questions) {
    max += question.marks;
    const result = scoreQuestion(config, question, responses[question.id]);
    score += result.score;
    if (result.status === 'correct') correct += 1;
    else if (result.status === 'wrong') wrong += 1;
    else unattempted += 1;
    results.push({ id: question.id, status: result.status, score: result.score });
  }

  return { score, max, correct, wrong, unattempted, results };
}

const QUESTION_TYPES = ['single', 'multi', 'numeric'];

/**
 * Validate a loaded `exams.json`. Returns an array of message strings, empty
 * when the config is sound — the same contract `validateShape` uses in
 * `rules.mjs`. Each message is written to read as the tail of the sentence
 * `exams.json: <message>`; the caller supplies the prefix. Underscore-
 * prefixed keys (top-level notes, or a stray metadata key inside an entry)
 * are skipped, matching `indexTopics`.
 */
export function validateExamRules(config) {
  const messages = [];

  if (!('default' in config)) {
    messages.push('missing a "default" entry');
  }

  for (const [examKey, entry] of Object.entries(config)) {
    if (examKey.startsWith('_')) continue;

    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      messages.push(`"${examKey}" entry is not an object`);
      continue;
    }

    for (const type of QUESTION_TYPES) {
      if (!(type in entry)) {
        messages.push(`"${examKey}" is missing a "${type}" entry`);
      }
    }
    for (const typeKey of Object.keys(entry)) {
      if (typeKey.startsWith('_')) continue;
      if (!QUESTION_TYPES.includes(typeKey)) {
        messages.push(`"${examKey}" has an unrecognised question type "${typeKey}"`);
      }
    }

    for (const type of QUESTION_TYPES) {
      if (!(type in entry)) continue;
      const typeEntry = entry[type];
      if (typeEntry === null || typeof typeEntry !== 'object' || Array.isArray(typeEntry)) {
        messages.push(`"${examKey}" "${type}" entry is not an object`);
        continue;
      }
      if (!('wrong' in typeEntry)) {
        messages.push(`"${examKey}" "${type}" has no "wrong" key`);
        continue;
      }

      const wrong = typeEntry.wrong;
      if (wrong && typeof wrong === 'object' && !Array.isArray(wrong)) {
        for (const [marksKey, deduction] of Object.entries(wrong)) {
          const parsed = parseDeduction(deduction);
          if (parsed === null) {
            messages.push(
              `"${examKey}" "${type}" wrong["${marksKey}"] (${JSON.stringify(deduction)}) is not a number or an "a/b" fraction string`
            );
          } else if (parsed > 0) {
            messages.push(
              `"${examKey}" "${type}" wrong["${marksKey}"] (${JSON.stringify(deduction)}) is positive — a wrong answer must never add marks`
            );
          }
        }
      } else {
        const parsed = parseDeduction(wrong);
        if (parsed === null) {
          messages.push(
            `"${examKey}" "${type}" wrong (${JSON.stringify(wrong)}) is not a number or an "a/b" fraction string`
          );
        } else if (parsed > 0) {
          messages.push(
            `"${examKey}" "${type}" wrong (${JSON.stringify(wrong)}) is positive — a wrong answer must never add marks`
          );
        }
      }
    }
  }

  return messages;
}
