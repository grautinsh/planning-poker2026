// lib/auth.ts
import { timingSafeEqual } from 'crypto'

export async function hashToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawToken)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function validateToken(rawToken: string, storedHash: string): Promise<boolean> {
  if (!rawToken || !storedHash) return false
  const computedHash = await hashToken(rawToken)
  // Timing-safe comparison to prevent timing attacks
  const a = Buffer.from(computedHash, 'utf8')
  const b = Buffer.from(storedHash, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
