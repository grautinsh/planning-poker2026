'use client'

import { useEffect, useRef } from 'react'
import { pusherClient } from '@/lib/pusher-client'

export function useRoom(roomId: string, onEvent: () => void) {
  const channelRef = useRef<ReturnType<typeof pusherClient.subscribe> | null>(null)

  useEffect(() => {
    if (!roomId) return

    const channel = pusherClient.subscribe(`room-${roomId}`)
    channelRef.current = channel

    channel.bind('participant-joined', onEvent)
    channel.bind('vote-cast', onEvent)
    channel.bind('story-updated', onEvent)
    channel.bind('vote-revealed', onEvent)

    return () => {
      channel.unbind_all()
      pusherClient.unsubscribe(`room-${roomId}`)
      channelRef.current = null
    }
  }, [roomId, onEvent])

  return { channel: channelRef.current }
}
