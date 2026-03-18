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
        body: JSON.stringify({ name: trimmed }),
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
  }, [roomId, name, onJoined])

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
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          aria-label="Your display name"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {joining ? 'Joining...' : 'Join as Voter'}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              const trimmed = name.trim()
              if (!trimmed) return
              setJoining(true)
              setError(null)
              try {
                const res = await fetch(`/api/rooms/${roomId}/join`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: trimmed, role: 'observer' }),
                })
                if (!res.ok) throw new Error('Failed to join')
                const { participantId } = await res.json()
                onJoined(participantId)
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to join room')
                setJoining(false)
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Observer
          </button>
        </div>
        {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
      </form>
    </section>
  )
}
