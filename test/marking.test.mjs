import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findRule, scoreQuestion, validateExamRules } from '../scripts/lib/marking.mjs';

const realExamConfig = JSON.parse(readFileSync(new URL('../exams.json', import.meta.url), 'utf8'));

// A third of a mark has no exact binary representation — compare fractional
// scores with an explicit tolerance rather than strict equality.
function approxEqual(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

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

// --- scoreQuestion: the full marking table, every exam and every type ---
//
// Each row is scored twice against the real repo exams.json: once with a
// correct response, once with a wrong one. GATE MA and IIT JAM share the
// same single-correct deductions; CSIR NET and the no-entry default case
// each get their own dedicated coverage.

const matrix = [
  {
    name: 'GATE MA single 1 mark',
    question: { id: 'm-1', exam: 'GATE MA', marks: 1, correct: [0] },
    correctResponse: [0],
    wrongResponse: [1],
    correctScore: 1,
    wrongScore: -1 / 3,
  },
  {
    name: 'GATE MA single 2 marks',
    question: { id: 'm-2', exam: 'GATE MA', marks: 2, correct: [0] },
    correctResponse: [0],
    wrongResponse: [1],
    correctScore: 2,
    wrongScore: -2 / 3,
  },
  {
    name: 'GATE MA multi 2 marks',
    question: { id: 'm-3', exam: 'GATE MA', marks: 2, correct: [0, 2] },
    correctResponse: [0, 2],
    wrongResponse: [0],
    correctScore: 2,
    wrongScore: 0,
  },
  {
    name: 'GATE MA numeric 2 marks',
    question: { id: 'm-4', exam: 'GATE MA', marks: 2, answer: { min: 0.99, max: 1.01 } },
    correctResponse: 1,
    wrongResponse: 5,
    correctScore: 2,
    wrongScore: 0,
  },
  {
    name: 'IIT JAM single 1 mark',
    question: { id: 'm-5', exam: 'IIT JAM', marks: 1, correct: [0] },
    correctResponse: [0],
    wrongResponse: [1],
    correctScore: 1,
    wrongScore: -1 / 3,
  },
  {
    name: 'IIT JAM single 2 marks',
    question: { id: 'm-6', exam: 'IIT JAM', marks: 2, correct: [0] },
    correctResponse: [0],
    wrongResponse: [1],
    correctScore: 2,
    wrongScore: -2 / 3,
  },
  {
    name: 'IIT JAM multi 2 marks',
    question: { id: 'm-7', exam: 'IIT JAM', marks: 2, correct: [0, 2] },
    correctResponse: [0, 2],
    wrongResponse: [0],
    correctScore: 2,
    wrongScore: 0,
  },
  {
    name: 'IIT JAM numeric 1 mark',
    question: { id: 'm-8', exam: 'IIT JAM', marks: 1, answer: { min: 0.99, max: 1.01 } },
    correctResponse: 1,
    wrongResponse: 5,
    correctScore: 1,
    wrongScore: 0,
  },
  {
    name: 'IIT JAM numeric 2 marks',
    question: { id: 'm-9', exam: 'IIT JAM', marks: 2, answer: { min: 0.99, max: 1.01 } },
    correctResponse: 1,
    wrongResponse: 5,
    correctScore: 2,
    wrongScore: 0,
  },
  {
    name: 'CSIR NET single 3 marks',
    question: { id: 'm-10', exam: 'CSIR NET', marks: 3, correct: [0] },
    correctResponse: [0],
    wrongResponse: [1],
    correctScore: 3,
    wrongScore: -0.75,
  },
  {
    name: 'CSIR NET multi 4.75 marks',
    question: { id: 'm-11', exam: 'CSIR NET', marks: 4.75, correct: [0, 2] },
    correctResponse: [0, 2],
    wrongResponse: [0],
    correctScore: 4.75,
    wrongScore: 0,
  },
  {
    name: 'exam absent from exams.json falls back to default (plus marks, zero wrong)',
    question: { id: 'm-12', exam: 'SAMPLE', marks: 1, correct: [0] },
    correctResponse: [0],
    wrongResponse: [1],
    correctScore: 1,
    wrongScore: 0,
  },
];

for (const row of matrix) {
  test(`scoreQuestion: ${row.name} — correct scores +${row.correctScore}`, () => {
    const result = scoreQuestion(realExamConfig, row.question, row.correctResponse);
    assert.equal(result.status, 'correct');
    approxEqual(result.score, row.correctScore);
  });

  test(`scoreQuestion: ${row.name} — wrong scores ${row.wrongScore}`, () => {
    const result = scoreQuestion(realExamConfig, row.question, row.wrongResponse);
    assert.equal(result.status, 'wrong');
    approxEqual(result.score, row.wrongScore);
  });
}

// --- scoreQuestion: all-or-nothing credit ---

const multiQuestion = { id: 'multi-1', exam: 'GATE MA', marks: 2, correct: [0, 2] };

test('scoreQuestion: multi-select — every correct option selected, none incorrect, is correct', () => {
  assert.equal(scoreQuestion(realExamConfig, multiQuestion, [0, 2]).status, 'correct');
});

test('scoreQuestion: multi-select — selection order is not part of the answer', () => {
  assert.equal(scoreQuestion(realExamConfig, multiQuestion, [2, 0]).status, 'correct');
});

test('scoreQuestion: multi-select — a subset scores what any wrong answer scores, not half marks', () => {
  const result = scoreQuestion(realExamConfig, multiQuestion, [0]);
  assert.equal(result.status, 'wrong');
  assert.equal(result.score, 0);
});

test('scoreQuestion: multi-select — a superset earns nothing', () => {
  assert.equal(scoreQuestion(realExamConfig, multiQuestion, [0, 1, 2]).status, 'wrong');
});

test('scoreQuestion: multi-select — a repeated index cannot pass for a second selection', () => {
  assert.equal(scoreQuestion(realExamConfig, multiQuestion, [0, 0]).status, 'wrong');
});

test('scoreQuestion: multi-select — an unrelated set is wrong', () => {
  assert.equal(scoreQuestion(realExamConfig, multiQuestion, [1, 3]).status, 'wrong');
});

const explicitSingleCorrectMsq = {
  id: 'msq-single-1',
  exam: 'GATE MA',
  marks: 2,
  type: 'multi',
  correct: [0],
};

test('scoreQuestion: an explicit type "multi" with one correct index scores +marks for that index alone', () => {
  const result = scoreQuestion(realExamConfig, explicitSingleCorrectMsq, [0]);
  assert.equal(result.status, 'correct');
  assert.equal(result.score, 2);
});

test('scoreQuestion: an explicit type "multi" with one correct index scores nothing for an extra selection', () => {
  const result = scoreQuestion(realExamConfig, explicitSingleCorrectMsq, [0, 1]);
  assert.equal(result.status, 'wrong');
  assert.equal(result.score, 0);
});

// --- scoreQuestion: numeric tolerance, inclusive at both ends ---

const numericQuestion = { id: 'num-1', exam: 'GATE MA', marks: 1, answer: { min: 0.99, max: 1.01 } };

test('scoreQuestion: numeric — a value inside the range is correct', () => {
  assert.equal(scoreQuestion(realExamConfig, numericQuestion, 1).status, 'correct');
});

test('scoreQuestion: numeric — the lower bound is correct (inclusive)', () => {
  assert.equal(scoreQuestion(realExamConfig, numericQuestion, 0.99).status, 'correct');
});

test('scoreQuestion: numeric — the upper bound is correct (inclusive)', () => {
  assert.equal(scoreQuestion(realExamConfig, numericQuestion, 1.01).status, 'correct');
});

test('scoreQuestion: numeric — just below the lower bound is wrong', () => {
  assert.equal(scoreQuestion(realExamConfig, numericQuestion, 0.989).status, 'wrong');
});

test('scoreQuestion: numeric — just above the upper bound is wrong', () => {
  assert.equal(scoreQuestion(realExamConfig, numericQuestion, 1.011).status, 'wrong');
});

test('scoreQuestion: numeric — a range straddling zero accepts zero', () => {
  const q = { id: 'num-2', exam: 'GATE MA', marks: 1, answer: { min: -0.01, max: 0.01 } };
  assert.equal(scoreQuestion(realExamConfig, q, 0).status, 'correct');
});

// --- scoreQuestion: unattempted, in an exam whose type carries a penalty ---

const unattemptedCases = [
  { name: 'GATE 2-mark single', question: { id: 'u-1', exam: 'GATE MA', marks: 2, correct: [0] } },
  { name: 'CSIR 3-mark single', question: { id: 'u-2', exam: 'CSIR NET', marks: 3, correct: [0] } },
  { name: 'CSIR 4.75-mark multi', question: { id: 'u-3', exam: 'CSIR NET', marks: 4.75, correct: [0, 2] } },
  {
    name: 'numeric',
    question: { id: 'u-4', exam: 'GATE MA', marks: 1, answer: { min: 0.99, max: 1.01 } },
  },
];

for (const { name, question } of unattemptedCases) {
  test(`scoreQuestion: ${name} — null, undefined, and empty-array responses are unattempted and score 0`, () => {
    for (const response of [null, undefined, []]) {
      assert.deepEqual(scoreQuestion(realExamConfig, question, response), { status: 'unattempted', score: 0 });
    }
  });
}

// --- scoreQuestion: loud failures ---

test('scoreQuestion: a text response to a numeric question throws, naming the question id', () => {
  assert.throws(() => scoreQuestion(realExamConfig, numericQuestion, 'abc'), /num-1/);
});

test('scoreQuestion: a bare number response to an option-based question throws, naming the question id', () => {
  assert.throws(() => scoreQuestion(realExamConfig, multiQuestion, 3), /multi-1/);
});

test('scoreQuestion: a numeric question whose answer is still a bare number throws, naming the question id', () => {
  const q = { id: 'num-unnormalized', exam: 'GATE MA', marks: 1, answer: 1 };
  assert.throws(() => scoreQuestion(realExamConfig, q, 1), /num-unnormalized/);
});

test('scoreQuestion: a known exam with no deduction configured for the marks value throws', () => {
  const q = { id: 'no-rule-1', exam: 'GATE MA', marks: 3, correct: [0] };
  assert.throws(() => scoreQuestion(realExamConfig, q, [1]), /no-rule-1/);
});

// --- The one real paper in the bank scores correctly through the default rules ---

const samplePaper = JSON.parse(readFileSync(new URL('../sources/SAMPLE/2024.json', import.meta.url), 'utf8'));

function sampleQuestion(id) {
  const q = samplePaper.questions.find((x) => x.id === id);
  return { ...q, exam: samplePaper.exam };
}

test('scoreQuestion: the SAMPLE paper single-correct MSQ (q4) scores +marks for [0] and 0 for a superset', () => {
  const q4 = sampleQuestion('sample-2024-4');
  assert.equal(scoreQuestion(realExamConfig, q4, [0]).score, 2);
  const wrong = scoreQuestion(realExamConfig, q4, [0, 1]);
  assert.equal(wrong.status, 'wrong');
  assert.equal(wrong.score, 0);
});

test('scoreQuestion: the SAMPLE paper numeric question (q5) honors the inclusive range and unattempted', () => {
  const q5 = sampleQuestion('sample-2024-5');
  assert.equal(scoreQuestion(realExamConfig, q5, 1).status, 'correct');
  assert.equal(scoreQuestion(realExamConfig, q5, 0.99).status, 'correct');
  assert.equal(scoreQuestion(realExamConfig, q5, 1.011).status, 'wrong');
  assert.deepEqual(scoreQuestion(realExamConfig, q5, null), { status: 'unattempted', score: 0 });
});

