# Architecture Research

**Domain:** Real-time collaborative web app (planning poker / estimation sessions)
**Researched:** 2026-03-18
**Confidence:** HIGH (Vercel constraints from official docs; patterns from well-established real-time app architecture)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser Clients                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Host Client │  │ Voter Client │  │Observer Client│              │
│  │  (React UI)  │  │  (React UI)  │  │  (React UI)  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                      │
│         └─────────────────┼──────────────────┘                     │
│                           │                                         │
│             REST (HTTP) ──┤── Real-time (WebSocket)                 │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
        ┌───────────────────┼──────────────────────┐
        │                  │                       │
        ▼                  ▼                       ▼
┌──────────────┐   ┌───────────────┐   ┌──────────────────┐
│  Next.js API │   │  Real-time    │   │  Upstash Redis   │
│  Routes      │   │  Service      │   │  (session state) │
│  (Vercel     │   │  (Supabase    │   │                  │
│  Functions)  │   │  Realtime or  │   │  Room data,      │
│              │   │  Pusher/Ably) │   │  votes, story    │
│  - create    │   │               │   │  log — ephemeral │
│  - join      │   │  - channels   │   │  with TTL        │
│  - vote      │   │  - broadcast  │   │                  │
│  - reveal    │   │  - presence   │   └──────────────────┘
│  - log story │   │               │
└──────────────┘   └───────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React UI (client) | Render room state, handle user actions, display real-time updates | Next.js App Router + React hooks |
| API Routes (serverless) | Mutate state (create room, cast vote, reveal, save story) | Next.js Route Handlers on Vercel Functions |
| Real-time Service | Push state-change events to all connected clients in a room | Supabase Realtime Broadcast or Pusher Channels |
| Session State Store | Hold authoritative room state between stateless function invocations | Upstash Redis (via Vercel Marketplace) |
| Host Identity Token | Prove a browser tab is the room host without user accounts | Secure random token in httpOnly cookie, stored alongside room in Redis |

## Recommended Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing — create room CTA
│   ├── room/
│   │   └── [roomId]/
│   │       └── page.tsx        # Main room UI (host + voter views)
│   └── api/
│       ├── rooms/
│       │   └── route.ts        # POST /api/rooms — create room
│       ├── rooms/[roomId]/
│       │   ├── route.ts        # GET state, DELETE room
│       │   ├── join/route.ts   # POST — register participant
│       │   ├── vote/route.ts   # POST — submit hidden vote
│       │   ├── reveal/route.ts # POST — flip all votes (host only)
│       │   ├── reset/route.ts  # POST — clear votes for re-vote
│       │   ├── story/route.ts  # POST — set current story title
│       │   └── log/route.ts    # POST — save agreed estimate to log
├── components/
│   ├── room/
│   │   ├── CardDeck.tsx        # Fibonacci card picker
│   │   ├── VoteGrid.tsx        # Participant vote display (hidden/revealed)
│   │   ├── ParticipantList.tsx # Who's in the room, vote status
│   │   ├── StoryPanel.tsx      # Current story title display
│   │   ├── HostControls.tsx    # Reveal / Reset / Next story / Log estimate
│   │   └── SessionLog.tsx      # Saved estimates list
│   └── ui/                     # Generic UI primitives (buttons, cards, etc.)
├── lib/
│   ├── redis.ts                # Upstash Redis client singleton
│   ├── realtime.ts             # Real-time service client (Supabase/Pusher)
│   ├── room.ts                 # Room data model + Redis read/write helpers
│   └── auth.ts                 # Host token generation + validation
├── hooks/
│   ├── useRoom.ts              # Subscribe to real-time channel, local state
│   └── useHostToken.ts         # Read/write host token from cookie
└── types/
    └── room.ts                 # Shared TypeScript types (Room, Participant, Vote)
