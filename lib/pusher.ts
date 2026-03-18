// lib/pusher.ts
import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

// Channel naming convention — public channel in Phase 1.
// Phase 2 will upgrade to presence-room-{roomId} when auth endpoint is wired.
export function roomChannel(roomId: string): string {
  return `room-${roomId}`
}
