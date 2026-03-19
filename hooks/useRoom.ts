'use client'

import { useEffect, useRef, useState } from 'react'
import { pusherClient } from '@/lib/pusher-client'

export function useRoom(roomId: string, onEvent: () => void) {
  const channelRef = useRef<ReturnType<typeof pusherClient.subscribe> | null>(null)
  const [isDisconnected, setIsDisconnected] = useState(false)

  useEffect(() => {
    if (!roomId) return

    const channel = pusherClient.subscribe(`room-${roomId}`)
    channelRef.current = channel

    channel.bind('participant-joined', onEvent)
    channel.bind('vote-cast', onEvent)
    channel.bind('story-updated', onEvent)
    channel.bind('vote-revealed', onEvent)
    channel.bind('round-reset', onEvent)
    channel.bind('story-logged', onEvent)

    const handleStateChange = ({ current }: { previous: string; current: string }) => {
      if (current === 'unavailable') setIsDisconnected(true)
      if (current === 'connected') setIsDisconnected(false)
    }
    pusherClient.connection.bind('state_change', handleStateChange)

    return () => {
      channel.unbind_all()
      pusherClient.unsubscribe(`room-${roomId}`)
      channelRef.current = null
      pusherClient.connection.unbind('state_change', handleStateChange)
    }
  }, [roomId, onEvent])

  return { channel: channelRef.current, isDisconnected }
}
