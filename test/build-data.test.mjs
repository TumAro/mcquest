// Coverage for scripts/build-data.mjs's emitted output (T-02-12, T-02-15):
// the real builder run as a child process against a temp bank, read back
// from a temp output directory. Mirrors test/extract.test.mjs's shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inferType } from '../scripts/lib/rules.mjs';

function writePaper(bankRoot, exam, year, questions) {
  const dir = join(bankRoot, exam);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${year}.json`), JSON.stringify({ exam, year, questions }, null, 2));
}

function runBuild(bankRoot, outDir) {
  execFileSync(process.execPath, ['scripts/build-data.mjs', bankRoot, outDir], { encoding: 'utf8' });
}

// "Zeta Exam" is created before "Alpha Exam" so the sort-order assertion
// below actually proves slug-order rather than folder-creation order.
function buildTwoExamBank() {
  const bankRoot = mkdtempSync(join(tmpdir(), 'build-data-bank-'));
  writePaper(bankRoot, 'Zeta Exam', 2024, [
    {
      id: 'zeta-2024-1',
      marks: 1,
      topic: 'limit', // real slug
      question: 'Q',
      answer: { min: 0.99, max: 1.01 }, // numeric
      note: 'n',
    },
  ]);
  writePaper(bankRoot, 'Alpha Exam', 2024, [
    {
      id: 'alpha-2024-1',
      marks: 1,
      topic: 'eigen', // real slug
      question: 'Q',
      options: ['a', 'b'],
      correct: [0], // single
      answer: null,
      note: 'n',
    },
    {
      id: 'alpha-2024-2',
      marks: 2,
      topic: 'not-a-real-slug', // invented
      question: 'Q',
      options: ['a', 'b', 'c'],
      correct: [0, 1], // multi
      answer: null,
      note: 'n',
    },
  ]);
  return bankRoot;
}

const bankRoot = buildTwoExamBank();
const outDir = mkdtempSync(join(tmpdir(), 'build-data-out-'));
runBuild(bankRoot, outDir);
const index = JSON.parse(readFileSync(join(outDir, 'index.json'), 'utf8'));

const topicsJson = JSON.parse(readFileSync('topics.json', 'utf8'));

test('index.json carries the real subjects from topics.json, with the metadata key stripped', () => {
  for (const key of Object.keys(topicsJson)) {
    if (key.startsWith('_')) continue;
    assert.deepEqual(index.topics[key], topicsJson[key]);
  }
  assert.equal('_note' in index.topics, false);
});

test('exams appear once per folder, keyed by slug order, with the folder name as the label', () => {
  assert.equal(index.exams.length, 2);
  assert.equal(index.exams[0].label, 'Alpha Exam');
  assert.equal(index.exams[0].slug, 'alpha-exam');
  assert.equal(index.exams[1].label, 'Zeta Exam');
  assert.equal(index.exams[1].slug, 'zeta-exam');
});

test('each year entry counts its own questions', () => {
  assert.equal(index.exams[0].years[0].count, 2);
  assert.equal(index.exams[1].years[0].count, 1);
});

test('question entries carry exactly id, topic and type, nothing else', () => {
  for (const exam of index.exams) {
    for (const year of exam.years) {
      for (const q of year.questions) {
        assert.deepEqual(Object.keys(q).sort(), ['id', 'topic', 'type']);
      }
    }
  }
});

test('the inferred type on each entry matches inferType', () => {
  const alphaQuestions = index.exams[0].years[0].questions;
  assert.equal(alphaQuestions[0].type, 'single');
  assert.equal(alphaQuestions[1].type, 'multi');
  assert.equal(index.exams[1].years[0].questions[0].type, 'numeric');
});

test('an invented topic slug buckets as unsorted rather than vanishing or leaking through', () => {
  const alphaQuestions = index.exams[0].years[0].questions;
  assert.equal(alphaQuestions[0].topic, 'eigen');
  assert.equal(alphaQuestions[1].topic, 'unsorted');
  assert.equal(index.exams[1].years[0].questions[0].topic, 'limit');
});

test('the topics map gains an unsorted subject when at least one question is unsorted', () => {
  assert.ok('unsorted' in index.topics);
  assert.deepEqual(index.topics.unsorted, { label: 'Unsorted', topics: { unsorted: 'Unsorted' } });
});

test('a bank whose slugs all resolve leaves no unsorted subject in the map', () => {
  const cleanBank = mkdtempSync(join(tmpdir(), 'build-data-clean-bank-'));
  writePaper(cleanBank, 'Clean Exam', 2024, [
    {
      id: 'clean-2024-1',
      marks: 1,
      topic: 'eigen',
      question: 'Q',
      options: ['a', 'b'],
      correct: [0],
      answer: null,
      note: 'n',
    },
  ]);
  const cleanOut = mkdtempSync(join(tmpdir(), 'build-data-clean-out-'));
  runBuild(cleanBank, cleanOut);
  const cleanIndex = JSON.parse(readFileSync(join(cleanOut, 'index.json'), 'utf8'));
  assert.equal('unsorted' in cleanIndex.topics, false);
});

test('one per-paper file exists per exam-year, carrying the full questions with options and notes', () => {
  const alphaPaper = JSON.parse(readFileSync(join(outDir, 'alpha-exam', '2024.json'), 'utf8'));
  assert.equal(alphaPaper.questions.length, 2);
  assert.ok(Array.isArray(alphaPaper.questions[0].options));
  assert.equal(alphaPaper.questions[0].note, 'n');

  const zetaPaper = JSON.parse(readFileSync(join(outDir, 'zeta-exam', '2024.json'), 'utf8'));
  assert.equal(zetaPaper.questions.length, 1);
  assert.deepEqual(zetaPaper.questions[0].answer, { min: 0.99, max: 1.01 });
});

test('every question in a per-paper file carries the exam label', () => {
  const alphaPaper = JSON.parse(readFileSync(join(outDir, 'alpha-exam', '2024.json'), 'utf8'));
  for (const q of alphaPaper.questions) {
    assert.equal(q.exam, 'Alpha Exam');
  }
  const zetaPaper = JSON.parse(readFileSync(join(outDir, 'zeta-exam', '2024.json'), 'utf8'));
  for (const q of zetaPaper.questions) {
    assert.equal(q.exam, 'Zeta Exam');
  }
});

test('the per-paper file type matches inferType, same as the index', () => {
  const alphaPaper = JSON.parse(readFileSync(join(outDir, 'alpha-exam', '2024.json'), 'utf8'));
  assert.equal(inferType(alphaPaper.questions[0]), 'single');
  assert.equal(inferType(alphaPaper.questions[1]), 'multi');
});

test('two runs over an unchanged bank produce byte-identical index.json', () => {
  const rerunOut = mkdtempSync(join(tmpdir(), 'build-data-rerun-'));
  runBuild(bankRoot, rerunOut);
  const rerunRaw = readFileSync(join(rerunOut, 'index.json'), 'utf8');
  const firstRaw = readFileSync(join(outDir, 'index.json'), 'utf8');
  assert.equal(rerunRaw, firstRaw);
});
