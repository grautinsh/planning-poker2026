import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExec = vi.fn().mockResolvedValue([1, { 'user-a': '5', 'user-b': '8' }])
const mockTxHset = vi.fn()
const mockTxHgetall = vi.fn()
vi.mock('@/lib/redis', () => ({
  redis: {
    multi: vi.fn(() => ({ hset: mockTxHset, hgetall: mockTxHgetall, exec: mockExec })),
  },
}))

const mockGetRoom = vi.fn()
vi.mock('@/lib/room', () => ({
  getRoom: mockGetRoom,
  keys: {
    room: (id: string) => `room:${id}`,
    votes: (id: string) => `room:${id}:votes`,
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

const { POST } = await import('@/app/api/rooms/[roomId]/reveal/route')

const params = Promise.resolve({ roomId: 'test-room' })

function makeRequest() {
  return new Request('http://localhost/api/rooms/test-room/reveal', {
    method: 'POST',
  })
}

const validRoom = {
  roomId: 'test-room',
  hostToken: 'hash',
  revealed: false,
  voteCount: 0,
  currentStory: 'Some story',
  createdAt: Date.now(),
}

describe('POST /api/rooms/[roomId]/reveal — VOTE-04', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRoom.mockResolvedValue(validRoom)
    mockValidateToken.mockResolvedValue(true)
    mockCookiesGet.mockReturnValue({ value: 'raw-host-token' })
    mockExec.mockResolvedValue([1, { 'user-a': '5', 'user-b': '8' }])
  })

  it('sets revealed=true in Redis using atomic multi() transaction', async () => {
    const { redis } = await import('@/lib/redis')
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(200)
    expect(redis.multi).toHaveBeenCalled()
    expect(mockTxHset).toHaveBeenCalledWith(
      'room:test-room',
      { revealed: 'true' }
    )
  })

  it('triggers vote-revealed Pusher event with votes map in payload', async () => {
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(200)
    expect(mockTrigger).toHaveBeenCalledWith(
      'room-test-room',
      'vote-revealed',
      expect.objectContaining({ votes: { 'user-a': '5', 'user-b': '8' } })
    )
  })

  it('returns 200 { ok: true } on success', async () => {
    const res = await POST(makeRequest(), { params })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  it('returns 403 when host-token cookie is absent', async () => {
    mockCookiesGet.mockReturnValue(undefined)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(403)
  })

  it('returns 403 when host token does not validate', async () => {
    mockValidateToken.mockResolvedValue(false)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(403)
  })

  it('returns 409 when room is already revealed', async () => {
    mockGetRoom.mockResolvedValue({ ...validRoom, revealed: true })
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(409)
  })

  it('returns 404 when room does not exist', async () => {
    mockGetRoom.mockResolvedValue(null)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(404)
  })
})
