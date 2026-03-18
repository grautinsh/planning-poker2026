# Phase 1: Foundation - Research

**Researched:** 2026-03-18
**Domain:** Next.js App Router infrastructure — room creation, identity, Redis schema, Pusher skeleton
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | Host can create a room and receive a shareable URL | Room creation API (POST /api/rooms), nanoid for short ID, redirect to /room/[roomId] |
| SESS-02 | Room creation issues a host token stored in an httpOnly cookie, allowing host to reclaim controls after tab reload | `next/headers` cookies() API in Route Handler — confirmed via Next.js 16 official docs |
| SESS-03 | Rooms automatically expire after 24 hours (Redis TTL — no manual cleanup) | Upstash `hset` + `expire(key, 86400)` — standard Redis pattern, confirmed via Upstash docs |
| IDNT-01 | Participant can join a room by entering only a display name (no account or login required) | POST /api/rooms/[roomId]/join with `{ name }` body — no auth dependency |
| IDNT-02 | Server assigns a UUID to each participant at join time; UUID is the primary key for vote tracking | `crypto.randomUUID()` in Route Handler — built into Node 18+, no dependency needed |
</phase_requirements>

---

## Summary

Phase 1 establishes the data model, identity rules, and API surface that every subsequent phase depends on. The work divides into three concerns: (1) the Redis schema — defining key names, hash fields, and TTL rules so later phases have a stable contract to build against; (2) the identity layer — generating and persisting host tokens and participant UUIDs so Phase 2 voting and host controls have correct keys from day one; and (3) the Pusher channel skeleton — creating and subscribing to channels so Phase 2 can layer events on top without architectural rework.

Two data model rules that appear simple but are load-bearing must be baked in during this phase. First, the votes hash (`room:{roomId}:votes`) must never be returned by any GET endpoint while `revealed: false` — the server must apply a serialization filter. Even though no votes exist yet, the filtering logic must be present so it cannot be forgotten when vote submission is added. Second, participant identity is a server-assigned UUID stored in a cookie, never the display name. The join API must return a `participantId` and set it as an httpOnly cookie in the same response.

For cookies, the `next/headers` `cookies()` function from Next.js core is the correct approach for Route Handlers — it is async in Next.js 15+/16 and supports all standard options including `httpOnly`, `secure`, `sameSite`, and `maxAge`. The `cookies-next` package was specified in the stack but its primary value is for client components; Route Handlers should use the built-in API. For Upstash Redis, the key-level TTL pattern is `redis.hset(key, fields)` followed by `redis.expire(key, 86400)` — not the newer field-level `HEXPIRE` which is per-field and unnecessary for whole-session expiry.

**Primary recommendation:** Build strictly in dependency order: Redis schema and `lib/room.ts` model first, then room creation API, then join API, then Pusher skeleton, then the room page UI. Nothing should be built against undefined types.

---

## Standard Stack

### Core (Phase 1 relevant)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.0 | Framework — App Router, Route Handlers | Native Vercel target; Route Handlers replace Express-style API endpoints |
| TypeScript | 5.9.3 | Type safety | Catches event-shape and Redis key bugs early; mandatory for this codebase |
| @upstash/redis | 1.37.0 | Session state (Redis over HTTP) | HTTP-based — works in serverless without TCP connection pooling issues; no Vercel KV needed |
| pusher | 5.3.3 | Server-side Pusher client | Trigger events from Route Handlers after state mutations |
| pusher-js | 8.4.2 | Browser Pusher client | Subscribe to channels in client components |
| nanoid | 5.1.7 | Room ID generation | Short, URL-safe, collision-resistant; ESM-only, works natively in App Router |
| zod | 4.3.6 | API payload validation | Parse and validate join/create request bodies; zod v4 requires TS 5.x |
| next/headers cookies() | built-in | httpOnly cookies in Route Handlers | Native async API in Next.js 15+/16; correct approach for server-side cookie setting |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cookies-next | 6.1.1 | Cookie access in client components | Use only in `"use client"` components that need to read the participantId cookie |
| zustand | 5.0.12 | Client state management | Not needed in Phase 1 (no UI state to manage yet); set up store shape for Phase 2 |
| Vitest | latest | Unit tests | Test room model helpers (ID generation, serialization, TTL logic) in isolation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next/headers` cookies() | cookies-next | cookies-next adds a dependency for something Next.js provides natively; reserve cookies-next for client component use |
| `crypto.randomUUID()` | uuid package | Built into Node 18+; no package needed for participantId generation |
| nanoid | uuid | uuid generates 36-char strings; nanoid generates 8-21-char URL-safe IDs — better for room URLs |

**Installation (Phase 1 packages only):**
```bash
npx create-next-app@latest planning-poker --typescript --tailwind --app
npm install pusher pusher-js @upstash/redis nanoid zod
npm install -D vitest @vitest/coverage-v8
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 deliverables)

