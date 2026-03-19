'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomId, setRoomId] = useState('')

  const handleCreate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rooms', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create room')
      const { shareUrl } = await res.json()
      router.push(shareUrl)
    } catch {
      setError('Could not create room. Please try again.')
      setLoading(false)
    }
  }, [router])

  const handleJoin = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const id = roomId.trim()
    if (!id) return
    router.push(`/room/${id}`)
  }, [router, roomId])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Planning Poker</h1>
        <p className="text-gray-500 mt-2 max-w-sm">
          Estimate stories together without anchoring bias.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>

        <div className="flex items-center gap-3 w-full">
          <hr className="flex-1 border-slate-200" />
          <span className="text-sm text-slate-400">or</span>
          <hr className="flex-1 border-slate-200" />
        </div>

        <form onSubmit={handleJoin} className="flex gap-2 w-full">
          <input
            type="text"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            placeholder="Room ID"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Room ID"
          />
          <button
            type="submit"
            disabled={!roomId.trim()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join Room
          </button>
        </form>
      </div>

      {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
    </main>
  )
}
