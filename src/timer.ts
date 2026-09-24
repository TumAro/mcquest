export function remainingMs(deadline: number, now: number): number {
  return Math.max(0, deadline - now)
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function isTimeUp(deadline: number, now: number): boolean {
  return deadline <= now
}
