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
    return <div className="loading-state">Loading...</div>
  }

  // No in-progress attempt, render children normally
  if (!attempt) {
    return <>{children}</>
  }

  // Render resume dialog
  const handleResume = () => {
    navigate('/test/play')

    // Dismiss the dialog. Without this the dialog stays mounted and keeps
    // covering its children, so Resume appears to do nothing — navigating to
    // the URL the user is already on does not remount this component.
    setAttempt(null)
  }

  const handleStartFresh = async () => {
    await clearInProgressAttempt()
    setAttempt(null)

    // Return to the front page, replacing the entry. The browser restores
    // history.state across a reload, so staying on /test/play would hand the
    // player its old config and it would immediately recreate the attempt the
    // user just discarded.
    navigate('/', { replace: true, state: null })
  }

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay">
        {/* Dialog */}
        <div className="modal">
          <h2 className="modal-title">Resume Attempt?</h2>
          <p className="modal-body">
            An attempt in progress was found. Would you like to resume it or start fresh?
          </p>

          <div className="modal-actions">
            <button className="btn" onClick={handleStartFresh}>
              Start Fresh
            </button>
            <button className="btn btn-primary" onClick={handleResume}>
              Resume
            </button>
          </div>
        </div>
      </div>

      {/*
        Children are deliberately NOT rendered while the decision is pending.
        Rendering the app behind the dialog mounts the player, which restores the
        attempt and starts its clock — so every second spent deciding was burned
        off the paper, which is the exact behaviour this dialog exists to prevent.
      */}
    </>
  )
}
