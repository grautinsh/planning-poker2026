import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/room', () => ({
  joinRoom: vi.fn().mockResolvedValue(undefined),
  getParticipants: vi.fn().mockResolvedValue([]),
  keys: { participants: (id: string) => `room:${id}:participants` },
}))
vi.mock('@/lib/pusher', () => ({
  pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) },
  roomChannel: vi.fn((id: string) => `room-${id}`),
}))

const mockSet = vi.fn()
const mockGet = vi.fn().mockReturnValue(undefined)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockSet, get: mockGet }),
}))

const { POST } = await import('@/app/api/rooms/[roomId]/join/route')

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/rooms/test-room/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ roomId: 'test-room' })

describe('join', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('POST join with { name } returns 200 with participantId', async () => {
    const res = await POST(makeRequest({ name: 'Alice' }), { params })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('participantId')
    expect(body.name).toBe('Alice')
  })

  it('POST join sets httpOnly participant-{roomId} cookie', async () => {
    const res = await POST(makeRequest({ name: 'Alice' }), { params })
    const body = await res.json()
    expect(mockSet).toHaveBeenCalledWith(
      'participant-test-room',
      body.participantId,
      expect.objectContaining({ httpOnly: true })
    )
  })

  it('POST join stores UUID as key in participants hash, not display name', async () => {
    const { joinRoom } = await import('@/lib/room')
    await POST(makeRequest({ name: 'Alice' }), { params })
    const callArgs = vi.mocked(joinRoom).mock.calls[0]
    // Second arg is participantId (UUID), third is name
    expect(callArgs[1]).toMatch(/^[0-9a-f-]{36}$/)  // UUID format
    expect(callArgs[2]).toBe('Alice')
  })

  it('POST join with existing participant cookie returns existing participantId without creating new one', async () => {
    const existingId = 'existing-uuid-1234'
    const { getParticipants } = await import('@/lib/room')
    vi.mocked(mockGet).mockReturnValue({ value: existingId })
    vi.mocked(getParticipants).mockResolvedValue([
      { participantId: existingId, name: 'Alice', role: 'voter', joinedAt: '' }
    ])

    const res = await POST(makeRequest({ name: 'Alice' }), { params })
    const body = await res.json()
    expect(body.participantId).toBe(existingId)
    const { joinRoom } = await import('@/lib/room')
    expect(vi.mocked(joinRoom)).not.toHaveBeenCalled()
  })

  it('POST join with missing name returns 400', async () => {
    const res = await POST(makeRequest({}), { params })
    expect(res.status).toBe(400)
  })
})
