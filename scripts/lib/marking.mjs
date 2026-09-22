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
 * All-or-nothing single-correct: the set of selected indices must equal the
 * set of correct indices exactly. Built on Sets so a duplicated index in the
 * response can never masquerade as a longer, differently-shaped selection.
 */
function isCorrectSingle(question, response) {
  const responseSet = new Set(response);
  const correctSet = new Set(question.correct);
  if (responseSet.size !== correctSet.size) return false;
  for (const idx of responseSet) {
    if (!correctSet.has(idx)) return false;
  }
  return true;
}

/**
 * Score one question against one response. Returns `{ status, score }` where
 * `status` is one of `correct`, `wrong`, `unattempted`. A `response` of
 * `null`, `undefined`, or an empty array is unattempted and scores zero,
 * deducting nothing. For an option-based question (single or multi) the
 * response must be an array of option indices; anything else throws, naming
 * the question, rather than being silently reinterpreted. Only the `single`
 * correctness predicate is implemented here — `multi` and `numeric` slot in
 * later without changing anything above them.
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
  if (type === 'single') {
    correct = isCorrectSingle(question, response);
  } else {
    throw new Error(`question ${question.id}: scoring for type "${type}" is not implemented yet`);
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
