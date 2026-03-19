import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/redis', () => ({
  redis: {
    hset: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue(null),
  },
}))
vi.mock('@/lib/room', () => ({
  getRoom: vi.fn(),
  keys: { room: (id: string) => `room:${id}` },
}))
vi.mock('@/lib/pusher', () => ({
  pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) },
  roomChannel: vi.fn((id: string) => `room-${id}`),
}))
vi.mock('@/lib/auth', () => ({
  validateToken: vi.fn().mockResolvedValue(true),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'raw-host-token' }),
  }),
}))

describe.skip('POST /api/rooms/[roomId]/story — SESS-04', () => {
  it('sets currentStory in Redis and triggers story-updated Pusher event')
  it('returns 403 when host-token cookie is absent')
  it('returns 403 when host token does not validate against stored hash')
  it('returns 400 when title is empty string')
  it('returns 400 when title exceeds 200 characters')
})
