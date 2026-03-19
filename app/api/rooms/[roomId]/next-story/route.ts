import { cookies } from 'next/headers'
import { redis } from '@/lib/redis'
import { pusherServer, roomChannel } from '@/lib/pusher'
import { getRoom, keys, ROOM_TTL_SECONDS } from '@/lib/room'
import { validateToken } from '@/lib/auth'
import type { LogEntry } from '@/types/room'

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

  // Must have a story set before logging
  if (!room.currentStory) {
    return Response.json({ error: 'No story set' }, { status: 422 })
  }

  // Parse and validate request body
  const body = await req.json().catch(() => null)
  const estimate = typeof body?.estimate === 'string' ? body.estimate.trim() : ''
  if (!estimate) {
    return Response.json({ error: 'estimate is required' }, { status: 400 })
  }
  if (estimate.length > 20) {
    return Response.json({ error: 'estimate too long' }, { status: 400 })
  }

  // Append to Redis log FIRST — durable even if reset fails
  const entry: LogEntry = { story: room.currentStory, estimate }
  await redis.rpush(keys.log(roomId), JSON.stringify(entry))
  await redis.expire(keys.log(roomId), ROOM_TTL_SECONDS)

  // Atomic room reset: clear revealed flag, voteCount, and currentStory
  const tx = redis.multi()
  tx.hset(keys.room(roomId), { revealed: 'false', voteCount: '0', currentStory: '' })
  tx.del(keys.votes(roomId))
  await tx.exec()

  // Non-blocking Pusher broadcast
  try {
    await pusherServer.trigger(roomChannel(roomId), 'story-logged', {})
  } catch (err) {
    console.error('Pusher trigger failed:', err)
  }

  return Response.json({ ok: true })
}
