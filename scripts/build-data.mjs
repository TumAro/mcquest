#!/usr/bin/env node
// The second script entry point, owning all of its own filesystem, argv, and
// stdout work — mirrors check.mjs's shape. Does not re-validate papers
// against the schema; `npm run check` owns that, and a second validator
// would be a second thing to keep in step.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferType, slugify } from './lib/rules.mjs';
import { discoverPapers } from './check.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function main() {
  const args = process.argv.slice(2);
  const bankRoot = resolve(args[0] ?? 'sources');
  const outDir = resolve(args[1] ?? 'public/data');

  const topicsRaw = JSON.parse(readFileSync(join(__dirname, '..', 'topics.json'), 'utf8'));
  const topics = Object.fromEntries(Object.entries(topicsRaw).filter(([key]) => !key.startsWith('_')));

  // Group papers by their exam folder name (the display label, per the
  // "folder name is the display label" rule) — same walk the checker uses,
  // so a file the checker validates can never be a file the builder skips.
  const byLabel = new Map();
  for (const path of discoverPapers(bankRoot)) {
    const label = basename(dirname(path));
    const year = parseInt(basename(path, '.json'), 10);
    const paper = JSON.parse(readFileSync(path, 'utf8'));
    const years = byLabel.get(label) ?? [];
    years.push({ year, paper });
    byLabel.set(label, years);
  }

  const labels = [...byLabel.keys()].sort((a, b) => slugify(a).localeCompare(slugify(b)));

  const exams = [];
  let paperCount = 0;

  for (const label of labels) {
    const slug = slugify(label);
    const years = [...byLabel.get(label)].sort((a, b) => a.year - b.year);
    const yearsIndex = [];

    for (const { year, paper } of years) {
      // Stamp every question with the exam's display label so a mixed-exam
      // random test can score each question under its own rules.
      const stampedPaper = {
        ...paper,
        questions: paper.questions.map((q) => ({ ...q, exam: label })),
      };

      const paperDir = join(outDir, slug);
      mkdirSync(paperDir, { recursive: true });
      const paperPath = join(paperDir, `${year}.json`);
      writeFileSync(paperPath, `${JSON.stringify(stampedPaper, null, 2)}\n`);
      paperCount += 1;
      console.log(`${paperPath}: ${stampedPaper.questions.length} questions`);

      yearsIndex.push({
        year,
        count: stampedPaper.questions.length,
        questions: stampedPaper.questions.map((q) => ({ id: q.id, topic: q.topic, type: inferType(q) })),
      });
    }

    exams.push({ label, slug, years: yearsIndex });
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.json'), `${JSON.stringify({ topics, exams }, null, 2)}\n`);

  console.log(`build:data: ${paperCount} paper(s), ${exams.length} exam(s) -> ${outDir}`);
}

main();
