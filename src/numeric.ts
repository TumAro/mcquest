/**
 * Parse a typed string to a numeric response.
 * Returns null for anything that is not a finite number.
 * Returns the number otherwise, including 0.
 *
 * Empty input, whitespace-only input, non-numeric text, and special values
 * like Infinity and NaN all return null. A trailing decimal point like "2."
 * is accepted and rounded to the integer.
 */
export function parseNumeric(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const num = parseFloat(trimmed)
  if (!Number.isFinite(num)) return null

  return num
}