```

### Structure Rationale

- **app/api/**: Each action is a discrete serverless function — stateless, short-lived, safe on Vercel
- **lib/room.ts**: Centralises all Redis schema knowledge so API routes don't scatter key logic
- **hooks/useRoom.ts**: Single hook owns real-time subscription lifecycle; components just consume state
- **components/room/**: Isolated by domain so HostControls and CardDeck can be developed/tested independently

## Architectural Patterns

### Pattern 1: Event-Sourced State via Real-time Broadcast

**What:** API routes mutate Redis (authoritative state), then broadcast a lightweight event to the real-time channel. Clients receive the event, fetch updated state or apply the delta, and re-render.

**When to use:** Always — this is the core pattern for any serverless real-time app. The API owns writes; the real-time service owns delivery.

**Trade-offs:** Adds one network hop per mutation (API → Redis → broadcast). Acceptable for planning poker latency requirements. Eliminates need for clients to poll.

**Example:**
```typescript
// app/api/rooms/[roomId]/reveal/route.ts
export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  const { roomId } = params;
  // 1. Validate host token
  const isHost = await validateHostToken(req, roomId);
  if (!isHost) return new Response('Forbidden', { status: 403 });

  // 2. Mutate authoritative state in Redis
  await redis.hset(`room:${roomId}`, { revealed: true });

  // 3. Broadcast event — clients react
  await broadcastToRoom(roomId, { type: 'VOTES_REVEALED' });

  return new Response('OK');
}
```

### Pattern 2: Presence via Real-time Channel (Join/Leave Events)

**What:** When a participant connects, they join the room's real-time channel. The channel tracks connected members (presence). Join/leave events update the participant list for all clients without polling.

**When to use:** For "who is in the room" — avoid polling an API endpoint for participant list changes.

**Trade-offs:** Supabase Realtime Presence and Pusher both provide this natively. Presence state is ephemeral and lives in the real-time service, not Redis — a deliberate separation. If the real-time service goes down, Redis holds the canonical vote/story data.

**Example:**
```typescript
// hooks/useRoom.ts (client)
const channel = supabase.channel(`room:${roomId}`);
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState(); // { userId: [{ name, role }] }
    setParticipants(Object.values(state).flat());
  })
  .on('broadcast', { event: 'VOTES_REVEALED' }, () => {
    refetchRoomState(); // fetch full room state from API
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ name, role }); // announce self
    }
  });
```

### Pattern 3: Hidden Vote Isolation (Anti-Anchoring Guard)

**What:** Votes are stored in Redis keyed by participant. The `GET /api/rooms/[roomId]` endpoint returns vote *count* (how many have voted) but never the vote *values* until `revealed: true` is set. The reveal API flips that flag atomically.

**When to use:** This is the core product mechanic — votes must be hidden until reveal.

**Trade-offs:** Requires careful API design. The "has voted" boolean can be public; the value cannot. Return `{ hasVoted: true, value: null }` before reveal and `{ hasVoted: true, value: 8 }` after. Never return all values in the GET response unless revealed.

## Data Flow

### Vote Submission Flow

```
[Voter clicks card 8]
        ↓
[CardDeck component] → POST /api/rooms/{id}/vote { value: 8 }
        ↓
[API Route]
  - Validate participant token
  - Store in Redis: hset "room:{id}:votes" {participantId: "8"} (hidden)
  - Increment vote count: hset "room:{id}" {voteCount: N}
  - Broadcast: { type: "VOTE_CAST", participantId, hasVoted: true }
        ↓
[Real-time Service] → pushes event to all clients in room:{id} channel
        ↓
[All Clients receive VOTE_CAST]
  - Update participant list: mark participantId as "voted"
  - Do NOT reveal value — not in payload, not in state
```

### Vote Reveal Flow (Critical — Anti-Anchoring Mechanic)

```
[Host clicks "Reveal Votes"]
        ↓
POST /api/rooms/{id}/reveal
  - Validate host token (httpOnly cookie)
  - hset "room:{id}" { revealed: true }
  - hgetall "room:{id}:votes" → fetch all vote values
  - Broadcast: { type: "VOTES_REVEALED", votes: { p1: 8, p2: 5, p3: 13 } }
        ↓
[Real-time Service] → pushes event with all vote values simultaneously
        ↓
