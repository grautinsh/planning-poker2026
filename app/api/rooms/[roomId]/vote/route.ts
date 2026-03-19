import { cookies } from 'next/headers'
import { z } from 'zod/v4'
import { redis } from '@/lib/redis'
import { pusherServer, roomChannel } from '@/lib/pusher'
import { getRoom, keys } from '@/lib/room'
import { FIBONACCI_DECK } from '@/lib/constants'

const VoteSchema = z.object({ value: z.enum(FIBONACCI_DECK) })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params

  // Check participant cookie — anonymous votes not allowed
  const cookieStore = await cookies()
  const participantId = cookieStore.get(`participant-${roomId}`)?.value
  if (!participantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate request body before any Redis calls
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = VoteSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { value } = parsed.data

  // Check room exists and voting is still open
  const room = await getRoom(roomId)
  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }
  if (room.revealed) {
    return Response.json({ error: 'Voting closed' }, { status: 409 })
  }

  // Store vote — key is participantId, value is Fibonacci card
  await redis.hset(keys.votes(roomId), { [participantId]: value })

  // Broadcast vote-cast event (no vote value — preserves anti-anchoring)
  try {
    await pusherServer.trigger(roomChannel(roomId), 'vote-cast', {})
  } catch (err) {
    console.error('Pusher trigger failed:', err)
  }

  // NEVER return the vote value in the response (VOTE-02)
  return Response.json({ ok: true })
}
