// Pure rule functions for the question bank checker.
// No fs, no console, no process — these are unit-testable in isolation.

/**
 * Lowercase, trim, collapse every run of non-alphanumeric characters to a
 * single dash, strip leading/trailing dashes. "GATE MA" -> "gate-ma".
 */
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Assign missing question ids by 1-based position: `${slugify(exam)}-${year}-${n}`.
 * Never touches an id already present. When the positional candidate is
 * already taken (an author inserted a question into a stamped paper), falls
 * back to the next integer above the highest suffix currently in use.
 * Returns the number of ids assigned.
 */
export function assignIds(paper) {
  const base = `${slugify(paper.exam)}-${paper.year}`;
  const idPattern = new RegExp(`^${base}-(\\d+)$`);

  const taken = new Set();
  let maxSuffix = 0;
  for (const q of paper.questions) {
    if (!q.id) continue;
    taken.add(q.id);
    const m = idPattern.exec(q.id);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSuffix) maxSuffix = n;
    }
  }

  let nextFallback = maxSuffix + 1;
  let assigned = 0;

  paper.questions.forEach((q, i) => {
    if (q.id) return;
    let candidate = `${base}-${i + 1}`;
    if (taken.has(candidate)) {
      candidate = `${base}-${nextFallback}`;
      nextFallback += 1;
    }
    q.id = candidate;
    taken.add(candidate);
    assigned += 1;
  });

  return assigned;
}

/**
 * Normalize any of the three authored answer shapes to `{min, max}` (D-04).
 * A bare number gets a 0.01 absolute tolerance. `{value, tolerance}` defaults
 * tolerance to 0.01 when absent. `{min, max}` is returned unchanged, so
 * applying this twice is a no-op. `null`/`undefined` return `null` — a
 * question with no answer stays that way. Bounds are rounded to 10 decimal
 * places so the value written back into the author's file is `2.49`, not a
 * 17-digit float.
 */
export function normalizeAnswer(answer) {
  if (answer === null || answer === undefined) return null;

  const round = (x) => Math.round(x * 1e10) / 1e10;

  if (typeof answer === 'number') {
    return { min: round(answer - 0.01), max: round(answer + 0.01) };
  }
  if ('min' in answer && 'max' in answer) {
    return { min: round(answer.min), max: round(answer.max) };
  }
  if ('value' in answer) {
    const tolerance = answer.tolerance ?? 0.01;
    return { min: round(answer.value - tolerance), max: round(answer.value + tolerance) };
  }
  return null;
}

/**
 * Derive a question's type without the author stating it (D-03). An explicit
 * `type` always wins. Otherwise: `answer` present (including `0`) means
 * numeric, `correct.length > 1` means multi, otherwise single. Never writes
 * anything back — the inferred type must never be persisted, since the only
 * time the author writes `type` is to confirm a single-correct MSQ.
 */
export function inferType(q) {
  if (q.type) return q.type;
  if (q.answer !== null && q.answer !== undefined) return 'numeric';
  if (Array.isArray(q.correct) && q.correct.length > 1) return 'multi';
  return 'single';
}

/**
 * True when a question has options and exactly one correct index and no
 * explicit `type` — the single-correct-with-options case that is real in
 * GATE/JAM MSQs and needs the author's confirmation (AUTH-04). Writing an
 * explicit `type` of either value silences it.
 */
export function needsMsqConfirm(q) {
  return (
    Array.isArray(q.options) &&
    q.options.length > 0 &&
    Array.isArray(q.correct) &&
    q.correct.length === 1 &&
    !q.type
  );
}

/**
 * Cross-field rules ajv cannot express. Returns an array of message strings,
 * empty when the question is sound. Messages are written to read as the
 * tail of `<path> q<N>: <message>`.
 */
export function validateShape(q) {
  const messages = [];
  const hasOptions = Array.isArray(q.options);
  const hasAnswer = q.answer !== null && q.answer !== undefined;

  if (hasOptions && hasAnswer) {
    messages.push('has both options and an answer — a question is either MCQ/MSQ or numeric, not both');
  } else if (!hasOptions && !hasAnswer && !q.type) {
    // An explicit type already explains what's missing below — don't also
    // report the generic "nothing here" message for a typed question.
    messages.push('has neither options nor an answer — nothing to grade');
  }

  if (hasOptions && !Array.isArray(q.correct)) {
    messages.push('has options but no correct index');
  }
  if (hasOptions && Array.isArray(q.correct)) {
    for (const idx of q.correct) {
      if (idx >= q.options.length) {
        messages.push(`correct index ${idx} is out of range for ${q.options.length} option(s)`);
      }
    }
  }

  if (hasAnswer && typeof q.answer === 'object' && 'min' in q.answer && 'max' in q.answer) {
    if (q.answer.min > q.answer.max) {
      messages.push('has an answer range with min greater than max');
    }
  }

  if (q.type === 'numeric' && !hasAnswer) {
    messages.push('is declared type "numeric" but has no answer');
  }
  if (q.type === 'multi' && !hasOptions) {
    messages.push('is declared type "multi" but has no options');
  }

  return messages;
}
