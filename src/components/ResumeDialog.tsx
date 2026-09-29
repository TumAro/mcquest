import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { loadInProgressAttempt, clearInProgressAttempt, type InProgressAttempt } from '../storage'

interface ResumeDialogProps {
  children: ReactNode
}

export default function ResumeDialog({ children }: ResumeDialogProps) {
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<InProgressAttempt | null | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  // Load in-progress attempt on mount
  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await loadInProgressAttempt()
        setAttempt(loaded)
      } catch (err) {
        console.error('Failed to load in-progress attempt:', err)
        setAttempt(null)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  // Still loading
  if (isLoading) {
    return <div style={{ padding: '1rem' }}>Loading...</div>
  }

  // No in-progress attempt, render children normally
  if (!attempt) {
    return <>{children}</>
  }

  // Render resume dialog
  const handleResume = () => {
    const state =
      attempt.mode === 'year-wise'
        ? // Year-wise: navigate with slug and year in URL
          {}
        : // Subject-wise/random: navigate with resumedAttempt in state
          { resumedAttempt: attempt }

    navigate(
      attempt.mode === 'year-wise'
        ? `/exam/${attempt.exam}/${attempt.year || 0}/play`
        : `/test/play`,
      { state }
    )
  }

  const handleStartFresh = async () => {
    await clearInProgressAttempt()
    setAttempt(null)
  }

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        {/* Dialog */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 style={{ margin: '0 0 1rem 0' }}>Resume Attempt?</h2>
          <p style={{ margin: '0 0 1.5rem 0', color: '#666' }}>
            An attempt in progress was found. Would you like to resume it or start fresh?
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={handleStartFresh}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Start Fresh
            </button>
            <button
              onClick={handleResume}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Resume
            </button>
          </div>
        </div>
      </div>

      {/* Children rendered behind the dialog, not interactive */}
      <div style={{ pointerEvents: 'none' }}>{children}</div>
    </>
  )
}