```
src/
├── app/
│   ├── page.tsx                        # Landing page — Create Room button
│   ├── room/
│   │   └── [roomId]/
│   │       └── page.tsx                # Room page (static shell in Phase 1)
│   └── api/
│       └── rooms/
│           ├── route.ts                # POST /api/rooms — create room
│           └── [roomId]/
│               ├── route.ts            # GET /api/rooms/[roomId] — read state
│               └── join/
│                   └── route.ts        # POST /api/rooms/[roomId]/join
├── lib/
│   ├── redis.ts                        # Upstash Redis client singleton
│   ├── pusher.ts                       # Pusher server client singleton
│   ├── room.ts                         # Room model: types, schema, read/write helpers
│   └── auth.ts                         # Host token: generate, hash, validate
├── hooks/
│   └── useRoom.ts                      # Pusher subscription skeleton (stub in Phase 1)
└── types/
    └── room.ts                         # Shared TS types: Room, Participant, RoomView
tests/
├── lib/
│   ├── room.test.ts                    # Room model unit tests
│   └── auth.test.ts                    # Token generation / validation tests
```

### Pattern 1: Redis Hash + Key-Level TTL

**What:** Store all room metadata in a single Redis hash. Set the TTL on the key itself (not on individual fields) so the entire room expires after 24 hours.

**When to use:** Every room creation. Also re-apply TTL on any significant room activity to slide the expiry window.

**Example:**
```typescript
// lib/room.ts
import { redis } from './redis'

const ROOM_TTL_SECONDS = 24 * 60 * 60  // 24 hours

export async function createRoom(roomId: string, hostTokenHash: string) {
  const key = `room:${roomId}`
  await redis.hset(key, {
    hostToken: hostTokenHash,
    revealed: 'false',
    voteCount: '0',
    currentStory: '',
    createdAt: Date.now().toString(),
  })
  // Key-level TTL — entire hash expires after 24h
  await redis.expire(key, ROOM_TTL_SECONDS)
  // Votes hash TTL
  await redis.expire(`room:${roomId}:votes`, ROOM_TTL_SECONDS)
}
```

### Pattern 2: Redacted Serialization View (Vote Hiding Baked In)

**What:** The GET /api/rooms/[roomId] response must never include vote values while `revealed: false`. Implement the serialization filter now so the rule is structurally enforced before voting is added.

**When to use:** Every GET endpoint that returns room state. Also in all future broadcast payloads.

**Example:**
```typescript
// lib/room.ts
export type RoomView = {
  roomId: string
  currentStory: string
  revealed: boolean
  participants: ParticipantView[]
}

export type ParticipantView = {
  participantId: string
  name: string
  hasVoted: boolean
  // vote value is intentionally absent when revealed=false
  value?: string
}

export function toRoomView(room: RoomData, participants: ParticipantData[], votes: Record<string, string>): RoomView {
  return {
    roomId: room.roomId,
    currentStory: room.currentStory,
    revealed: room.revealed,
    participants: participants.map(p => ({
      participantId: p.participantId,
      name: p.name,
      hasVoted: p.participantId in votes,
      // Only include value when revealed
      ...(room.revealed ? { value: votes[p.participantId] } : {}),
    }))
  }
}
```

### Pattern 3: httpOnly Cookie for Host Token (using next/headers)

**What:** At room creation, generate a random host token, store a hash of it in Redis, and set the raw token in an httpOnly cookie in the Route Handler response. On subsequent requests, read the cookie and compare the hash.

**When to use:** Room creation (set cookie) and any host-gated action (validate cookie).

**Critical note:** `cookies()` from `next/headers` is async in Next.js 16. Always `await` it.

