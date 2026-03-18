import { hashToken, validateToken } from '@/lib/auth'

describe('token roundtrip', () => {
  it('hashToken produces a deterministic SHA-256 hex string', async () => {
    const h1 = await hashToken('test-token')
    const h2 = await hashToken('test-token')
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('validateToken returns true when cookie value matches stored hash', async () => {
    const token = 'abc-123'
    const hash = await hashToken(token)
    expect(await validateToken(token, hash)).toBe(true)
  })

  it('validateToken returns false when cookie value does not match', async () => {
    const hash = await hashToken('real-token')
    expect(await validateToken('wrong-token', hash)).toBe(false)
  })
})
