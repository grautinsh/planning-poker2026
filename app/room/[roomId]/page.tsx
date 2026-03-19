'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { RoomPageResponse, ParticipantView } from '@/types/room'
import { useRoom } from '@/hooks/useRoom'
import { JoinForm } from '@/components/JoinForm'
import { ParticipantList } from '@/components/ParticipantList'
import { HostControls } from '@/components/HostControls'
import { CardDeck } from '@/components/CardDeck'
import { VoteCard } from '@/components/VoteCard'
import { computeStats } from '@/lib/stats'
import { SessionLog } from '@/components/SessionLog'

// Module-level component to prevent remount on parent re-render
function VoteStats({ participants }: { participants: ParticipantView[] }) {
  const stats = computeStats(participants)
  if (!stats) return null

  if (stats.isConsensus) {
    return (
      <div className="mb-4 inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-sm font-medium px-3 py-1.5 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Consensus: {stats.consensusValue}
      </div>
    )
  }

  return (
    <p className="mb-4 text-sm text-slate-600">
      Min: {stats.min} · Max: {stats.max} · Avg: {stats.avg.toFixed(1)}
      {stats.nonNumericCount > 0 && (
        <span className="ml-2 text-slate-400 text-xs">
          ({stats.nonNumericCount} non-numeric excluded)
        </span>
      )}
    </p>
  )
}

export default function RoomPage() {
  const params = useParams()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<RoomPageResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // null = unknown (loading), string = joined with this ID
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [selectedValue, setSelectedValue] = useState<string | null>(null)

  const refreshRoom = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}`)
    if (res.ok) {
      const data = await res.json() as RoomPageResponse
      setRoom(data)
      setIsHost(data.isHost)
      if (data.revealed) setSelectedValue(null)
    }
  }, [roomId])

  // Load room state on mount — also picks up myParticipantId from cookie via server
  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then(res => {
        if (!res.ok) throw new Error('Room not found')
        return res.json() as Promise<RoomPageResponse>
      })
      .then(data => {
        setRoom(data)
        setIsHost(data.isHost)
        if (data.myParticipantId) setMyParticipantId(data.myParticipantId)
      })
      .catch(() => setLoadError('Room not found or has expired.'))
  }, [roomId])

  // Wire Pusher real-time events — all 4 events trigger a full room refresh
  useRoom(roomId, refreshRoom)

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
  const myParticipant = room.participants.find(p => p.participantId === myParticipantId) ?? null
  const isObserver = myParticipant?.role === 'observer'
  const isVoter = myParticipant?.role === 'voter'

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

      {/* HostControls — sticky panel, hosts only */}
      {isHost && room && (
        <HostControls
          roomId={roomId}
          currentStory={room.currentStory}
          participants={room.participants}
          onUpdated={refreshRoom}
          revealed={room.revealed}
        />
      )}

      {/* Story title read-only display for non-hosts */}
      {!isHost && hasJoined && room.currentStory && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Current Story</p>
          <p className="font-semibold text-slate-800">{room.currentStory}</p>
        </div>
      )}

      {/* Observer badge */}
      {isObserver && hasJoined && (
        <div className="mb-4 flex items-center gap-1.5 bg-slate-100 text-slate-600 text-sm px-3 py-1.5 rounded-full w-fit">
          {/* Eye icon — inline SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Observer</span>
        </div>
      )}

      {/* JoinForm — shown when not yet joined */}
      {!hasJoined && <JoinForm roomId={roomId} onJoined={handleJoined} />}

      {/* Participant list — always visible */}
      <ParticipantList
        participants={room.participants}
        myParticipantId={myParticipantId}
      />

      {/* CardDeck — voters only, during voting phase */}
      {isVoter && hasJoined && !room.revealed && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Your Vote</p>
          <CardDeck
            roomId={roomId}
            myParticipantId={myParticipantId!}
            selectedValue={selectedValue}
            onVoted={setSelectedValue}
          />
        </div>
      )}

      {/* Post-reveal VoteCard grid — shown to all when room.revealed === true */}
      {room.revealed && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Results</p>

          {/* VoteStats row — between heading and card grid */}
          <VoteStats participants={room.participants} />

          <div className="flex flex-wrap gap-4">
            {room.participants
              .filter(p => p.role === 'voter')
              .map((p, index) => (
                <div key={p.participantId} className="flex flex-col items-center gap-1">
                  <VoteCard
                    value={p.value ?? '—'}
                    revealed={true}
                    index={index}
                    participantName={p.name}
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Session log — always visible, empty state shown until stories logged */}
      <SessionLog log={room.log} />
    </main>
  )
}
