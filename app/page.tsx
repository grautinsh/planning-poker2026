'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight">Planning Poker</h1>
      <p className="text-gray-500 text-center max-w-sm">
        Create a room and share the link with your team to start estimating stories together.
      </p>
      <button
        onClick={handleCreate}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating...' : 'Create Room'}
      </button>
      {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
    </main>
  )
}
