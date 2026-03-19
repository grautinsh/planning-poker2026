import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExec = vi.fn().mockResolvedValue([1, {}])
const mockHset = vi.fn()
const mockHgetall = vi.fn()
vi.mock('@/lib/redis', () => ({
  redis: {
    hset: mockHset,
    hgetall: mockHgetall,
    multi: vi.fn(() => ({ hset: mockHset, hgetall: mockHgetall, exec: mockExec })),
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
vi.mock('@/lib/auth', () => ({
  validateToken: vi.fn().mockResolvedValue(true),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'raw-host-token' }),
  }),
}))

describe.skip('POST /api/rooms/[roomId]/reveal — VOTE-04', () => {
  it('sets revealed=true in Redis using atomic multi() transaction')
  it('triggers vote-revealed Pusher event with votes map in payload')
  it('returns 403 when host-token cookie is absent')
  it('returns 403 when host token does not validate')
  it('returns 409 when room is already revealed')
  it('returns 404 when room does not exist')
})