[All Clients receive VOTES_REVEALED at same time]
  - VoteGrid flips all cards simultaneously
  - Values are now visible to everyone including the host
  - No client saw values before this moment
```

**Key design decision:** Vote values are transmitted in the reveal broadcast payload (not fetched separately). This ensures true simultaneity — all clients flip at the same moment from the same event, not from staggered individual API fetches.

### Room Creation and Join Flow

```
[Host lands on home page]
        ↓
POST /api/rooms
  - Generate roomId (nanoid, 8 chars)
  - Generate hostToken (crypto.randomUUID)
  - Store in Redis: hset "room:{roomId}" { hostToken: hash(token), revealed: false, ... }
  - Set TTL: 24 hours (sessions are ephemeral)
  - Set hostToken in httpOnly cookie
  - Return { roomId, shareUrl }
        ↓
[Host shares URL: /room/{roomId}]
        ↓
[Participant opens URL, enters name]
        ↓
POST /api/rooms/{id}/join { name, role: "voter"|"observer" }
  - Generate participantId
  - Store in Redis: hset "room:{id}:participants:{pid}" { name, role }
  - Broadcast: { type: "PARTICIPANT_JOINED", participantId, name, role }
  - Return { participantId } in cookie
```

### Session State Management

```
Redis Schema (Upstash):
  room:{roomId}                    Hash — room metadata
    hostToken: <bcrypt hash>
    currentStory: "Story title"
    revealed: false|true
    voteCount: N
    createdAt: <unix timestamp>
    [TTL: 24 hours]

  room:{roomId}:votes              Hash — vote values (never exposed until revealed)
    {participantId}: "8"
    {participantId}: "13"
    [TTL: 24 hours]

  room:{roomId}:log                List — agreed estimates (append-only)
    [{ story: "Login flow", estimate: "8", timestamp }]
    [TTL: 7 days — log persists longer than session]

Client State (React — useRoom hook):
  - participants: Participant[]     from Presence channel
  - voteStatuses: Record<id, bool> from VOTE_CAST events
  - votes: Record<id, number>|null from VOTES_REVEALED event only
  - currentStory: string           from STORY_SET event / initial fetch
  - revealed: boolean              from local event handling
  - sessionLog: LogEntry[]         from initial fetch + LOG_SAVED events
