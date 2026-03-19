'use client'

import { useCallback } from 'react'
import { FIBONACCI_DECK } from '@/lib/constants'

interface CardDeckProps {
  roomId: string
  myParticipantId: string
  selectedValue: string | null
  onVoted: (value: string) => void
}

export function CardDeck({ roomId, selectedValue, onVoted }: CardDeckProps) {
  const handleVote = useCallback(async (value: string) => {
    try {
      await fetch(`/api/rooms/${roomId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      onVoted(value)
    } catch {
      // Silent catch — vote display corrects on next refreshRoom cycle
    }
  }, [roomId, onVoted])

  return (
    <div className="flex gap-3 overflow-x-auto py-2 px-1">
      {FIBONACCI_DECK.map((value) => (
        <button
          key={value}
          onClick={() => handleVote(value)}
          className={[
            'shrink-0 w-14 h-20 rounded-lg border-2 transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
            selectedValue === value
              ? 'border-indigo-500 shadow-lg scale-[1.05] bg-indigo-50'
              : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm',
          ].join(' ')}
          aria-label={`Vote ${value}`}
          aria-pressed={selectedValue === value}
        >
          <span className="text-xl font-bold text-slate-800">{value}</span>
        </button>
      ))}
    </div>
  )
}
