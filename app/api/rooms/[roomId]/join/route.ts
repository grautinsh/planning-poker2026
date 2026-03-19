import { cookies } from 'next/headers'
import { z } from 'zod/v4'
import { joinRoom, getParticipants } from '@/lib/room'
import { pusherServer, roomChannel } from '@/lib/pusher'

const joinSchema = z.object({
  name: z.string().min(1, 'Name is required').max(32, 'Name too long').trim(),
  role: z.enum(['voter', 'observer']).optional().default('voter'),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }  // Must be Promise in Next.js 15+/16
) {
  const { roomId } = await params  // Must await

  // Validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = joinSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, role } = parsed.data
  const cookieStore = await cookies()

  // Check for existing participant cookie — prevents duplicate entries on page refresh
  const existingCookie = cookieStore.get(`participant-${roomId}`)
  if (existingCookie?.value) {
    const existingId = existingCookie.value
    // Verify it still exists in Redis (room might have expired)
    const participants = await getParticipants(roomId)
    const existing = participants.find(p => p.participantId === existingId)
    if (existing) {
      return Response.json({ participantId: existingId, name: existing.name })
    }
    // Cookie exists but participant is gone (expired room) — create new below
  }

  // Path B: no cookie — check participant list for name match (IDNT-04 reconnect)
  // getParticipants called ONCE here; result reused in both B1 and B2 paths
  const allParticipants = await getParticipants(roomId)
  const nameMatch = allParticipants.find(p => p.name === name)

  if (nameMatch) {
    // Path B1: name already in room — treat as reconnecting participant
    // Re-issue cookie with existing UUID; do NOT call joinRoom, do NOT broadcast
    cookieStore.set(`participant-${roomId}`, nameMatch.participantId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    })
    return Response.json({ participantId: nameMatch.participantId, name: nameMatch.name })
  }

  // Path B2: new participant — name not taken
  // Server-assigned UUID — primary key for vote tracking (IDNT-02)
  const participantId = crypto.randomUUID()
  await joinRoom(roomId, participantId, name, role)

  // Set httpOnly cookie — participant identity for vote submission
  cookieStore.set(`participant-${roomId}`, participantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60,
    path: '/',
  })

  // Pusher broadcast (skeleton for Phase 2 to build on)
  // Uses public channel 'room-{roomId}' — Phase 2 upgrades to presence channel
  try {
    await pusherServer.trigger(roomChannel(roomId), 'participant-joined', {
      participantId,
      name,
      role,
    })
  } catch (err) {
    // Log but don't fail the join if Pusher is unavailable
    console.error('Pusher trigger failed:', err)
  }

  return Response.json({ participantId, name })
}
