import { describe, it, expect } from 'vitest'

// import { hashToken, validateToken } from '@/lib/auth'

describe('token roundtrip', () => {
  it('hashToken produces a deterministic SHA-256 hex string', async () => {
    expect(true).toBe(false) // Force RED
  })

  it('validateToken returns true when cookie value matches stored hash', async () => {
    expect(true).toBe(false) // Force RED
  })

  it('validateToken returns false when cookie value does not match', async () => {
    expect(true).toBe(false) // Force RED
  })
})