**Example:**
```typescript
// app/api/rooms/route.ts
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'
import { createRoom } from '@/lib/room'
import { hashToken } from '@/lib/auth'

export async function POST() {
  const roomId = nanoid(8)
  const hostToken = crypto.randomUUID()
  const tokenHash = await hashToken(hostToken)

  await createRoom(roomId, tokenHash)

  const cookieStore = await cookies()
  cookieStore.set(`host-token-${roomId}`, hostToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60,  // matches room TTL
    path: '/',
  })

  return Response.json({ roomId, shareUrl: `/room/${roomId}` })
}
```

### Pattern 4: Server-Assigned participantId at Join

**What:** Route Handler generates a UUID for every participant at join time and sets it as an httpOnly cookie. This cookie serves as the participant's identity token for vote submission.

**When to use:** POST /api/rooms/[roomId]/join.

**Example:**
```typescript
// app/api/rooms/[roomId]/join/route.ts
import { cookies } from 'next/headers'
import { joinRoom } from '@/lib/room'

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const body = await req.json()
  const { name } = joinSchema.parse(body)  // zod validation

  const participantId = crypto.randomUUID()
  await joinRoom(roomId, participantId, name)

  const cookieStore = await cookies()
  cookieStore.set(`participant-${roomId}`, participantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60,
    path: '/',
  })

  // Trigger Pusher broadcast (skeleton — no handler yet)
  await pusherServer.trigger(`room-${roomId}`, 'participant-joined', {
    participantId,
    name,
  })

  return Response.json({ participantId, name })
}
```

### Pattern 5: Pusher Server Client Singleton

**What:** Create the Pusher server client once as a singleton to avoid re-instantiation on every Route Handler invocation.

**When to use:** Import `pusherServer` from `lib/pusher.ts` in all Route Handlers that trigger events.

**Example:**
```typescript
// lib/pusher.ts
import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})
```

```typescript
// lib/pusher-client.ts (client-side singleton)
import PusherClient from 'pusher-js'

export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! }
)
```

### Pattern 6: Route Handler params are a Promise in Next.js 15+

**What:** In Next.js 15+, the `params` argument to Route Handlers is a Promise and must be awaited before destructuring.

**When to use:** Every Route Handler with dynamic segments like `[roomId]`.

**Example:**
```typescript
// CORRECT for Next.js 15+/16
export async function GET(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  // ...
}

// WRONG — causes TypeScript error in Next.js 16
export async function GET(req: Request, { params }: { params: { roomId: string } }) {
  const { roomId } = params  // params is a Promise, not an object
}
```

### Anti-Patterns to Avoid

- **Using display name as participant key:** The participant list and vote hash must be keyed by `participantId` UUID. Never use `name` as a Map or Redis hash key.
- **Setting cookies via Response headers manually:** Use `cookies()` from `next/headers` in Route Handlers, not `new Response(null, { headers: { 'Set-Cookie': '...' } })` — the latter bypasses Next.js cookie management.
- **Using `cookies-next` in Route Handlers:** cookies-next is for client components. Route Handlers have access to `next/headers` natively.
- **Setting HEXPIRE on individual fields instead of key-level EXPIRE:** For session expiry, use `redis.expire(key, seconds)` on the whole hash key. Field-level expiry (HEXPIRE) is for per-field TTL which is not needed here.
- **Storing raw host token in Redis:** Hash the token before storage (`crypto.subtle.digest` or `bcrypt`). Store only the hash in Redis; validate by re-hashing the cookie value.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Short URL-safe IDs | Custom random string generator | nanoid | Handles URL-safe charset, correct entropy, and collision resistance; 3 lines vs. a page of custom code |
| Payload schema validation | Manual `if (!body.name)` checks | zod | Handles type coercion, missing fields, wrong types, nested objects; custom validation misses edge cases |
| Cookie serialization | `document.cookie` string manipulation | `next/headers` cookies() | Next.js manages Set-Cookie header, path, domain, sameSite; manual header strings are error-prone |
| Redis key naming | Ad hoc strings in each Route Handler | `lib/room.ts` key helpers | Prevents typos and key namespace collisions across routes; single source of truth |
| Participant uniqueness | Name deduplication logic | UUID + cookie | Server-assigned UUID sidesteps the entire name collision problem |

**Key insight:** In this domain, the standard libraries handle correctness edge cases that are easy to miss (URL-safe charset in IDs, cookie attribute interactions, Redis key conflicts). Custom solutions almost always fail on edge cases.

---

## Common Pitfalls

