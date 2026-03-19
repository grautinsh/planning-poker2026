'use client'

import { useState, useCallback } from 'react'
import type { ParticipantView } from '@/types/room'

interface HostControlsProps {
  roomId: string
  currentStory: string
  participants: ParticipantView[]
  onUpdated: () => void
}

export function HostControls({ roomId, currentStory, participants, onUpdated }: HostControlsProps) {
  const [storyInput, setStoryInput] = useState(currentStory)
  const [submitting, setSubmitting] = useState(false)

  const voterCount = participants.filter(p => p.role === 'voter').length
  const votedCount = participants.filter(p => p.role === 'voter' && p.hasVoted).length

  const handleSetStory = useCallback(async () => {
    const trimmed = storyInput.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await fetch(`/api/rooms/${roomId}/story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      onUpdated()
    } catch {
      // Silent catch — refreshRoom cycle will correct state
    } finally {
      setSubmitting(false)
    }
  }, [roomId, storyInput, onUpdated])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSetStory()
    }
  }, [handleSetStory])

  const handleReveal = useCallback(async () => {
    setSubmitting(true)
    try {
      await fetch(`/api/rooms/${roomId}/reveal`, {
        method: 'POST',
      })
      onUpdated()
    } catch {
      // Silent catch — refreshRoom cycle will correct state
    } finally {
      setSubmitting(false)
    }
  }, [roomId, onUpdated])

  return (
    <div className="sticky top-0 z-10 bg-white shadow-md px-4 py-3 rounded-b-lg mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={storyInput}
            onChange={e => setStoryInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Story title…"
            maxLength={200}
            disabled={submitting}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            aria-label="Story title"
          />
          <button
            type="button"
            onClick={handleSetStory}
            disabled={submitting || !storyInput.trim()}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Set Story
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 whitespace-nowrap">
            {votedCount} / {voterCount} voted
          </span>
          <button
            type="button"
            onClick={handleReveal}
            disabled={votedCount === 0 || submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-[0.38] disabled:cursor-not-allowed"
          >
            Reveal Votes
          </button>
        </div>
      </div>
    </div>
  )
}
