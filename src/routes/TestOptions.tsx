export type RevealMode = 'immediate' | 'onSubmit'

interface TestOptionsProps {
  timed: boolean
  setTimed: (v: boolean) => void
  minutes: number
  setMinutes: (v: number) => void
  revealMode: RevealMode
  setRevealMode: (v: RevealMode) => void
}

/**
 * Timer and reveal-mode controls, shared by every entry point.
 * Only the defaults differ per entry point: year-wise starts on 'onSubmit',
 * subject-wise and random start on 'immediate'. The choice itself is always
 * the user's, so these controls live in one place.
 */
export default function TestOptions({
  timed,
  setTimed,
  minutes,
  setMinutes,
  revealMode,
  setRevealMode,
}: TestOptionsProps) {
  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h2>Timer</h2>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.currentTarget.checked)} />
          <span>Timed mode</span>
        </label>
        {timed && (
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Minutes:</span>
            <input
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(parseInt(e.currentTarget.value, 10) || 1)}
              style={{ width: '80px' }}
            />
          </label>
        )}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Feedback</h2>
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <input
            type="radio"
            name="reveal-mode"
            checked={revealMode === 'onSubmit'}
            onChange={() => setRevealMode('onSubmit')}
          />
          <span style={{ marginLeft: '0.5rem' }}>Exam mode — no feedback until submit</span>
        </label>
        <label style={{ display: 'block' }}>
          <input
            type="radio"
            name="reveal-mode"
            checked={revealMode === 'immediate'}
            onChange={() => setRevealMode('immediate')}
          />
          <span style={{ marginLeft: '0.5rem' }}>Practice mode — feedback on each answer</span>
        </label>
      </div>
    </>
  )
}
