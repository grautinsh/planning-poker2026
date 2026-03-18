import { describe, it, expect, vi } from 'vitest'

// import { POST } from '@/app/api/rooms/[roomId]/join/route'

describe('join', () => {
  it('POST join with { name } returns 200 with participantId', async () => {
    expect(true).toBe(false) // Force RED
  })

  it('POST join sets httpOnly participant-{roomId} cookie', async () => {
    expect(true).toBe(false) // Force RED
  })

  it('POST join stores UUID as key in participants hash, not display name', async () => {
    expect(true).toBe(false) // Force RED
  })

  it('POST join with existing participant cookie returns existing participantId without creating new one', async () => {
    expect(true).toBe(false) // Force RED
  })
})
