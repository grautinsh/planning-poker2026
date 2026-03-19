import { cookies } from 'next/headers'
import { redis } from '@/lib/redis'
import { pusherServer, roomChannel } from '@/lib/pusher'
import { getRoom, keys } from '@/lib/room'
import { validateToken } from '@/lib/auth'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params

  // Host-only endpoint — check cookie first
  const cookieStore = await cookies()
  const rawToken = cookieStore.get(`host-token-${roomId}`)?.value
  if (!rawToken) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const room = await getRoom(roomId)
  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  if (!await validateToken(rawToken, room.hostToken)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Idempotency guard — can only reset after reveal
  if (!room.revealed) {
    return Response.json({ error: 'Not revealed' }, { status: 409 })
  }

  // Atomic reset: clear revealed flag, voteCount, and votes
  // Note: currentStory is NOT cleared — story title preserved on reset (POST-03)
  const tx = redis.multi()
  tx.hset(keys.room(roomId), { revealed: 'false', voteCount: '0' })
  tx.del(keys.votes(roomId))
  await tx.exec()

  // Non-blocking Pusher broadcast
  try {
    await pusherServer.trigger(roomChannel(roomId), 'round-reset', {})
  } catch (err) {
    console.error('Pusher trigger failed:', err)
  }

  return Response.json({ ok: true })
}
