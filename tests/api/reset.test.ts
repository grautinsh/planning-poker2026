import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExec = vi.fn().mockResolvedValue([1, 1])
const mockTxHset = vi.fn()
const mockTxDel = vi.fn()
vi.mock('@/lib/redis', () => ({
  redis: {
    multi: vi.fn(() => ({ hset: mockTxHset, del: mockTxDel, exec: mockExec })),
  },
}))

const mockGetRoom = vi.fn()
vi.mock('@/lib/room', () => ({
  getRoom: mockGetRoom,
  keys: {
    room: (id: string) => `room:${id}`,
    votes: (id: string) => `room:${id}:votes`,
    participants: (id: string) => `room:${id}:participants`,
    log: (id: string) => `room:${id}:log`,
  },
}))

const mockTrigger = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/pusher', () => ({
  pusherServer: { trigger: mockTrigger },
  roomChannel: vi.fn((id: string) => `room-${id}`),
}))

const mockValidateToken = vi.fn()
vi.mock('@/lib/auth', () => ({
  validateToken: mockValidateToken,
}))

const mockCookiesGet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookiesGet,
  }),
}))

const { POST } = await import('@/app/api/rooms/[roomId]/reset/route')

const params = Promise.resolve({ roomId: 'test-room' })

function makeRequest() {
  return new Request('http://localhost/api/rooms/test-room/reset', {
    method: 'POST',
  })
}

const validRevealedRoom = {
  roomId: 'test-room',
  hostToken: 'hash',
  revealed: true,
  voteCount: 2,
  currentStory: 'Some story',
  createdAt: Date.now(),
}

describe('POST /api/rooms/[roomId]/reset — POST-03', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRoom.mockResolvedValue(validRevealedRoom)
    mockValidateToken.mockResolvedValue(true)
    mockCookiesGet.mockReturnValue({ value: 'raw-host-token' })
    mockExec.mockResolvedValue([1, 1])
  })

  it('returns 403 when no host-token cookie is present', async () => {
    mockCookiesGet.mockReturnValue(undefined)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 when room does not exist', async () => {
    mockGetRoom.mockResolvedValue(null)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when host token does not validate', async () => {
    mockValidateToken.mockResolvedValue(false)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(403)
  })

  it('returns 409 when room.revealed is false (nothing to reset)', async () => {
    mockGetRoom.mockResolvedValue({ ...validRevealedRoom, revealed: false })
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(409)
  })

  it('returns 200 and calls redis.multi() when room is revealed and host token is valid', async () => {
    const { redis } = await import('@/lib/redis')
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(200)
    expect(redis.multi).toHaveBeenCalled()
  })

  it('triggers round-reset Pusher event with empty payload on success', async () => {
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(200)
    expect(mockTrigger).toHaveBeenCalledWith(
      'room-test-room',
      'round-reset',
      expect.any(Object)
    )
  })
})
