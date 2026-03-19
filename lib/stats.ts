// lib/stats.ts — STUB: implementation in Phase 3 Plan 02
// This file exists so test imports resolve. The real implementation replaces this body.
import type { ParticipantView } from '@/types/room'

export type StatsResult = {
  min: number
  max: number
  avg: number
  isConsensus: boolean
  consensusValue?: string
  nonNumericCount: number
}

export function computeStats(_participants: ParticipantView[]): StatsResult | null {
  throw new Error('TODO: not implemented')
}
