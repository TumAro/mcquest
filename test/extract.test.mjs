// Drift gate for EXTRACT.md (T-01-14): keeps the prompt's embedded topic-slug
// list and example paper honest against topics.json, schema.json, and the
// real checker as they evolve. EXTRACT_MD lets this be pointed at a
// deliberately broken copy to prove the gate actually bites.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inferType } from '../scripts/lib/rules.mjs';

const extractPath = process.env.EXTRACT_MD ?? 'EXTRACT.md';
const markdown = readFileSync(extractPath, 'utf8');
const blocks = [...markdown.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));

test('EXTRACT.md has exactly two fenced json blocks', () => {
  assert.equal(blocks.length, 2);
});

const topicsJson = JSON.parse(readFileSync('topics.json', 'utf8'));
// Identified by content, not position, so reordering the sections in
// EXTRACT.md doesn't break the test.
const topicsBlock = blocks.find((b) => b !== null && typeof b === 'object' && '_note' in b);
const paperBlock = blocks.find((b) => b !== null && typeof b === 'object' && Array.isArray(b.questions));

test('the topic-slug block is byte-equal in content to topics.json', () => {
  assert.ok(topicsBlock, 'no fenced json block in EXTRACT.md looks like topics.json (no "_note" key)');
  assert.deepEqual(topicsBlock, topicsJson);
});

test('the example paper has no id field on any question', () => {
  assert.ok(paperBlock, 'no fenced json block in EXTRACT.md looks like a paper (no "questions" array)');
  for (const q of paperBlock.questions) {
    assert.equal('id' in q, false, `question has an id field it should not: ${JSON.stringify(q)}`);
  }
});

test('the example paper passes the real checker with no errors and no unsorted questions', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'extract-test-'));
  const examDir = join(tmpRoot, paperBlock.exam);
  mkdirSync(examDir, { recursive: true });
  const paperPath = join(examDir, `${paperBlock.year}.json`);
  writeFileSync(paperPath, JSON.stringify(paperBlock, null, 2));

  let output;
  assert.doesNotThrow(() => {
    output = execFileSync(process.execPath, ['scripts/check.mjs', tmpRoot], { encoding: 'utf8' });
  }, 'the example paper failed the real checker');

  assert.match(output, /0 error\(s\)/);
  assert.match(output, /0 unsorted/);
  assert.doesNotMatch(output, /unknown topic slug/);

  // Re-read the stamped file: assignIds writes ids back, so this also
  // proves the checker accepted the file well enough to stamp it.
  const stamped = JSON.parse(readFileSync(paperPath, 'utf8'));
  const types = stamped.questions.map((q) => inferType(q));
  assert.deepEqual(types, ['single', 'multi', 'multi', 'numeric']);

  const explicitSingleCorrectMsq = stamped.questions.filter(
    (q) => q.type === 'multi' && Array.isArray(q.correct) && q.correct.length === 1
  );
  assert.equal(explicitSingleCorrectMsq.length, 1);
});
