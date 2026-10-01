import { useEffect, useRef } from 'react'
import type { Settings as SettingsValue, Theme } from '../storage'

interface SettingsProps {
  settings: SettingsValue
  onChange: (next: SettingsValue) => void
  onClose: () => void
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

// Uncontrolled so a field can be cleared and retyped; only a whole number of at least 1 is committed.
function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  return (
    <label className="field-row">
      {label}
      <input
        type="number"
        className="text-input"
        min={1}
        defaultValue={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isInteger(n) && n >= 1) onCommit(n)
        }}
      />
    </label>
  )
}

export default function Settings({ settings, onChange, onClose }: SettingsProps) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => dialog.current?.querySelector('input')?.focus(), [])

  const set = (patch: Partial<SettingsValue>) => onChange({ ...settings, ...patch })

  return (
    <div className="modal-overlay">
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <h2 className="modal-title">Settings</h2>

        <fieldset className="field-group">
          <legend>Theme</legend>
          {THEMES.map((t) => (
            <label key={t.value} className="option-row">
              <input
                type="radio"
                name="theme"
                checked={settings.theme === t.value}
                onChange={() => set({ theme: t.value })}
              />
              {t.label}
            </label>
          ))}
        </fieldset>

        <div className="field-group">
          <NumberField label="Paper time (minutes)" value={settings.paperMinutes} onCommit={(n) => set({ paperMinutes: n })} />
        </div>

        <div className="field-group">
          <label className="option-row">
            <input
              type="checkbox"
              checked={settings.drillMinutes !== null}
              onChange={(e) => set({ drillMinutes: e.target.checked ? 30 : null })}
            />
            Time drills
          </label>
          {settings.drillMinutes !== null && (
            <NumberField label="Drill time (minutes)" value={settings.drillMinutes} onCommit={(n) => set({ drillMinutes: n })} />
          )}
        </div>

        <div className="field-group">
          <NumberField label="Questions per drill" value={settings.questionCount} onCommit={(n) => set({ questionCount: n })} />
        </div>

        <div className="field-group">
          <label className="option-row">
            <input
              type="checkbox"
              checked={settings.drillFeedback}
              onChange={(e) => set({ drillFeedback: e.target.checked })}
            />
            Show the answer as I go in drills
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
