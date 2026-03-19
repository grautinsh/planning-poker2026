import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExec = vi.fn().mockResolvedValue([1, 1])
const mockTxHset = vi.fn()
const mockTxDel = vi.fn()
const mockRpush = vi.fn().mockResolvedValue(1)
const mockExpire = vi.fn().mockResolvedValue(1)
vi.mock('@/lib/redis', () => ({
  redis: {
    rpush: mockRpush,
    expire: mockExpire,
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
  ROOM_TTL_SECONDS: 86400,
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

const { POST } = await import('@/app/api/rooms/[roomId]/next-story/route')

const params = Promise.resolve({ roomId: 'test-room' })

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/rooms/test-room/next-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

describe('POST /api/rooms/[roomId]/next-story — LOG-01', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRoom.mockResolvedValue(validRevealedRoom)
    mockValidateToken.mockResolvedValue(true)
    mockCookiesGet.mockReturnValue({ value: 'raw-host-token' })
    mockExec.mockResolvedValue([1, 1])
  })

  it('returns 403 when no host-token cookie is present', async () => {
    mockCookiesGet.mockReturnValue(undefined)
    const res = await POST(makeRequest({ estimate: '5' }), { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 when room does not exist', async () => {
    mockGetRoom.mockResolvedValue(null)
    const res = await POST(makeRequest({ estimate: '5' }), { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when host token does not validate', async () => {
    mockValidateToken.mockResolvedValue(false)
    const res = await POST(makeRequest({ estimate: '5' }), { params })
    expect(res.status).toBe(403)
  })

  it('returns 422 when room.currentStory is empty string', async () => {
    mockGetRoom.mockResolvedValue({ ...validRevealedRoom, currentStory: '' })
    const res = await POST(makeRequest({ estimate: '5' }), { params })
    expect(res.status).toBe(422)
  })

  it('returns 400 when estimate body is missing', async () => {
    const res = await POST(makeRequest({}), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 when estimate is empty string', async () => {
    const res = await POST(makeRequest({ estimate: '' }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 when estimate exceeds 20 characters', async () => {
    const res = await POST(makeRequest({ estimate: 'x'.repeat(21) }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 200 and calls redis.rpush and redis.multi() on success', async () => {
    const { redis } = await import('@/lib/redis')
    const res = await POST(makeRequest({ estimate: '5' }), { params })
    expect(res.status).toBe(200)
    expect(redis.rpush).toHaveBeenCalled()
    expect(redis.multi).toHaveBeenCalled()
  })

  it('triggers story-logged Pusher event on success', async () => {
    const res = await POST(makeRequest({ estimate: '5' }), { params })
    expect(res.status).toBe(200)
    expect(mockTrigger).toHaveBeenCalledWith(
      'room-test-room',
      'story-logged',
      expect.any(Object)
    )
  })
})