### Pitfall 1: params not awaited in Route Handlers (Next.js 15+/16)
**What goes wrong:** TypeScript complains at `params.roomId` because params is typed as a Promise. Runtime error: `Cannot read properties of undefined (reading 'roomId')`.
**Why it happens:** Next.js 15 changed params and searchParams from synchronous objects to Promises.
**How to avoid:** Always type params as `Promise<{ roomId: string }>` and `await params` before destructuring.
**Warning signs:** TypeScript error on `params.roomId`; works in Next.js 14 but fails in 15+/16.

### Pitfall 2: Vote Values Visible Before Reveal (Information Leakage)
**What goes wrong:** GET /api/rooms/[roomId] returns vote values to any client who calls it during the voting phase. Anyone can inspect the network tab and see all votes before reveal.
**Why it happens:** Developer returns the full Redis `votes` hash without a serialization filter.
**How to avoid:** Implement `toRoomView()` that strips vote values when `revealed: false`. Apply this filter in every GET response and every Pusher broadcast payload. **This must exist in Phase 1 even though no votes are cast yet.**
**Warning signs:** The `room:votes` hash data appears in the network tab response for non-host clients during voting.

### Pitfall 3: Host Token Stored Raw in Redis
**What goes wrong:** If Redis is compromised (or a typo exposes the key), an attacker can extract the host token and forge host identity.
**Why it happens:** The cookie and the Redis-stored value are both the same token.
**How to avoid:** Store a hash of the token in Redis (e.g., `crypto.subtle.digest('SHA-256', token)`). Validate by re-hashing the cookie value and comparing. The raw token only lives in the httpOnly cookie.

### Pitfall 4: TTL Not Set on Redis Keys
**What goes wrong:** Rooms accumulate indefinitely in Redis. Upstash free tier (10k commands/day) gets exhausted by stale rooms; SESS-03 requirement is unmet.
**Why it happens:** Developer sets the hash fields but forgets to call `expire()` on the key.
**How to avoid:** Create a `createRoom()` helper in `lib/room.ts` that always calls `expire()` immediately after `hset()`. Never call `hset` for room keys outside this helper.
**Warning signs:** No `EXPIRE` or `TTL` calls visible in `lib/room.ts`; Redis key count grows unboundedly.

### Pitfall 5: Multiple participantIds for Same Browser Tab
**What goes wrong:** Participant joins, refreshes, and now has two entries in the room — one from the original join cookie and a new one from a second join. The vote hash has two entries for the same person.
**Why it happens:** The join endpoint always creates a new UUID without checking for an existing cookie.
**How to avoid:** At join time, check the request cookies for an existing `participant-{roomId}` cookie. If present, validate it against the Redis participant list and return the existing identity rather than creating a new one. This is the minimal reconnect path needed in Phase 1 (full reconnect/rejoin-by-name is Phase 4, but basic cookie-based re-use must be in Phase 1).
**Warning signs:** Participant count increases on every page refresh.

### Pitfall 6: Not Setting Pusher Channel Naming Convention Now
**What goes wrong:** Phase 2 assumes channel names like `room-{roomId}` but Phase 1 built skeleton with `presence-room-{roomId}`. Renaming after Phase 2 is built requires touching both server and client code.
**How to avoid:** Decide on the channel naming convention in Phase 1 and put it in a constant in `lib/pusher.ts`. In Phase 1, the skeleton channel type is a regular (public) channel `room-{roomId}`. Phase 2 can upgrade to a presence channel when auth is wired.

---

## Code Examples

Verified patterns from official sources:

### Redis Client Singleton
```typescript
// Source: @upstash/redis standard pattern
// lib/redis.ts
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
```

### Upstash Redis: hset + expire (key-level TTL)
```typescript
// Source: Upstash documentation — key-level expiration
// CORRECT: key-level TTL (entire hash expires)
await redis.hset(`room:${roomId}`, { field: 'value' })
await redis.expire(`room:${roomId}`, 86400)  // 24 hours in seconds

// NOT for this use case: field-level TTL (individual fields expire)
// await redis.hexpire(`room:${roomId}`, 60, 'field1')  -- per-field, not per-session
```

### Next.js Route Handler: Setting httpOnly Cookie (Next.js 16)
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/cookies (confirmed 2026-03-03)
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()  // async in Next.js 15+/16
  cookieStore.set({
    name: 'host-token-abc123',
    value: crypto.randomUUID(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400,
    path: '/',
  })
  return Response.json({ ok: true })
}
```

### Reading a Cookie in a Route Handler
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/cookies
import { cookies } from 'next/headers'

export async function GET(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const cookieStore = await cookies()
  const hostToken = cookieStore.get(`host-token-${roomId}`)?.value
  // validate hostToken against Redis hash...
}
```

