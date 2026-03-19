// types/room.ts

export type RoomData = {
  roomId: string
  hostToken: string        // SHA-256 hash stored in Redis
  revealed: boolean
  voteCount: number
  currentStory: string
  createdAt: number        // Unix timestamp ms
}

export type ParticipantData = {
  participantId: string    // Server-assigned UUID — primary key
  name: string             // Display name — never used as a key
  role: 'voter' | 'observer'
  joinedAt: string         // ISO timestamp
}

export type ParticipantView = {
  participantId: string
  name: string
  role: 'voter' | 'observer'
  hasVoted: boolean
  value?: string           // Only present when room.revealed === true
}

export type RoomView = {
  roomId: string
  currentStory: string
  revealed: boolean
  participants: ParticipantView[]
}

// Response type for GET /api/rooms/[roomId] — extends RoomView with client-specific fields
// isHost and myParticipantId are derived at request time, not stored in Redis
export type RoomPageResponse = RoomView & {
  myParticipantId: string | null
  isHost: boolean
}

// LogEntry: one completed story logged to Redis list (room:{roomId}:log)
// Added in Phase 3 Plan 01 stubs; used by GET /api/rooms/[roomId] (log field) and clipboard
export type LogEntry = { story: string; estimate: string }
