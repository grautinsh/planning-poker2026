import { getRoom, getParticipants, toRoomView } from '@/lib/room'
import { redis } from '@/lib/redis'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }  // MUST be Promise in Next.js 15+/16
) {
  const { roomId } = await params  // MUST await before destructuring

  const room = await getRoom(roomId)
  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  const participants = await getParticipants(roomId)
  const votesRaw = await redis.hgetall(`room:${roomId}:votes`) ?? {}
  const votes: Record<string, string> = Object.fromEntries(
    Object.entries(votesRaw).map(([k, v]) => [k, String(v)])
  )

  const view = toRoomView(room, participants, votes)
  return Response.json(view)
}