### Pusher trigger in Route Handler
```typescript
// Source: Pusher + Next.js App Router pattern (MEDIUM — confirmed pattern, specific import may vary)
import { pusherServer } from '@/lib/pusher'

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  // ... mutate Redis ...
  await pusherServer.trigger(`room-${roomId}`, 'participant-joined', {
    participantId,
    name,
  })
  return Response.json({ participantId })
}
```

### Zod Schema for Join Request (zod v4)
```typescript
// Source: zod v4 documentation (zod.dev)
import { z } from 'zod/v4'  // zod v4 import path

const joinSchema = z.object({
  name: z.string().min(1).max(32).trim(),
})

// In Route Handler:
const body = await req.json()
const parsed = joinSchema.safeParse(body)
if (!parsed.success) {
  return Response.json({ error: parsed.error.flatten() }, { status: 400 })
}
```

---

## Redis Schema (Authoritative)

The Redis key namespace for this application. Define in `lib/room.ts` — all Route Handlers import key helpers from here.

```
room:{roomId}                      Hash — room metadata
  hostToken: string                SHA-256 hash of raw token (never raw)
  revealed: 'false'|'true'         String (Redis hashes store strings)
  voteCount: string                Stringified integer
  currentStory: string
  createdAt: string                Unix timestamp ms
  [TTL: 86400 seconds]

room:{roomId}:votes                Hash — vote values (NEVER read when revealed=false)
  {participantId}: string          Vote value as string
  [TTL: 86400 seconds]

room:{roomId}:participants         Hash — participant metadata
  {participantId}: string          JSON-encoded { name, role, joinedAt }
  [TTL: 86400 seconds]

room:{roomId}:log                  List — agreed estimates (Phase 3)
  [{ story, estimate, timestamp }] JSON-encoded entries, prepend with LPUSH
  [TTL: 86400 seconds — matches room, not longer]
```

