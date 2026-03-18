import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'
import { createRoom } from '@/lib/room'
import { hashToken } from '@/lib/auth'

export async function POST() {
  const roomId = nanoid(8)
  const hostToken = crypto.randomUUID()
  const tokenHash = await hashToken(hostToken)

  await createRoom(roomId, tokenHash)

  const cookieStore = await cookies()  // MUST await — async in Next.js 15+/16
  cookieStore.set(`host-token-${roomId}`, hostToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60,
    path: '/',
  })

  return Response.json({ roomId, shareUrl: `/room/${roomId}` }, { status: 201 })
}
