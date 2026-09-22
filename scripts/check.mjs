#!/usr/bin/env node
// The only file in the checker that touches the filesystem, argv, or stdout.
// All validation logic lives in schema.json; all pure rules live in lib/rules.mjs.

import { readdirSync, readFileSync, writeFileSync, renameSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  assignIds,
  normalizeAnswer,
  needsMsqConfirm,
  validateShape,
  indexTopics,
  resolveTopic,
  suggestSlug,
  inferType,
  slugify,
} from './lib/rules.mjs';
import { validateExamRules, findRule } from './lib/marking.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(__dirname, '..', 'schema.json'), 'utf8'));

const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

// Loaded once per run, resolved relative to this script so the result does
// not depend on the caller's working directory (D-05).
const topics = JSON.parse(readFileSync(join(__dirname, '..', 'topics.json'), 'utf8'));
const { index: topicIndex, duplicates: topicDuplicates } = indexTopics(topics);
const knownTopicSlugs = Object.keys(topicIndex);

// exams.json is loaded lazily (not at module scope) so a missing or
// unparseable file is reported through the checker's own error count
// instead of crashing the process before main() gets to run. Returns the
// parsed config alongside the validateExamRules messages so main() reads
// the file exactly once and reuses the same config for the per-question
// rule audit below.
function loadExamConfig() {
  const examsPath = join(__dirname, '..', 'exams.json');
  let config;
  try {
    config = JSON.parse(readFileSync(examsPath, 'utf8'));
  } catch (err) {
    return { config: null, messages: [`exams.json: could not read or parse — ${err.message}`] };
  }
  return { config, messages: validateExamRules(config).map((message) => `exams.json: ${message}`) };
}

// The same slug-matching findRule uses to decide whether an exam has an
// entry of its own, so the "is this exam configured" question is answered
// identically in both places. Returns the matching config key, or `null`
// when the exam falls through to `default`.
function findConfiguredExamKey(config, examLabel) {
  const targetSlug = slugify(examLabel);
  for (const key of Object.keys(config)) {
    if (key.startsWith('_') || key === 'default') continue;
    if (slugify(key) === targetSlug) return key;
  }
  return null;
}

// Discover every `sources/<EXAM>/<YEAR>.json` paper under a bank root.
// No registry file (D-01) — the exam directory name IS the display label.
export function discoverPapers(root) {
  const papers = [];
  const examEntries = readdirSync(root, { withFileTypes: true });
  for (const examEntry of examEntries) {
    if (!examEntry.isDirectory()) continue;
    const examDir = join(root, examEntry.name);
    const entries = readdirSync(examDir, { withFileTypes: true });
    for (const entry of entries) {
      // Skips the `assets` directory (it's a directory) and any filename
      // that isn't a bare 4-digit year, without special-casing either.
      if (!entry.isFile()) continue;
      if (!/^\d{4}\.json$/.test(entry.name)) continue;
      papers.push(join(examDir, entry.name));
    }
  }
  return papers;
}

// argv are paths, defaulting to ["sources"]. A directory is scanned as a
// bank root; a .json path is checked directly. This is what lets tests and
// later plans point the checker at a temp directory.
export function collectPaperPaths(targets) {
  const paths = [];
  for (const target of targets) {
    const st = statSync(target, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) {
      paths.push(...discoverPapers(target));
    } else if (target.endsWith('.json')) {
      paths.push(target);
    }
  }
  return paths;
}

// `<path> q<N>: <message>` for a question-scoped error (BANK-07), where N is
// the 1-based question position recovered from `/questions/<i>/...`.
// Errors outside `/questions` print `<path>: <message>`.
function formatError(path, err) {
  const m = /^\/questions\/(\d+)(\/|$)/.exec(err.instancePath);
  if (m) {
    const n = parseInt(m[1], 10) + 1;
    return `${path} q${n}: ${err.message}`;
  }
  return `${path}: ${err.message}`;
}

// True when `original` (whatever shape the author wrote) is already the
// `{min, max}` (or null) that normalizeAnswer would produce, so a re-run
// over an already-normalized paper does not rewrite the file.
function answerAlreadyNormalized(original, normalized) {
  if (normalized === null) return original === null || original === undefined;
  if (original === null || typeof original !== 'object') return false;
  return original.min === normalized.min && original.max === normalized.max;
}

