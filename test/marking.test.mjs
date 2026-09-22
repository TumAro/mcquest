import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findRule, scoreQuestion, validateExamRules } from '../scripts/lib/marking.mjs';

const realExamConfig = JSON.parse(readFileSync(new URL('../exams.json', import.meta.url), 'utf8'));

// --- findRule ---

test('findRule: unknown exam falls back to default', () => {
  assert.equal(findRule(realExamConfig, 'SAMPLE', 'single', 1), 0);
});

test('findRule: exam matching is case- and spacing-insensitive via slugify', () => {
  assert.equal(findRule(realExamConfig, 'gate ma', 'single', 1), -1 / 3);
});

test('findRule: fraction strings parse to their exact quotient', () => {
  assert.equal(findRule(realExamConfig, 'IIT JAM', 'single', 2), -2 / 3);
});

test('findRule: plain-number deduction is read as-is', () => {
  assert.equal(findRule(realExamConfig, 'CSIR NET', 'single', 3), -0.75);
});

test('findRule: known exam with no deduction for the marks value returns null', () => {
  assert.equal(findRule(realExamConfig, 'GATE MA', 'single', 7), null);
});

// --- scoreQuestion ---

const gateQuestion = {
  id: 'gate-ma-2024-1',
  exam: 'GATE MA',
  marks: 1,
  topic: 'eigen',
  question: 'Q',
  options: ['a', 'b', 'c', 'd'],
  correct: [0],
  answer: null,
};

test('scoreQuestion: correct single-correct response scores +marks', () => {
  assert.deepEqual(scoreQuestion(realExamConfig, gateQuestion, [0]), { status: 'correct', score: 1 });
});

test('scoreQuestion: wrong single-correct 1-mark GATE MA response deducts exactly -1/3', () => {
  const result = scoreQuestion(realExamConfig, gateQuestion, [3]);
  assert.equal(result.status, 'wrong');
  assert.ok(Math.abs(result.score + 1 / 3) < 1e-12);
});

test('scoreQuestion: null, undefined, and empty-array responses are unattempted and score 0', () => {
  assert.deepEqual(scoreQuestion(realExamConfig, gateQuestion, null), { status: 'unattempted', score: 0 });
  assert.deepEqual(scoreQuestion(realExamConfig, gateQuestion, undefined), { status: 'unattempted', score: 0 });
  assert.deepEqual(scoreQuestion(realExamConfig, gateQuestion, []), { status: 'unattempted', score: 0 });
});

test('scoreQuestion: a duplicated index cannot masquerade as a longer selection', () => {
  const result = scoreQuestion(realExamConfig, gateQuestion, [0, 0]);
  assert.equal(result.status, 'correct');
});

test('scoreQuestion: non-array-of-numbers response throws, naming the question id', () => {
  assert.throws(() => scoreQuestion(realExamConfig, gateQuestion, 'a'), /gate-ma-2024-1/);
  assert.throws(() => scoreQuestion(realExamConfig, gateQuestion, ['a']), /gate-ma-2024-1/);
});

// --- validateExamRules (Task 2 behavior) ---

test('validateExamRules: the real repo exams.json is sound', () => {
  assert.deepEqual(validateExamRules(realExamConfig), []);
});

test('validateExamRules: a minimal sound config with only default returns no messages', () => {
  const config = { default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } } };
  assert.deepEqual(validateExamRules(config), []);
});

test('validateExamRules: config with no default entry returns one message', () => {
  const config = { 'GATE MA': { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } } };
  assert.equal(validateExamRules(config).length, 1);
});

test('validateExamRules: exam entry missing one question type returns one message naming exam and type', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': { single: { wrong: 0 }, multi: { wrong: 0 } },
  };
  const messages = validateExamRules(config);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /GATE MA/);
  assert.match(messages[0], /numeric/);
});

test('validateExamRules: unrecognised type key such as "singel" returns one message naming it', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': { singel: { wrong: 0 }, single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
  };
  const messages = validateExamRules(config);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /singel/);
});

test('validateExamRules: type entry with no wrong key returns one message', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': { single: {}, multi: { wrong: 0 }, numeric: { wrong: 0 } },
  };
  assert.equal(validateExamRules(config).length, 1);
});

test('validateExamRules: positive plain-number deduction returns one message', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': { single: { wrong: 0.75 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
  };
  assert.equal(validateExamRules(config).length, 1);
});

test('validateExamRules: positive deduction inside a marks-keyed map returns one message naming the marks value', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': { single: { wrong: { 1: '1/3' } }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
  };
  const messages = validateExamRules(config);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /1/);
});

test('validateExamRules: wrong value that is neither a number nor an a/b fraction string returns one message', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': { single: { wrong: 'abc' }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
  };
  assert.equal(validateExamRules(config).length, 1);
});

test('validateExamRules: boolean wrong value returns one message', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': { single: { wrong: true }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
  };
  assert.equal(validateExamRules(config).length, 1);
});

test('validateExamRules: exam entry that is not an object returns one message', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': 42,
  };
  assert.equal(validateExamRules(config).length, 1);
});

test('validateExamRules: underscore-prefixed keys are skipped and produce no messages', () => {
  const config = {
    _note: 'human note, not an exam',
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
  };
  assert.deepEqual(validateExamRules(config), []);
});

test('validateExamRules: sound marks-keyed map with fraction strings produces no messages', () => {
  const config = {
    default: { single: { wrong: 0 }, multi: { wrong: 0 }, numeric: { wrong: 0 } },
    'GATE MA': {
      single: { wrong: { 1: '-1/3', 2: '-2/3' } },
      multi: { wrong: 0 },
      numeric: { wrong: 0 },
    },
  };
  assert.deepEqual(validateExamRules(config), []);
});
