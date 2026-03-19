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
  const { isDisconnected } = useRoom(roomId, refreshRoom)

  const handleJoined = useCallback(async (participantId: string) => {
    setMyParticipantId(participantId)
    await refreshRoom()
  }, [refreshRoom])

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Room not found</h2>
          <p className="text-sm text-slate-500 mb-6">This room may have expired or the link is invalid. Rooms are deleted after 24 hours of inactivity.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Create a new room
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
    <main className="min-h-screen p-6 lg:p-8">
      {isDisconnected && room !== null && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm font-medium py-2 px-4"
          role="status"
          aria-live="polite"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Reconnecting...
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
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

        <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-8 lg:items-start">
          {/* Left sidebar — participants + session log (desktop only) */}
          <div>
            {/* JoinForm — shown when not yet joined */}
            {!hasJoined && <JoinForm roomId={roomId} onJoined={handleJoined} />}

            {/* Participant list — always visible */}
            <ParticipantList
              participants={room.participants}
              myParticipantId={myParticipantId}
            />

            {/* Session log — desktop only (mobile version rendered below cards) */}
            <div className="hidden lg:block">
              <SessionLog log={room.log} />
            </div>
          </div>

          {/* Right main area — story, voting, results */}
          <div>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>Observer</span>
              </div>
            )}

            {/* CardDeck — voters only, during voting phase */}
            {isVoter && hasJoined && !room.revealed && (
              <div className="mt-2 border-t border-slate-100 pt-4">
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
              <div className="mt-2 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Results</p>
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

            {/* Session log — mobile only (desktop version rendered in sidebar) */}
            <div className="lg:hidden">
              <SessionLog log={room.log} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
