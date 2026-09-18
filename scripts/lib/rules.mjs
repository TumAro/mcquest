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
