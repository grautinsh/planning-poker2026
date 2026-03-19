import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks will be filled in by Wave 1 implementation
vi.mock('@/lib/redis', () => ({
  redis: {
    hset: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue(null),
    multi: vi.fn(),
  },
}))
vi.mock('@/lib/room', () => ({
  getRoom: vi.fn(),
  keys: {
    room: (id: string) => `room:${id}`,
    votes: (id: string) => `room:${id}:votes`,
  },
}))
vi.mock('@/lib/pusher', () => ({
  pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) },
  roomChannel: vi.fn((id: string) => `room-${id}`),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'participant-uuid-1' }),
  }),
}))

describe.skip('POST /api/rooms/[roomId]/vote — VOTE-01', () => {
  it('stores valid Fibonacci value in votes hash and returns { ok: true }')
  it('rejects non-Fibonacci value with 400')
  it('rejects missing value with 400')
})

describe.skip('POST /api/rooms/[roomId]/vote — VOTE-02', () => {
  it('does not return vote value in response body (value stays server-side)')
})

describe.skip('POST /api/rooms/[roomId]/vote — VOTE-05', () => {
  it('returns 409 when room.revealed is true')
  it('returns 401 when participant cookie is absent')
})
