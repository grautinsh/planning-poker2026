import { describe, it, expect, vi, beforeEach } from 'vitest'

// These imports will fail until lib/room.ts exists — that is intentional (RED state)
// Uncomment as implementation is added in Plan 02
// import { createRoom, joinRoom, toRoomView, keys } from '@/lib/room'

describe('createRoom', () => {
  it('returns void and creates Redis hash with correct fields', async () => {
    // STUB: will fail until lib/room.ts exports createRoom
    expect(true).toBe(false) // Force RED
  })

  it('redis schema — hash contains hostToken, revealed, voteCount, currentStory, createdAt', async () => {
    expect(true).toBe(false) // Force RED
  })
})

describe('TTL', () => {
  it('sets 86400-second TTL on room key after createRoom', async () => {
    expect(true).toBe(false) // Force RED
  })
})

describe('participantId', () => {
  it('joinRoom stores participantId as hash key, not display name', async () => {
    expect(true).toBe(false) // Force RED
  })
})

describe('toRoomView redacted', () => {
  it('does not include vote values when revealed=false', async () => {
    expect(true).toBe(false) // Force RED
  })

  it('includes vote values when revealed=true', async () => {
    expect(true).toBe(false) // Force RED
  })
})
