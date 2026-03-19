import { cookies } from 'next/headers'
import { getRoom, getParticipants, toRoomView } from '@/lib/room'
import { redis } from '@/lib/redis'
import { validateToken } from '@/lib/auth'

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

  // Include myParticipantId so the client can skip the join form if already joined
  const cookieStore = await cookies()
  const myParticipantId = cookieStore.get(`participant-${roomId}`)?.value ?? null
  const isKnown = myParticipantId ? participants.some(p => p.participantId === myParticipantId) : false

  // Derive isHost from host-token cookie — constant-time comparison
  const rawToken = cookieStore.get(`host-token-${roomId}`)?.value
  const isHost = rawToken ? await validateToken(rawToken, room.hostToken) : false

  return Response.json({ ...view, myParticipantId: isKnown ? myParticipantId : null, isHost })
}
