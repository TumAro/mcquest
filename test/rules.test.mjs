import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  assignIds,
  normalizeAnswer,
  inferType,
  needsMsqConfirm,
  validateShape,
  indexTopics,
  resolveTopic,
  suggestSlug,
} from '../scripts/lib/rules.mjs';

// --- normalizeAnswer (D-04) ---

test('normalizeAnswer: bare number gets 0.01 absolute default tolerance', () => {
  assert.deepEqual(normalizeAnswer(2.5), { min: 2.49, max: 2.51 });
});

test('normalizeAnswer: {value, tolerance} applies given tolerance', () => {
  assert.deepEqual(normalizeAnswer({ value: 3, tolerance: 0.5 }), { min: 2.5, max: 3.5 });
});

test('normalizeAnswer: {value} defaults tolerance to 0.01', () => {
  assert.deepEqual(normalizeAnswer({ value: 3 }), { min: 2.99, max: 3.01 });
});

test('normalizeAnswer: {min, max} returned unchanged and is stable applied twice', () => {
  const once = normalizeAnswer({ min: 1, max: 2 });
  assert.deepEqual(once, { min: 1, max: 2 });
  const twice = normalizeAnswer(once);
  assert.deepEqual(twice, { min: 1, max: 2 });
});

test('normalizeAnswer: null and undefined return null', () => {
  assert.equal(normalizeAnswer(null), null);
  assert.equal(normalizeAnswer(undefined), null);
});

test('normalizeAnswer: 0 is a real answer, not a missing one', () => {
  assert.deepEqual(normalizeAnswer(0), { min: -0.01, max: 0.01 });
});

test('normalizeAnswer: bounds rounded to 10 decimal places', () => {
  const result = normalizeAnswer(2.48);
  assert.equal(result.min, 2.47);
  assert.equal(result.max, 2.49);
  assert.equal(String(result.min).length <= String(2.47).length, true);
});

// --- inferType (D-03) ---

test('inferType: explicit type wins even when data would infer something else', () => {
  assert.equal(inferType({ type: 'single', correct: [0, 1] }), 'single');
});

test('inferType: answer present (including 0) returns numeric', () => {
  assert.equal(inferType({ answer: 5 }), 'numeric');
  assert.equal(inferType({ answer: 0 }), 'numeric');
});

test('inferType: correct of length 2 returns multi', () => {
  assert.equal(inferType({ correct: [0, 1] }), 'multi');
});

test('inferType: correct of length 1 returns single', () => {
  assert.equal(inferType({ correct: [0] }), 'single');
});

// --- needsMsqConfirm (AUTH-04) ---

test('needsMsqConfirm: options + one correct index + no type returns true', () => {
  assert.equal(needsMsqConfirm({ options: ['a', 'b'], correct: [0] }), true);
});

test('needsMsqConfirm: same question with type multi returns false', () => {
  assert.equal(needsMsqConfirm({ options: ['a', 'b'], correct: [0], type: 'multi' }), false);
});

test('needsMsqConfirm: same question with type single returns false', () => {
  assert.equal(needsMsqConfirm({ options: ['a', 'b'], correct: [0], type: 'single' }), false);
});

test('needsMsqConfirm: numeric question returns false', () => {
  assert.equal(needsMsqConfirm({ answer: 5 }), false);
});

test('needsMsqConfirm: options + two correct indices returns false', () => {
  assert.equal(needsMsqConfirm({ options: ['a', 'b'], correct: [0, 1] }), false);
});

// --- validateShape ---

test('validateShape: options and non-null answer together produce one message', () => {
  const msgs = validateShape({ options: ['a', 'b'], correct: [0], answer: 5 });
  assert.equal(msgs.length, 1);
});

test('validateShape: neither options nor answer produces one message', () => {
  const msgs = validateShape({});
  assert.equal(msgs.length, 1);
});

test('validateShape: options without correct produces one message', () => {
  const msgs = validateShape({ options: ['a', 'b'] });
  assert.equal(msgs.length, 1);
});

test('validateShape: correct index at or past options.length produces one message naming the index', () => {
  const msgs = validateShape({ options: ['a', 'b'], correct: [2] });
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /2/);
});

test('validateShape: {min, max} with min greater than max produces one message', () => {
  const msgs = validateShape({ answer: { min: 5, max: 1 } });
  assert.equal(msgs.length, 1);
});

test('validateShape: type numeric with no answer produces one message', () => {
  const msgs = validateShape({ type: 'numeric' });
  assert.equal(msgs.length, 1);
});

test('validateShape: type multi with no options produces one message', () => {
  const msgs = validateShape({ type: 'multi', correct: [0, 1] });
  assert.equal(msgs.length, 1);
});

test('validateShape: sound question returns empty array', () => {
  assert.deepEqual(validateShape({ options: ['a', 'b'], correct: [0, 1] }), []);
  assert.deepEqual(validateShape({ answer: 5 }), []);
});

// --- assignIds and slugify (AUTH-01, D-06) ---

