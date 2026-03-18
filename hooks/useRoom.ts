'use client'

import { useEffect, useRef } from 'react'
import { pusherClient } from '@/lib/pusher-client'

// Skeleton hook — subscribes to the room channel.
// Phase 2 will bind event handlers to this subscription.
// Channel type: public 'room-{roomId}' (Phase 2 upgrades to presence channel)
export function useRoom(roomId: string) {
  const channelRef = useRef<ReturnType<typeof pusherClient.subscribe> | null>(null)

  useEffect(() => {
    if (!roomId) return

    const channel = pusherClient.subscribe(`room-${roomId}`)
    channelRef.current = channel

    // STUB: Phase 2 binds events here, e.g.:
    // channel.bind('participant-joined', handler)
    // channel.bind('vote-revealed', handler)

    return () => {
      channel.unbind_all()
      pusherClient.unsubscribe(`room-${roomId}`)
      channelRef.current = null
    }
  }, [roomId])

  return { channel: channelRef.current }
}