**Key helpers to implement in `lib/room.ts`:**
```typescript
export const keys = {
  room: (roomId: string) => `room:${roomId}`,
  votes: (roomId: string) => `room:${roomId}:votes`,
  participants: (roomId: string) => `room:${roomId}:participants`,
  log: (roomId: string) => `room:${roomId}:log`,
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel KV (`@vercel/kv`) | `@upstash/redis` directly | Dec 2024 | Vercel KV deprecated; must use Upstash SDK; connection strings differ |
| `cookies()` synchronous | `cookies()` async (await required) | Next.js 15.0 | Must `await cookies()` in Route Handlers; sync usage deprecated |
| `params` as plain object | `params` as Promise | Next.js 15.0 | Must `await params` before destructuring in Route Handlers |
| nanoid CommonJS | nanoid ESM-only | nanoid v4 | App Router handles ESM natively; no special config needed |
| zod v3 import: `import { z } from 'zod'` | zod v4 import: `import { z } from 'zod/v4'` | zod v4.0 | New import path; v4 requires TypeScript 5.x |

**Deprecated/outdated:**
- `@vercel/kv`: Discontinued Dec 2024. Do not use. Use `@upstash/redis` with UPSTASH_REDIS_REST_URL + TOKEN env vars.
- Synchronous `cookies()` call: Still works in Next.js 16 for backward compat, but deprecated. Always use `await`.
- `params` as synchronous object: TypeScript will reject this in Next.js 16 strict mode.

---

## Open Questions

1. **zod v4 import path**
   - What we know: zod v4.3.6 is in the stack; the import path changed to `zod/v4`
   - What's unclear: Whether the top-level `zod` import still re-exports v4 in the published package
   - Recommendation: Use `import { z } from 'zod/v4'` explicitly to be safe; verify against the installed package `node_modules/zod/package.json` during setup

2. **Token hashing: crypto.subtle vs. bcrypt**
   - What we know: Host token validation can use SHA-256 (fast, no dep) or bcrypt (slow, adds dep)
   - What's unclear: Whether timing-safe comparison matters for this use case (host token is random UUID, not a password)
   - Recommendation: Use `crypto.subtle.digest('SHA-256', ...)` with a constant-time comparison (`timingSafeEqual` from Node crypto). Avoids a bcrypt dependency for a token that isn't a password.

3. **Pusher channel type in Phase 1 skeleton**
   - What we know: Phase 2 needs presence channels (requires auth endpoint `/api/pusher/auth`); Phase 1 only needs to establish the skeleton
   - What's unclear: Whether it's better to wire the presence channel auth endpoint now or stub with a public channel
   - Recommendation: Use a public channel `room-{roomId}` in Phase 1 skeleton. Document that Phase 2 will upgrade to presence channel `presence-room-{roomId}`. Avoids wiring the auth endpoint before it's needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest) |
| Config file | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | POST /api/rooms returns roomId and shareUrl; roomId is 8-char alphanumeric | unit | `npx vitest run tests/lib/room.test.ts -t "createRoom"` | Wave 0 |
| SESS-01 | Redis hash is created with correct fields after createRoom() | unit | `npx vitest run tests/lib/room.test.ts -t "redis schema"` | Wave 0 |
| SESS-02 | POST /api/rooms sets httpOnly cookie named `host-token-{roomId}` in response | unit | `npx vitest run tests/api/rooms.test.ts -t "host token cookie"` | Wave 0 |
| SESS-02 | Host token cookie survives page reload (reads back same value from subsequent request) | unit | `npx vitest run tests/lib/auth.test.ts -t "token roundtrip"` | Wave 0 |
| SESS-03 | Redis key has TTL of 86400 seconds after room creation | unit | `npx vitest run tests/lib/room.test.ts -t "TTL"` | Wave 0 |
| IDNT-01 | POST /api/rooms/[roomId]/join with { name } succeeds and returns participantId | unit | `npx vitest run tests/api/join.test.ts -t "join"` | Wave 0 |
| IDNT-02 | Server assigns UUID to participant; UUID stored in Redis; display name is not the key | unit | `npx vitest run tests/lib/room.test.ts -t "participantId"` | Wave 0 |
| IDNT-02 | GET /api/rooms/[roomId] never returns vote values when revealed=false | unit | `npx vitest run tests/lib/room.test.ts -t "toRoomView redacted"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/room.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — Vitest configuration with path aliases matching tsconfig
- [ ] `tests/lib/room.test.ts` — covers SESS-01, SESS-03, IDNT-02 (room model, TTL, serialization filter)
- [ ] `tests/lib/auth.test.ts` — covers SESS-02 (token hash/validate roundtrip)
- [ ] `tests/api/rooms.test.ts` — covers SESS-01, SESS-02 (route handler integration test with mocked Redis/Pusher)
- [ ] `tests/api/join.test.ts` — covers IDNT-01, IDNT-02 (join route with mocked Redis)
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8` — if not already installed

---

## Sources

### Primary (HIGH confidence)
- [Next.js cookies() API Reference](https://nextjs.org/docs/app/api-reference/functions/cookies) — confirmed async API, httpOnly options, Route Handler usage (last updated 2026-03-03, Next.js v16.2.0)
- [Upstash Redis expiration commands (DeepWiki)](https://deepwiki.com/upstash/redis-js/4.7-expiration-commands) — confirmed `hset` + `expire` key-level TTL pattern; `hexpire` for field-level
- npm registry (live) — all package versions confirmed
- Vercel official docs — WebSocket restriction, KV deprecation (from domain PITFALLS.md)

### Secondary (MEDIUM confidence)
- [Pusher + Next.js App Router integration (Medium)](https://selcuk00.medium.com/how-to-use-pusher-in-next-js-app-router-1132b8ddf3b5) — `pusher.trigger()` pattern in Route Handlers confirmed
- [Upstash Redis + Next.js tutorial](https://upstash.com/docs/redis/tutorials/nextjs_with_redis) — HTTP-based client singleton pattern
- Training data (Aug 2025) — Pusher server/client singleton pattern, zod validation in Route Handlers

### Tertiary (LOW confidence)
- zod v4 import path (`zod/v4`) — based on zod changelog knowledge; verify against installed package during setup
- Next.js 16 specific behaviors — released after knowledge cutoff; Next.js docs confirmed current as of 2026-03-03

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions from npm registry; cookie API confirmed via live Next.js docs
- Architecture: HIGH — patterns from official docs and established serverless conventions
- Pitfalls: HIGH — Next.js 15+ async params/cookies from official docs; TTL pattern from Upstash docs
- Validation Architecture: MEDIUM — Vitest setup is standard but test files don't exist yet

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable dependencies; Next.js docs confirmed current)
