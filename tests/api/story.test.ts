import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHset = vi.fn().mockResolvedValue(1)
vi.mock('@/lib/redis', () => ({
  redis: {
    hset: mockHset,
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

const mockValidateToken = vi.fn()
vi.mock('@/lib/auth', () => ({
  validateToken: mockValidateToken,
}))

const mockTrigger = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/pusher', () => ({
  pusherServer: { trigger: mockTrigger },
  roomChannel: vi.fn((id: string) => `room-${id}`),
}))

const mockCookiesGet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookiesGet,
  }),
}))

const { POST } = await import('@/app/api/rooms/[roomId]/story/route')

const params = Promise.resolve({ roomId: 'test-room' })

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/rooms/test-room/story', {
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
  currentStory: '',
  createdAt: Date.now(),
}

describe('POST /api/rooms/[roomId]/story — SESS-04', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRoom.mockResolvedValue(validRoom)
    mockValidateToken.mockResolvedValue(true)
    mockCookiesGet.mockReturnValue({ value: 'raw-host-token' })
  })

  it('POST with valid title and host token returns 200 { ok: true }', async () => {
    const res = await POST(makeRequest({ title: 'User story #1' }), { params })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  it('hsets currentStory in Redis', async () => {
    await POST(makeRequest({ title: 'User story #1' }), { params })
    expect(mockHset).toHaveBeenCalledWith(
      'room:test-room',
      { currentStory: 'User story #1' }
    )
  })

  it('triggers story-updated Pusher event', async () => {
    await POST(makeRequest({ title: 'User story #1' }), { params })
    expect(mockTrigger).toHaveBeenCalledWith(
      'room-test-room',
      'story-updated',
      expect.anything()
    )
  })

  it('returns 403 without host-token cookie', async () => {
    mockCookiesGet.mockReturnValue(undefined)
    const res = await POST(makeRequest({ title: 'A story' }), { params })
    expect(res.status).toBe(403)
  })

  it('returns 403 with invalid host token', async () => {
    mockValidateToken.mockResolvedValue(false)
    const res = await POST(makeRequest({ title: 'A story' }), { params })
    expect(res.status).toBe(403)
  })

  it('returns 400 with empty title', async () => {
    const res = await POST(makeRequest({ title: '' }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 with title exceeding 200 chars', async () => {
    const res = await POST(makeRequest({ title: 'x'.repeat(201) }), { params })
    expect(res.status).toBe(400)
  })
})
