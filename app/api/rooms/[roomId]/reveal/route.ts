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

  // Idempotency guard — reveal is a one-way transition
  if (room.revealed) {
    return Response.json({ error: 'Already revealed' }, { status: 409 })
  }

  // Atomic operation: mark room revealed AND capture all votes in a single transaction
  // MUST use redis.multi() (not pipeline) — multi() is atomic, pipeline is NOT
  const tx = redis.multi()
  tx.hset(keys.room(roomId), { revealed: 'true' })
  tx.hgetall(keys.votes(roomId))
  const [, votesRaw] = await tx.exec<[number, Record<string, string> | null]>()

  // Convert raw Redis values to string map (may be null if no votes cast)
  const votes: Record<string, string> = votesRaw
    ? Object.fromEntries(Object.entries(votesRaw).map(([k, v]) => [k, String(v)]))
    : {}

  // Broadcast full vote map — clients can now display all values
  try {
    await pusherServer.trigger(roomChannel(roomId), 'vote-revealed', { votes })
  } catch (err) {
    console.error('Pusher trigger failed:', err)
  }

  return Response.json({ ok: true })
}
