import { cookies } from 'next/headers'
import { z } from 'zod/v4'
import { redis } from '@/lib/redis'
import { pusherServer, roomChannel } from '@/lib/pusher'
import { getRoom, keys } from '@/lib/room'
import { validateToken } from '@/lib/auth'

const StorySchema = z.object({ title: z.string().min(1).max(200) })

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

  // Validate request body after auth check
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = StorySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { title } = parsed.data

  // Persist new story title in Redis
  await redis.hset(keys.room(roomId), { currentStory: title })

  // Notify all participants of the story change
  try {
    await pusherServer.trigger(roomChannel(roomId), 'story-updated', {})
  } catch (err) {
    console.error('Pusher trigger failed:', err)
  }

  return Response.json({ ok: true })
}
