import { describe, it, expect } from 'vitest'
import type { ParticipantView } from '@/types/room'
import { computeStats } from '@/lib/stats'

// lib/stats.ts is a stub — all tests fail red until Plan 02 provides real implementation.

function voter(value: string, id = 'u1'): ParticipantView {
  return { participantId: id, name: 'Test', role: 'voter', hasVoted: true, value }
}

function observer(id = 'obs1'): ParticipantView {
  return { participantId: id, name: 'Observer', role: 'observer', hasVoted: false }
}

describe('computeStats', () => {
  it('returns null for empty participants array', () => {
    expect(computeStats([])).toBeNull()
  })

  it('returns min/max/avg and isConsensus:false for votes [3, 5, 8]', () => {
    const participants = [
      voter('3', 'u1'),
      voter('5', 'u2'),
      voter('8', 'u3'),
    ]
    const result = computeStats(participants)
    expect(result).not.toBeNull()
    expect(result!.min).toBe(3)
    expect(result!.max).toBe(8)
    expect(result!.avg).toBeCloseTo(5.33, 1)
    expect(result!.isConsensus).toBe(false)
    expect(result!.nonNumericCount).toBe(0)
  })

  it('returns isConsensus:true and consensusValue:"5" when all votes are the same [5, 5]', () => {
    const participants = [
      voter('5', 'u1'),
      voter('5', 'u2'),
    ]
    const result = computeStats(participants)
    expect(result).not.toBeNull()
    expect(result!.isConsensus).toBe(true)
    expect(result!.consensusValue).toBe('5')
  })

  it('returns null when all votes are non-numeric (∞, ?)', () => {
    const participants = [
      voter('∞', 'u1'),
      voter('?', 'u2'),
    ]
    expect(computeStats(participants)).toBeNull()
  })

  it('returns min:5, max:8, nonNumericCount:1, avg:6.5 for mixed votes [5, ∞, 8]', () => {
    const participants = [
      voter('5', 'u1'),
      voter('∞', 'u2'),
      voter('8', 'u3'),
    ]
    const result = computeStats(participants)
    expect(result).not.toBeNull()
    expect(result!.min).toBe(5)
    expect(result!.max).toBe(8)
    expect(result!.nonNumericCount).toBe(1)
    expect(result!.avg).toBeCloseTo(6.5, 1)
  })

  it('excludes observer participants from stats computation', () => {
    const participants = [
      voter('5', 'u1'),
      observer('obs1'),
    ]
    const result = computeStats(participants)
    expect(result).not.toBeNull()
    expect(result!.min).toBe(5)
    expect(result!.max).toBe(5)
  })
})
