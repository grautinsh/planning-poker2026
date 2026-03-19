'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ParticipantView } from '@/types/room'

type HostUIState = 'voting' | 'post-reveal' | 'entering-estimate'

interface HostControlsProps {
  roomId: string
  currentStory: string
  participants: ParticipantView[]
  onUpdated: () => void
  revealed: boolean
}

export function HostControls({ roomId, currentStory, participants, onUpdated, revealed }: HostControlsProps) {
  const [storyInput, setStoryInput] = useState(currentStory)
  const [submitting, setSubmitting] = useState(false)
  const [uiState, setUiState] = useState<HostUIState>('voting')
  const [estimateInput, setEstimateInput] = useState('')

  const voterCount = participants.filter(p => p.role === 'voter').length
  const votedCount = participants.filter(p => p.role === 'voter' && p.hasVoted).length

  // Sync UI state with revealed prop — deps: [revealed] ONLY
  useEffect(() => {
    if (revealed && uiState === 'voting') setUiState('post-reveal')
    if (!revealed) setUiState('voting')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

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
      await fetch(`/api/rooms/${roomId}/reveal`, { method: 'POST' })
      onUpdated()
    } catch (err) {
      console.error('[handleReveal] error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [roomId, onUpdated])

  const handleReset = useCallback(async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/reset`, { method: 'POST' })
      if (res.ok) onUpdated()
    } catch { /* silent */ } finally { setSubmitting(false) }
  }, [roomId, onUpdated])

  const handleConfirmEstimate = useCallback(async () => {
    const trimmed = estimateInput.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/next-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate: trimmed }),
      })
      if (res.ok) {
        setEstimateInput('')
        setStoryInput('')
        setUiState('voting')
        onUpdated()
      }
    } catch { /* silent */ } finally { setSubmitting(false) }
  }, [roomId, estimateInput, onUpdated])

  return (
    <div className="sticky top-0 z-10 bg-white shadow-md px-4 py-3 rounded-b-lg mb-6">
      {uiState === 'voting' && !storyInput.trim() && (
        <p className="text-xs text-indigo-500 mb-2">
          Add a story title and press <strong>Set Story</strong>{' '}so your team knows what they&apos;re estimating.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Story input row — always visible */}
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={storyInput}
            onChange={e => setStoryInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Story title…"
            maxLength={200}
            disabled={submitting || uiState !== 'voting'}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            aria-label="Story title"
          />
          <button
            type="button"
            onClick={handleSetStory}
            disabled={submitting || !storyInput.trim() || uiState !== 'voting'}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Set Story
          </button>
        </div>

        {/* Action area — varies by uiState */}
        {uiState === 'voting' && (
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
        )}

        {uiState === 'post-reveal' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Round
            </button>
            <button
              type="button"
              onClick={() => setUiState('entering-estimate')}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-[0.38] disabled:cursor-not-allowed"
            >
              Next Story →
            </button>
          </div>
        )}

        {uiState === 'entering-estimate' && (
          <div className="flex items-center gap-2">
            <label htmlFor="estimate-input" className="text-sm text-slate-600 whitespace-nowrap">
              Agreed estimate:
            </label>
            <input
              id="estimate-input"
              type="text"
              value={estimateInput}
              onChange={e => setEstimateInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmEstimate() }}
              maxLength={20}
              autoFocus
              disabled={submitting}
              className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              aria-label="Agreed estimate"
            />
            <button
              type="button"
              onClick={handleConfirmEstimate}
              disabled={!estimateInput.trim() || submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-[0.38] disabled:cursor-not-allowed"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setUiState('post-reveal')}
              disabled={submitting}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