```

## Scaling Considerations

This app targets 5-12 concurrent users per session. Scale is not a concern at MVP. However, the architecture handles modest growth cleanly:

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 concurrent sessions | No changes needed. Upstash Redis free tier + Supabase Realtime free tier sufficient. |
| 50-500 concurrent sessions | Monitor Redis connection count and Supabase Realtime channel limits. Upgrade tiers. No code changes required. |
| 500+ concurrent sessions | Add Redis connection pooling. Consider regional Vercel Function deployment to reduce latency. Still the same architecture. |

### Scaling Priorities

1. **First bottleneck:** Real-time service connection limits (Supabase free tier: 200 concurrent connections). Upgrade to paid or switch to Ably.
2. **Second bottleneck:** Redis read/write throughput. Upstash free tier is 10k commands/day — sufficient for low-volume team use; upgrade to pay-per-use plan at scale.

## Anti-Patterns

### Anti-Pattern 1: Storing Votes in Client State Before Reveal

**What people do:** Keep votes in React state on the host client, or transmit them to a "reveal when all voted" auto-trigger.

**Why it's wrong:** Any client-side state can be inspected via React DevTools or network tab. A participant could see others' votes before reveal, defeating the anti-anchoring purpose.

**Do this instead:** Store vote values exclusively in Redis. Transmit values only in the reveal broadcast event. The API GET endpoint never returns vote values while `revealed: false`.

### Anti-Pattern 2: Polling Instead of Real-time Events

**What people do:** Set an interval to `GET /api/rooms/{id}` every 2-3 seconds to check for updates.

**Why it's wrong:** Polling adds latency (up to interval length), burns Vercel function invocations unnecessarily, and creates a "stale state" window. For a 12-person session, 12 clients polling every 2s = 360 API calls/minute.

**Do this instead:** Use the real-time service for all state-change notifications. Reserve the GET endpoint for initial page load and reconnection recovery only.

### Anti-Pattern 3: Serverless Functions as WebSocket Servers

**What people do:** Attempt to keep a WebSocket connection open inside a Vercel Function.

**Why it's wrong:** Vercel serverless functions are request/response — they terminate after returning a response. Even with 300s max duration, a function holding a WebSocket open is both wasteful and unreliable (cold starts kill the connection).

**Do this instead:** Delegate all persistent connections to a managed real-time service (Supabase Realtime, Pusher, Ably). Your API routes are stateless HTTP handlers only.

### Anti-Pattern 4: Using Database Rows as Session State

**What people do:** Store session state in a SQL database (Postgres, etc.) and rely on polling or DB triggers for real-time.

**Why it's wrong:** Adds infrastructure complexity. Sessions are ephemeral; a relational DB with persistent rows is the wrong tool. Schema migrations for a 24-hour throwaway object are unnecessary overhead.

**Do this instead:** Redis with a TTL. Fast reads/writes, automatic expiry, no schema. Session log (longer-lived) can go in Redis as a List or — if you later add export features — be moved to a lightweight DB.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Realtime | Client SDK subscribes to channels; API routes call REST API to broadcast | Broadcast is server-triggered, Presence is client-managed. Free tier: 200 concurrent connections, 2M messages/month. HIGH confidence fit. |
| Upstash Redis | HTTP-based Redis client (`@upstash/redis`) from API routes | HTTP not TCP — works in serverless without connection pooling issues. Available via Vercel Marketplace. |
| Vercel Functions | All API routes deploy as serverless functions | Max 300s duration (Hobby). Stateless. No persistent connections. Must use external services for state and real-time. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React UI ↔ API Routes | REST over HTTPS (fetch) | Used for mutations and initial state load |
| React UI ↔ Real-time Service | WebSocket (managed by SDK) | Used for all push notifications |
| API Routes ↔ Redis | HTTP (Upstash client) | Authoritative state reads/writes |
| API Routes ↔ Real-time Service | HTTP REST (server-side broadcast trigger) | After mutations, API broadcasts the event |

## Suggested Build Order

Based on component dependencies:

1. **Redis schema + room model** (`lib/room.ts`, `lib/redis.ts`) — everything else depends on this
2. **Create room API** + **Join API** — foundation for any session
3. **Real-time channel setup** — `lib/realtime.ts` + `hooks/useRoom.ts` skeleton
4. **Room page UI** — static layout, presence list, connect to real-time
5. **Story management** — set current story title, broadcast to all
6. **Vote submission** — card deck UI + vote API (hidden vote storage)
7. **Vote reveal** — reveal API + simultaneous card flip mechanic (most complex state transition)
8. **Reset and re-vote** — clear votes, keep participants
9. **Session log** — save agreed estimate, display log

**Rationale for this order:** The reveal mechanic (step 7) is the highest-risk, most product-critical feature. Build the infrastructure (steps 1-4) and voting mechanics (steps 5-6) first so the reveal has a complete context to be tested in, rather than deferring it to the end where it becomes a scramble.

## Sources

- Vercel Functions max duration limits: https://vercel.com/docs/functions/configuring-functions/duration (confirmed: Hobby max 300s; no persistent WebSocket server possible)
- Vercel KV deprecation (moved to Upstash Redis): https://vercel.com/docs/redis (confirmed: Dec 2024 migration)
- Vercel streaming (confirms stateless, request/response model): https://vercel.com/docs/functions/streaming
- Supabase Realtime Broadcast and Presence: architecture based on established pub/sub patterns; Supabase uses Phoenix Channels under the hood (MEDIUM confidence — WebFetch blocked, but Supabase architecture is well-documented in public)
- Upstash Redis HTTP-based client: well-established pattern for serverless Redis access (MEDIUM confidence — WebFetch blocked; architecture is stable and widely documented)

---
*Architecture research for: Real-time planning poker web app (Vercel-hosted, serverless)*
*Researched: 2026-03-18*
