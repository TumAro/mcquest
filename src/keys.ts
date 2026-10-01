export type Shortcut =
  | { kind: 'pick'; index: number }
  | { kind: 'save' }
  | { kind: 'mark' }
  | { kind: 'move'; delta: -1 | 1 }

/** Just enough of the event target to decide: lower-cased tag name and input type. */
export interface KeyTarget {
  tag: string
  type?: string
}

/** Which player shortcut a key is, if any. Typing in the number field keeps its digits, m and arrows. */
export function shortcutFor(key: string, target: KeyTarget | null): Shortcut | null {
  const typing = target?.tag === 'input' && target.type === 'number'
  if (key === 'Enter') {
    // A focused button or link owns Enter; it must not also advance the question.
    return target?.tag === 'button' || target?.tag === 'a' ? null : { kind: 'save' }
  }
  if (typing) return null
  if (key >= '1' && key <= '4') return { kind: 'pick', index: Number(key) - 1 }
  if (key === 'm' || key === 'M') return { kind: 'mark' }
  if (key === 'ArrowLeft') return { kind: 'move', delta: -1 }
  if (key === 'ArrowRight') return { kind: 'move', delta: 1 }
  return null
}