test('assignIds: paper with no ids gets ids by position', () => {
  const paper = {
    exam: 'GATE MA',
    year: 2024,
    questions: [{ question: 'a' }, { question: 'b' }, { question: 'c' }],
  };
  const assigned = assignIds(paper);
  assert.equal(assigned, 3);
  assert.deepEqual(
    paper.questions.map((q) => q.id),
    ['gate-ma-2024-1', 'gate-ma-2024-2', 'gate-ma-2024-3']
  );
});

test('assignIds: paper whose questions all have ids comes back untouched, reports 0', () => {
  const paper = {
    exam: 'GATE MA',
    year: 2024,
    questions: [{ id: 'gate-ma-2024-1' }, { id: 'gate-ma-2024-2' }],
  };
  const assigned = assignIds(paper);
  assert.equal(assigned, 0);
  assert.deepEqual(
    paper.questions.map((q) => q.id),
    ['gate-ma-2024-1', 'gate-ma-2024-2']
  );
});

test('assignIds: question inserted at position 3 of a stamped 6-question paper gets -7, not a duplicate -3', () => {
  const paper = {
    exam: 'GATE MA',
    year: 2024,
    questions: [
      { id: 'gate-ma-2024-1' },
      { id: 'gate-ma-2024-2' },
      { question: 'new' },
      { id: 'gate-ma-2024-3' },
      { id: 'gate-ma-2024-4' },
      { id: 'gate-ma-2024-5' },
      { id: 'gate-ma-2024-6' },
    ],
  };
  const before = paper.questions.filter((q) => q.id).map((q) => q.id);
  const assigned = assignIds(paper);
  assert.equal(assigned, 1);
  assert.equal(paper.questions[2].id, 'gate-ma-2024-7');
  const after = paper.questions.filter((q, i) => i !== 2).map((q) => q.id);
  assert.deepEqual(after, before);
});

test('slugify: "GATE MA" returns "gate-ma"', () => {
  assert.equal(slugify('GATE MA'), 'gate-ma');
});

// --- indexTopics, resolveTopic, suggestSlug (D-05, D-07, AUTH-03) ---

const sampleTopics = {
  _note: 'PLACEHOLDER — not a subject',
  'linear-algebra': {
    label: 'Linear Algebra',
    topics: { eigen: 'Eigenvalues & Eigenvectors', rank: 'Rank & Nullity' },
  },
  calculus: {
    label: 'Calculus',
    topics: { limit: 'Limits', series: 'Sequences & Series' },
  },
};

test('indexTopics: flattens two levels and skips underscore-prefixed keys', () => {
  const { index, duplicates } = indexTopics(sampleTopics);
  assert.deepEqual(index.eigen, {
    subject: 'linear-algebra',
    subjectLabel: 'Linear Algebra',
    label: 'Eigenvalues & Eigenvectors',
  });
  assert.deepEqual(index.limit, {
    subject: 'calculus',
    subjectLabel: 'Calculus',
    label: 'Limits',
  });
  assert.equal('_note' in index, false);
  assert.deepEqual(duplicates, []);
});

test('indexTopics: same slug under two subjects is reported in duplicates naming both', () => {
  const dupeTopics = {
    'linear-algebra': { label: 'Linear Algebra', topics: { eigen: 'Eigenvalues' } },
    calculus: { label: 'Calculus', topics: { eigen: 'Eigen (dup)' } },
  };
  const { duplicates } = indexTopics(dupeTopics);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].slug, 'eigen');
  assert.deepEqual(duplicates[0].subjects, ['linear-algebra', 'calculus']);
});

test('resolveTopic: known slug returns subject slug, subject label, and topic label', () => {
  const { index } = indexTopics(sampleTopics);
  assert.deepEqual(resolveTopic('eigen', index), {
    subject: 'linear-algebra',
    subjectLabel: 'Linear Algebra',
    label: 'Eigenvalues & Eigenvectors',
  });
});

test('resolveTopic: unknown slug returns null and mutates nothing', () => {
  const { index } = indexTopics(sampleTopics);
  const before = JSON.stringify(index);
  assert.equal(resolveTopic('nope', index), null);
  assert.equal(JSON.stringify(index), before);
});

test('suggestSlug: "eigenvalues" suggests "eigen"', () => {
  const known = ['eigen', 'rank', 'limit', 'series'];
  assert.equal(suggestSlug('eigenvalues', known), 'eigen');
});

test('suggestSlug: transposed slug "eigne" suggests "eigen"', () => {
  const known = ['eigen', 'rank', 'limit', 'series'];
  assert.equal(suggestSlug('eigne', known), 'eigen');
});

test('suggestSlug: ties are broken by sorted order', () => {
  // "zzz" is equidistant (3) from both "aaa" and "bbb" — sorted order picks "aaa".
  assert.equal(suggestSlug('zzz', ['bbb', 'aaa']), 'aaa');
});

test('suggestSlug: empty known-slug list returns null instead of throwing', () => {
  assert.equal(suggestSlug('eigen', []), null);
});
