import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be set up before dynamic import
const mockHset = vi.fn().mockResolvedValue(1)
const mockHgetall = vi.fn().mockResolvedValue(null)
vi.mock('@/lib/redis', () => ({
  redis: {
    hset: mockHset,
    hgetall: mockHgetall,
    multi: vi.fn(),
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

vi.mock('@/lib/pusher', () => ({
  pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) },
  roomChannel: vi.fn((id: string) => `room-${id}`),
}))

const mockCookiesGet = vi.fn().mockReturnValue({ value: 'participant-uuid-1' })
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookiesGet,
  }),
}))

const { POST } = await import('@/app/api/rooms/[roomId]/vote/route')

const params = Promise.resolve({ roomId: 'test-room' })

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/rooms/test-room/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validRoom = {
  roomId: 'test-room',
  hostToken: 'hash',
  revealed: false,
  voteCount: 0,
  currentStory: 'Do the thing',
  createdAt: Date.now(),
}

describe('POST /api/rooms/[roomId]/vote — VOTE-01', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRoom.mockResolvedValue(validRoom)
    mockCookiesGet.mockReturnValue({ value: 'participant-uuid-1' })
  })

  it('stores valid Fibonacci value in votes hash and returns { ok: true }', async () => {
    const res = await POST(makeRequest({ value: '5' }), { params })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockHset).toHaveBeenCalledWith(
      'room:test-room:votes',
      { 'participant-uuid-1': '5' }
    )
  })

  it('rejects non-Fibonacci value with 400', async () => {
    const res = await POST(makeRequest({ value: '4' }), { params })
    expect(res.status).toBe(400)
  })

  it('rejects missing value with 400', async () => {
    const res = await POST(makeRequest({}), { params })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/rooms/[roomId]/vote — VOTE-02', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRoom.mockResolvedValue(validRoom)
    mockCookiesGet.mockReturnValue({ value: 'participant-uuid-1' })
  })

  it('does not return vote value in response body (value stays server-side)', async () => {
    const res = await POST(makeRequest({ value: '8' }), { params })
    const body = await res.json()
    expect(body).not.toHaveProperty('value')
    expect(JSON.stringify(body)).not.toContain('8')
  })
})

describe('POST /api/rooms/[roomId]/vote — VOTE-05', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 409 when room.revealed is true', async () => {
    mockGetRoom.mockResolvedValue({ ...validRoom, revealed: true })
    mockCookiesGet.mockReturnValue({ value: 'participant-uuid-1' })
    const res = await POST(makeRequest({ value: '3' }), { params })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns 401 when participant cookie is absent', async () => {
    mockGetRoom.mockResolvedValue(validRoom)
    mockCookiesGet.mockReturnValue(undefined)
    const res = await POST(makeRequest({ value: '3' }), { params })
    expect(res.status).toBe(401)
  })
})
