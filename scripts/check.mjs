#!/usr/bin/env node
// The only file in the checker that touches the filesystem, argv, or stdout.
// All validation logic lives in schema.json; all pure rules live in lib/rules.mjs.

import { readdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { assignIds, normalizeAnswer, needsMsqConfirm, validateShape } from './lib/rules.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(__dirname, '..', 'schema.json'), 'utf8'));

const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

// Discover every `sources/<EXAM>/<YEAR>.json` paper under a bank root.
// No registry file (D-01) — the exam directory name IS the display label.
function discoverPapers(root) {
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
function collectPaperPaths(targets) {
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
    const valid = validate(paper);
    if (!valid) {
      for (const err of validate.errors) {
        console.log(formatError(path, err));
        errors += 1;
      }
    } else {
      let changed = false;
      const msqPositions = [];

      paper.questions.forEach((q, i) => {
        const n = i + 1;

        for (const message of validateShape(q)) {
          console.log(`${path} q${n}: ${message}`);
          errors += 1;
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
    console.log(`${path}: ${questionCount} questions, ${errors} error(s), ${warnings} warning(s)`);
    totalErrors += errors;
    totalWarnings += warnings;
  }

  console.log(`check: ${paperPaths.length} file(s), ${totalErrors} error(s), ${totalWarnings} warning(s)`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
