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
