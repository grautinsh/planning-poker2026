import type { ParticipantView } from '@/types/room'

export type StatsResult = {
  min: number
  max: number
  avg: number
  isConsensus: boolean
  consensusValue: string   // Only meaningful when isConsensus === true
  nonNumericCount: number
}

const NUMERIC_RE = /^\d+$/

export function computeStats(participants: ParticipantView[]): StatsResult | null {
  const voters = participants.filter(p => p.role === 'voter' && p.value !== undefined)
  if (voters.length === 0) return null

  const numeric = voters
    .filter(p => NUMERIC_RE.test(p.value!))
    .map(p => parseInt(p.value!, 10))
  const nonNumericCount = voters.length - numeric.length

  if (numeric.length === 0) return null  // All non-numeric — skip stats

  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const avg = Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) / 10

  const isConsensus = voters.every(p => p.value === voters[0].value)

  return {
    min,
    max,
    avg,
    isConsensus,
    consensusValue: voters[0].value!,
    nonNumericCount,
  }
}
