import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing route handlers
vi.mock('@/lib/room', () => ({
  createRoom: vi.fn().mockResolvedValue(undefined),
  getRoom: vi.fn(),
  getParticipants: vi.fn().mockResolvedValue([]),
  toRoomView: vi.fn().mockReturnValue({ roomId: 'test', revealed: false, participants: [], currentStory: '' }),
  keys: { room: (id: string) => `room:${id}`, votes: (id: string) => `room:${id}:votes`, participants: (id: string) => `room:${id}:participants`, log: (id: string) => `room:${id}:log` },
}))
vi.mock('@/lib/auth', () => ({
  hashToken: vi.fn().mockResolvedValue('mocked-hash'),
  validateToken: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/redis', () => ({
  redis: { hgetall: vi.fn().mockResolvedValue({}) },
}))

// Mock next/headers cookies
const mockSet = vi.fn()
const mockGet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockSet, get: mockGet }),
}))

// Import AFTER mocks are set up
const { POST } = await import('@/app/api/rooms/route')
const { GET } = await import('@/app/api/rooms/[roomId]/route')

describe('host token cookie', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('POST /api/rooms returns 201 with roomId and shareUrl', async () => {
    const res = await POST()
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body).toHaveProperty('roomId')
    expect(body).toHaveProperty('shareUrl')
    expect(body.shareUrl).toBe(`/room/${body.roomId}`)
  })

  it('POST /api/rooms sets httpOnly host-token-{roomId} cookie', async () => {
    const res = await POST()
    const body = await res.json()
    expect(mockSet).toHaveBeenCalledWith(
      `host-token-${body.roomId}`,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', maxAge: 86400 })
    )
  })
})
