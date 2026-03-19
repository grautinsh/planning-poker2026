'use client'

import { useState, useCallback } from 'react'

interface JoinFormProps {
  roomId: string
  onJoined: (participantId: string) => void
}

export function JoinForm({ roomId, onJoined }: JoinFormProps) {
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<'voter' | 'observer'>('voter')

  // Functional setState pattern — no stale closure risk
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setJoining(true)
    setError(null)
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, role }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error?.formErrors?.[0] ?? 'Failed to join')
      }
      const { participantId } = await res.json()
      onJoined(participantId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
      setJoining(false)
    }
  }, [roomId, name, role, onJoined])

  // Derived state — computed during render, no extra useState
  const canSubmit = !joining && name.trim().length > 0

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Join this room</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          maxLength={32}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          autoFocus
          aria-label="Your display name"
        />
        <div className="flex gap-2" role="group" aria-label="Participation role">
          <button
            type="button"
            onClick={() => setRole('voter')}
            className={[
              'flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
              role === 'voter'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            ].join(' ')}
            aria-pressed={role === 'voter'}
          >
            Voter
          </button>
          <button
            type="button"
            onClick={() => setRole('observer')}
            className={[
              'flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
              role === 'observer'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            ].join(' ')}
            aria-pressed={role === 'observer'}
          >
            Observer
          </button>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {joining ? 'Joining...' : 'Join Room'}
        </button>
        {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
      </form>
    </section>
  )
}
