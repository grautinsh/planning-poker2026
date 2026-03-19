// lib/room.ts
import { redis } from './redis'
import type { RoomData, ParticipantData, ParticipantView, RoomView, LogEntry } from '@/types/room'

export const ROOM_TTL_SECONDS = 24 * 60 * 60  // 86400

// Key helpers — single source of truth for Redis key names
export const keys = {
  room: (roomId: string) => `room:${roomId}`,
  votes: (roomId: string) => `room:${roomId}:votes`,
  participants: (roomId: string) => `room:${roomId}:participants`,
  log: (roomId: string) => `room:${roomId}:log`,
}

export async function createRoom(roomId: string, hostTokenHash: string): Promise<void> {
  const key = keys.room(roomId)
  await redis.hset(key, {
    hostToken: hostTokenHash,
    revealed: 'false',
    voteCount: '0',
    currentStory: '',
    createdAt: Date.now().toString(),
  })
  // Key-level TTL — entire hash expires after 24h
  // Apply TTL to all four key types now to prevent any key from persisting without expiry
  await redis.expire(key, ROOM_TTL_SECONDS)
  await redis.expire(keys.votes(roomId), ROOM_TTL_SECONDS)
  await redis.expire(keys.participants(roomId), ROOM_TTL_SECONDS)
  await redis.expire(keys.log(roomId), ROOM_TTL_SECONDS)
}

export async function joinRoom(
  roomId: string,
  participantId: string,
  name: string,
  role: 'voter' | 'observer' = 'voter'
): Promise<void> {
  const participant: ParticipantData = {
    participantId,  // UUID — the key, NOT the display name
    name,
    role,
    joinedAt: new Date().toISOString(),
  }
  // Store JSON-encoded participant at UUID key — display name is NEVER the key
  await redis.hset(keys.participants(roomId), {
    [participantId]: JSON.stringify(participant),
  })
}

export function toRoomView(
  room: RoomData,
  participants: ParticipantData[],
  votes: Record<string, string>
): RoomView {
  return {
    roomId: room.roomId,
    currentStory: room.currentStory,
    revealed: room.revealed,
    participants: participants.map((p): ParticipantView => ({
      participantId: p.participantId,
      name: p.name,
      role: p.role,
      hasVoted: p.participantId in votes,
      // CRITICAL: value is ONLY included when room.revealed === true
      // This is the serialization filter that enforces anti-anchoring
      ...(room.revealed ? { value: votes[p.participantId] } : {}),
    })),
  }
}

export async function getRoom(roomId: string): Promise<RoomData | null> {
  const raw = await redis.hgetall(keys.room(roomId))
  if (!raw || !raw.hostToken) return null
  return {
    roomId,
    hostToken: raw.hostToken as string,
    revealed: raw.revealed === true || raw.revealed === 'true',
    voteCount: parseInt(raw.voteCount as string ?? '0', 10),
    currentStory: (raw.currentStory as string) ?? '',
    createdAt: parseInt(raw.createdAt as string ?? '0', 10),
  }
}

export async function getParticipants(roomId: string): Promise<ParticipantData[]> {
  const raw = await redis.hgetall(keys.participants(roomId))
  if (!raw) return []
  return Object.values(raw)
    .map(v => typeof v === 'string' ? JSON.parse(v) : v as ParticipantData)
    .sort((a, b) => a.joinedAt - b.joinedAt)
}

export async function getLog(roomId: string): Promise<LogEntry[]> {
  const raw = await redis.lrange(keys.log(roomId), 0, -1)
  if (!raw || raw.length === 0) return []
  return raw.map(v => typeof v === 'string' ? JSON.parse(v) : v as LogEntry)
}