function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : ['sources'];
  const paperPaths = collectPaperPaths(targets);

  let totalErrors = 0;
  let totalWarnings = 0;

  // Ambiguous slugs are a property of topics.json itself, not of any one
  // paper — subject derivation is broken until they're fixed, so this
  // exits 1 regardless of which papers were checked.
  for (const dup of topicDuplicates) {
    console.log(`topics.json: topic slug "${dup.slug}" appears under both "${dup.subjects[0]}" and "${dup.subjects[1]}"`);
    totalErrors += 1;
  }

  // A typo in exams.json silently corrupts every score the author will ever
  // read, and the author runs this constantly — the gate belongs here, not
  // in the build step. A property of the config itself, so it's reported
  // once per run regardless of which papers were checked.
  const { config: examConfig, messages: examConfigMessages } = loadExamConfig();
  for (const message of examConfigMessages) {
    console.log(message);
    totalErrors += 1;
  }

  for (const path of paperPaths) {
    let paper;
    try {
      paper = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      console.log(`${path}: invalid JSON — ${err.message}`);
      totalErrors += 1;
      continue;
    }

    let errors = 0;
    let warnings = 0;
    let unsortedCount = 0;

    // The exam directory name is the display label (D-01) — the same name
    // build-data.mjs stamps onto every question and scoreQuestion later
    // reads, so this is what must be checked against exams.json, not the
    // paper's own `exam` field. Decided once per paper, independent of
    // whether the paper's contents pass schema validation below.
    const examLabel = basename(dirname(path));
    const examKey = examConfig ? findConfiguredExamKey(examConfig, examLabel) : null;
    if (examConfig && !examKey) {
      const configuredExams = Object.keys(examConfig).filter((k) => !k.startsWith('_') && k !== 'default');
      console.log(
        `${path}: exam "${examLabel}" has no entry in exams.json — scored with the default rules (no ` +
          `deduction for a wrong answer). Configured exams: ${configuredExams.join(', ') || '(none)'}`
      );
      warnings += 1;
    }

    const valid = validate(paper);
    if (!valid) {
      for (const err of validate.errors) {
        console.log(formatError(path, err));
        errors += 1;
      }
    } else {
      let changed = false;
      const msqPositions = [];
      const unknownTopics = new Map(); // slug -> positions that used it
      const examDir = dirname(path);
      const assetsDir = join(examDir, 'assets', String(paper.year));
      const resolvedAssetsDir = resolve(assetsDir);

      paper.questions.forEach((q, i) => {
        const n = i + 1;

        for (const message of validateShape(q)) {
          console.log(`${path} q${n}: ${message}`);
          errors += 1;
        }

        // MARK-01: a configured exam is a promise that every marks value it
        // actually uses can be scored. A gap found here is a typo the
        // author fixes in seconds; the same gap found by scoreQuestion at
        // submit time is a crash in the middle of a mock. Only checked for
        // an exam that has an entry of its own — an unconfigured exam
        // already got its one warning above and falls through to `default`.
        if (examConfig && examKey) {
          const type = inferType(q);
          const marks = q.marks;
          if (findRule(examConfig, examLabel, type, marks) === null) {
            console.log(
              `${path} q${n}: exam "${examLabel}" is configured but has no wrong-answer rule for type ` +
                `"${type}" marks ${marks} — add "${examKey}"."${type}".wrong["${marks}"] to exams.json`
            );
            errors += 1;
          }
        }

        // Subject is derived from the topic slug alone (D-05) — an unknown
        // slug never fails the run (D-07, AUTH-03), it's grouped below and
        // the question counts as unsorted until the author fixes the slug.
        if (!resolveTopic(q.topic, topicIndex)) {
          unsortedCount += 1;
          const positions = unknownTopics.get(q.topic) ?? [];
          positions.push(n);
          unknownTopics.set(q.topic, positions);
        }

        // BANK-06: a referenced image absent from disk is a warning, never
        // an error. The schema already restricts `image` to a bare
        // filename (T-01-09); this re-asserts the resolved path is still
        // inside the assets directory before any filesystem call.
        if (q.image) {
          const resolvedImagePath = resolve(join(assetsDir, q.image));
          const insideAssets =
            resolvedImagePath === resolvedAssetsDir || resolvedImagePath.startsWith(resolvedAssetsDir + sep);
          if (!insideAssets) {
            console.log(`${path} q${n}: image "${q.image}" resolves outside assets/${paper.year}/ — refusing to check`);
            errors += 1;
          } else if (!existsSync(resolvedImagePath)) {
            console.log(`${path} q${n}: image "${q.image}" not found in assets/${paper.year}/`);
            warnings += 1;
          }
        }

        // Only touch the `answer` key when it's already present (AUTH-02) —
        // a question with no answer key keeps having no answer key.
        if ('answer' in q) {
          const normalized = normalizeAnswer(q.answer);
          if (!answerAlreadyNormalized(q.answer, normalized)) {
            q.answer = normalized;
            changed = true;
          }
        }

        if (needsMsqConfirm(q)) {
          msqPositions.push(n);
        }
      });

      if (msqPositions.length > 0) {
        const list = msqPositions.map((n) => `q${n}`).join(', ');
        console.log(
          `${path}: ${msqPositions.length} single-correct question(s) with options — confirm not MSQ: ${list}`
        );
        warnings += 1;
      }

      // Grouped by slug (D-07): one invented slug typically lands on a
      // dozen questions at once, and one line naming all of them beats a
      // dozen identical lines.
      for (const [slug, positions] of unknownTopics) {
        const list = positions.map((n) => `q${n}`).join(', ');
        const suggestion = suggestSlug(slug, knownTopicSlugs);
        const suffix = suggestion ? ` — did you mean "${suggestion}"?` : '';
        console.log(`${path}: unknown topic slug "${slug}" (${list})${suffix} counted as unsorted`);
        warnings += 1;
      }

      const assigned = assignIds(paper);
      if (assigned > 0) changed = true;

      if (changed) {
        const serialized = `${JSON.stringify(paper, null, 2)}\n`;
        const tmpPath = `${path}.tmp`;
        writeFileSync(tmpPath, serialized);
        renameSync(tmpPath, path);
      }
    }

    const questionCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
    console.log(
      `${path}: ${questionCount} questions, ${errors} error(s), ${warnings} warning(s), ${unsortedCount} unsorted`
    );
    totalErrors += errors;
    totalWarnings += warnings;
  }

  console.log(`check: ${paperPaths.length} file(s), ${totalErrors} error(s), ${totalWarnings} warning(s)`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

// Only run when invoked directly (`node scripts/check.mjs`), not when
// imported — `build-data.mjs` imports `discoverPapers` from this module and
// must not trigger a full check run as a side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
