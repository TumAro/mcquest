import { useState, useEffect } from 'react'
import { loadBookmarks, toggleBookmark } from '../storage'

/** Permanent bookmark list (D-05). Not part of any attempt: independent of mark-for-review. */
export function useBookmarks() {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    let live = true
    loadBookmarks().then((list) => {
      if (live) setIds(list)
    })
    return () => {
      live = false
    }
  }, [])

  return {
    isBookmarked: (id: string) => ids.includes(id),
    toggle: async (id: string) => setIds(await toggleBookmark(id)),
  }
}

interface BookmarkButtonProps {
  bookmarked: boolean
  onToggle: () => void
}

export default function BookmarkButton({ bookmarked, onToggle }: BookmarkButtonProps) {
  return (
    <button type="button" className="btn btn-bookmark" aria-pressed={bookmarked} onClick={onToggle}>
      <span aria-hidden="true">{bookmarked ? '\u2605' : '\u2606'}</span> {bookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
  )
}
