import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Redis before importing room module
vi.mock('@/lib/redis', () => ({
  redis: {
    hset: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn(),
  },
}))

import { createRoom, joinRoom, toRoomView, keys, ROOM_TTL_SECONDS } from '@/lib/room'
import { redis } from '@/lib/redis'

describe('createRoom', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns void and creates Redis hash with correct fields', async () => {
    await createRoom('abc12345', 'hashed-token')
    expect(redis.hset).toHaveBeenCalledWith('room:abc12345', expect.objectContaining({
      hostToken: 'hashed-token',
      revealed: 'false',
      voteCount: '0',
    }))
  })

  it('redis schema — hash contains hostToken, revealed, voteCount, currentStory, createdAt', async () => {
    await createRoom('abc12345', 'hashed-token')
    const call = vi.mocked(redis.hset).mock.calls[0][1] as Record<string, string>
    expect(call).toHaveProperty('hostToken')
    expect(call).toHaveProperty('revealed', 'false')
    expect(call).toHaveProperty('voteCount', '0')
    expect(call).toHaveProperty('currentStory')
    expect(call).toHaveProperty('createdAt')
  })
})

describe('TTL', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sets 86400-second TTL on room key after createRoom', async () => {
    await createRoom('abc12345', 'hashed-token')
    expect(redis.expire).toHaveBeenCalledWith('room:abc12345', ROOM_TTL_SECONDS)
    expect(ROOM_TTL_SECONDS).toBe(86400)
  })
})

describe('participantId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('joinRoom stores participantId as hash key, not display name', async () => {
    const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    await joinRoom('abc12345', uuid, 'Alice')
    const call = vi.mocked(redis.hset).mock.calls[0]
    expect(call[1]).toHaveProperty(uuid)
    expect(call[1]).not.toHaveProperty('Alice')
  })
})

describe('toRoomView redacted', () => {
  const baseRoom = {
    roomId: 'abc12345',
    hostToken: 'hash',
    voteCount: 1,
    currentStory: 'Story 1',
    createdAt: Date.now(),
  }
  const participants = [
    { participantId: 'uuid-1', name: 'Alice', role: 'voter' as const, joinedAt: new Date().toISOString() },
  ]
  const votes = { 'uuid-1': '5' }

  it('does not include vote values when revealed=false', () => {
    const view = toRoomView({ ...baseRoom, revealed: false }, participants, votes)
    expect(view.participants[0].value).toBeUndefined()
    expect(view.participants[0].hasVoted).toBe(true)
  })

  it('includes vote values when revealed=true', () => {
    const view = toRoomView({ ...baseRoom, revealed: true }, participants, votes)
    expect(view.participants[0].value).toBe('5')
  })
})
