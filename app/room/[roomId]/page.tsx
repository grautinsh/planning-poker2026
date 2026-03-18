'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { RoomView } from '@/types/room'
import { JoinForm } from '@/components/JoinForm'
import { ParticipantList } from '@/components/ParticipantList'

export default function RoomPage() {
  const params = useParams()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<RoomView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // null = unknown (loading), string = joined with this ID
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null)

  const refreshRoom = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}`)
    if (res.ok) setRoom(await res.json())
  }, [roomId])

  // Load room state on mount — also picks up myParticipantId from cookie via server
  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then(res => {
        if (!res.ok) throw new Error('Room not found')
        return res.json() as Promise<RoomView & { myParticipantId: string | null }>
      })
      .then(data => {
        setRoom(data)
        if (data.myParticipantId) setMyParticipantId(data.myParticipantId)
      })
      .catch(() => setLoadError('Room not found or has expired.'))
  }, [roomId])

  const handleJoined = useCallback(async (participantId: string) => {
    setMyParticipantId(participantId)
    await refreshRoom()
  }, [refreshRoom])

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-500 font-medium">{loadError}</p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
            &larr; Create a new room
          </a>
        </div>
      </main>
    )
  }

  if (!room) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading room...</p>
      </main>
    )
  }

  const hasJoined = myParticipantId !== null

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Planning Poker</h1>
        <p className="text-sm text-gray-500 mt-1">
          Room:{' '}
          <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
            {roomId}
          </code>
        </p>
      </header>

      {/* Composition: render JoinForm or ParticipantList — no boolean props */}
      {!hasJoined ? (
        <JoinForm roomId={roomId} onJoined={handleJoined} />
      ) : null}

      <ParticipantList
        participants={room.participants}
        myParticipantId={myParticipantId}
      />
    </main>
  )
}
