# Phase 2: Real-Time Core - Research

**Researched:** 2026-03-19
**Domain:** Pusher Channels (real-time), Upstash Redis (atomic operations), CSS 3D transforms (card flip), Next.js 16 App Router (route handlers, cookies)
**Confidence:** HIGH (core stack verified against official docs and existing Phase 1 code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card deck layout**
- Horizontal card row at the bottom of the screen (single scrollable row)
- Selected card lifts/highlights — elevated shadow + colored border or fill, clearly distinguishes chosen card
- Fibonacci deck: 1, 2, 3, 5, 8, 13, 21, ∞, ?
- Participants can change their vote before reveal — clicking another card replaces the current vote (server stores latest only)
- Post-reveal: card deck disappears and is replaced by a post-reveal view; deck returns only after round reset (Phase 3)

**Observer experience**
- Observer badge displayed clearly at the top of their view — "Observer" label
- Card deck is NOT rendered for observers; no disabled cards shown
- Observers see all activity (participant list, vote status, reveal) but have no voting UI

**Participant list voted status**
- Card back icon (small face-down card icon) next to participant name when they have voted
- Replaces the current "Voted" text badge

**Vote feedback**
- After selecting a card: card stays highlighted (selected state), participant list updates to show card back icon for the voter
- No toast or snackbar — UI state is the confirmation

**Reveal animation**
- CSS 3D flip animation per card when reveal fires
- Slight stagger (50–100ms per card) — creates reveal drama without feeling slow
- Cards show face-down during voting phase, flip to values on reveal event

**Host controls panel**
- Sticky panel at top of the room page — always visible regardless of participant count
- Host sees: story title input (submit on Enter or button click), vote progress counter ("3 / 5 voted"), Reveal button
- Reveal button is disabled/grayed until at least 1 participant has voted
- Non-hosts see: current story title read-only at the top — no input, no Reveal button
- Story title is broadcast on explicit submit (Enter or button) — not auto-save on type

**Real-time update strategy**
- Pusher event fires → client calls GET /api/rooms/[roomId] → full state re-render
- No delta patching — consistent with the pattern established in Phase 1 (refreshRoom callback)
- Events to handle: participant-joined, vote-cast, story-updated, vote-revealed

**Connection indicator**
- None — keep UI clean. Pusher reconnects automatically; v1 does not surface connection state to users.

### Claude's Discretion
- Pusher channel type: public vs. presence (technical decision — requirements don't mandate Pusher presence; public channel + API refresh covers VOTE-03)
- Exact card flip CSS implementation (transform-style, perspective, backface-visibility)
- Reveal atomicity strategy (Lua script vs. pipeline for Redis multi-command reveal)
- Pusher event payload structure
- Card size, exact spacing, and color palette for selected state

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-04 | Host can enter a story title that is immediately broadcast and displayed to all participants | POST /api/rooms/[roomId]/story → hset currentStory → pusherServer.trigger('story-updated') → refreshRoom |
| IDNT-03 | Participant can choose to join as an observer (can see all activity but cannot vote) | joinRoom already accepts role param; join API needs `role` field in body; room page hides CardDeck for observers |
| VOTE-01 | Participant can select a card from the Fibonacci deck (1, 2, 3, 5, 8, 13, 21, ∞, ?) | CardDeck component; POST /api/rooms/[roomId]/vote stores value in room:{id}:votes hash keyed by participantId |
| VOTE-02 | Vote values are never exposed to any client before reveal — server enforces redacted serialization | toRoomView already redacts; vote API must never return the value in response; GET room returns redacted view |
| VOTE-03 | Participants can see a presence indicator for each participant showing voted / not voted | hasVoted derived in toRoomView; ParticipantList shows card back icon; vote-cast Pusher event triggers refreshRoom |
| VOTE-04 | Host can trigger a reveal; all vote values transmitted in single broadcast event and all cards flip simultaneously | POST /api/rooms/[roomId]/reveal; atomic set revealed=true + trigger 'vote-revealed' with full vote map in payload |
| VOTE-05 | Server rejects vote submissions after host has triggered reveal | Vote API checks room.revealed before hset; returns 409 if already revealed |
</phase_requirements>

---

## Summary

Phase 2 builds the real-time voting loop on top of the Phase 1 foundation. The stack is already fully chosen: Next.js 16 App Router route handlers, Pusher Channels (public channel `room-{roomId}`), Upstash Redis, and Tailwind CSS v4. Phase 1 established the `refreshRoom` pattern where any Pusher event triggers a full GET of room state — Phase 2 wires three new event types (vote-cast, story-updated, vote-revealed) to that same callback in `useRoom.ts`.

The two highest-risk technical areas are: (1) reveal atomicity — the server must set `revealed=true` and read all votes in a way that prevents a concurrent vote slipping through after the flag flips. `redis.multi()` provides the correct atomic guarantee here (unlike `pipeline()`, which is NOT atomic). (2) If upgrading to presence channels, the auth endpoint must parse `application/x-www-form-urlencoded` body from Pusher-js, which differs from JSON — this is a known footgun in Next.js App Router. However, the locked real-time strategy (public channel + API refresh) makes presence channels unnecessary for VOTE-03, removing this complexity entirely.

The CSS 3D card flip uses Tailwind v4 native utilities: `transform-3d` on the card wrapper, `backface-hidden` on each face, `rotate-y-180` on the front face after reveal. Staggered animation uses `transition-delay` with inline `style` per card (50–100ms × index).

**Primary recommendation:** Use public Pusher channel (avoid presence complexity), `redis.multi()` for atomic reveal, and Tailwind v4's `transform-3d`/`backface-hidden`/`rotate-y-180` for the flip animation.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pusher (server) | ^5.3.3 | Trigger events from API routes | Already installed; `pusherServer.trigger()` established in Phase 1 |
| pusher-js (client) | ^8.4.2 | Subscribe in browser, bind event handlers | Already installed; `pusherClient` singleton ready |
| @upstash/redis | ^1.37.0 | Store votes, room state, reveal flag | Already installed; `redis` singleton ready |
| next | 16.2.0 | App Router route handlers for vote/story/reveal APIs | Already in use; params are `Promise<{...}>` — must await |
| tailwindcss | ^4 | CSS 3D flip utilities natively available | Already installed; v4 has `transform-3d`, `backface-hidden`, `rotate-y-180` |
| zod | ^4.3.6 | Validate vote value, story title, role in request bodies | Already installed; established pattern from Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | ^5.1.7 | Already installed | Not needed in Phase 2 — IDs already assigned at join |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| public Pusher channel | presence channel | Presence adds auth endpoint complexity, requires `authEndpoint` in pusherClient. Public channel + API full-state refresh fully covers VOTE-03 (voted/not-voted indicator). Use public. |
| `redis.multi()` for reveal | `redis.pipeline()` | Pipeline is NOT atomic — concurrent vote commands can interleave. Must use `multi()`. |
| `redis.multi()` for reveal | Lua `eval()` | Lua gives conditional atomicity (check-then-set in one script). `multi()` batches the set+read atomically and is simpler. Use `multi()` unless Lua's conditional logic proves necessary. |
| CSS `transition` + `rotate-y-180` | Framer Motion | Framer Motion not installed; not needed. Native CSS handles the reveal flip cleanly with Tailwind v4 utilities. |

**Installation:** No new packages needed. All dependencies are already present.

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 2:

```
app/api/rooms/[roomId]/
├── route.ts                   # EXISTS — GET room state
├── join/route.ts              # EXISTS — POST join
├── vote/route.ts              # NEW — POST cast vote
├── story/route.ts             # NEW — POST set story title
├── reveal/route.ts            # NEW — POST trigger reveal
└── pusher-auth/route.ts       # NEW (only if upgrading to presence — NOT needed with public channel)

components/
├── ParticipantList.tsx        # EXISTS — update voted indicator to card back icon
├── JoinForm.tsx               # EXISTS — add `role` field (voter/observer)
├── HostControls.tsx           # NEW — story input, vote counter, Reveal button
├── CardDeck.tsx               # NEW — Fibonacci card row, selected state
└── VoteCard.tsx               # NEW — individual card with 3D flip face/back

hooks/
└── useRoom.ts                 # EXISTS — bind 4 Pusher event handlers here
```

### Pattern 1: Pusher Event → refreshRoom Full-State Refresh

**What:** Every Pusher event (vote-cast, story-updated, vote-revealed) calls the existing `refreshRoom()` callback, which re-fetches GET /api/rooms/[roomId] and replaces full room state. No delta patching.

**When to use:** All real-time events in Phase 2.

**Example (binding in useRoom.ts):**
```typescript
// Source: Phase 1 established pattern in app/room/[roomId]/page.tsx
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
```

### Pattern 2: Vote API Route — Store and Trigger

**What:** POST /api/rooms/[roomId]/vote reads participant cookie, validates value is in Fibonacci set, checks revealed=false, stores vote in Redis hash, triggers vote-cast event.

**Key constraint:** Check `room.revealed` BEFORE writing. If already revealed, return 409 (VOTE-05).

**Example:**
```typescript
// app/api/rooms/[roomId]/vote/route.ts
export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params  // MUST await in Next.js 16
  const cookieStore = await cookies()
  const participantId = cookieStore.get(`participant-${roomId}`)?.value
  if (!participantId) return Response.json({ error: 'Not joined' }, { status: 401 })

  const body = await req.json()
  // Zod validate: value in FIBONACCI_DECK
  const room = await getRoom(roomId)
  if (!room) return Response.json({ error: 'Room not found' }, { status: 404 })
  if (room.revealed) return Response.json({ error: 'Voting closed' }, { status: 409 })  // VOTE-05

  await redis.hset(keys.votes(roomId), { [participantId]: body.value })

  try {
    await pusherServer.trigger(roomChannel(roomId), 'vote-cast', {})
  } catch {
    // Non-blocking — Pusher unavailability must not prevent vote storage
  }

  return Response.json({ ok: true })
}
```

### Pattern 3: Atomic Reveal with redis.multi()

**What:** The reveal route must atomically set `revealed=true` AND read votes without a concurrent vote slipping through after the flag.

**Why multi() not pipeline():** `pipeline()` is NOT atomic — other commands can interleave. `multi()` guarantees atomic batch execution.

**Example:**
```typescript
// app/api/rooms/[roomId]/reveal/route.ts
export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  // Validate host token (same pattern as Phase 1 host-only endpoints)
  // ...

  const room = await getRoom(roomId)
  if (!room) return Response.json({ error: 'Room not found' }, { status: 404 })
  if (room.revealed) return Response.json({ error: 'Already revealed' }, { status: 409 })

  // Atomic: set revealed flag + read votes as one unit
  const tx = redis.multi()
  tx.hset(keys.room(roomId), { revealed: 'true' })
  tx.hgetall(keys.votes(roomId))
  const [, votesRaw] = await tx.exec<[number, Record<string, string> | null]>()

  const votes = votesRaw ?? {}

  try {
    await pusherServer.trigger(roomChannel(roomId), 'vote-revealed', { votes })
  } catch {
    // Non-blocking
  }

  return Response.json({ ok: true })
}
```

**CRITICAL NOTE on VOTE-05 race condition:** The check `if (room.revealed)` before the multi() is a soft guard, not a hard atomic check. The `redis.multi()` guarantees that `hset(revealed=true)` and `hgetall(votes)` execute together without interleaving, but a vote arriving between the `getRoom()` call and the `multi().exec()` could still be included in the final votes snapshot. This is actually the CORRECT behavior — votes that arrived before reveal is committed are valid. The `vote/route.ts` check `if (room.revealed)` (reading from Redis after the reveal hset is committed) is what enforces VOTE-05 from the vote side.

### Pattern 4: CSS 3D Card Flip (Tailwind v4)

**What:** Each VoteCard has a face (card back) and a back (value). On `vote-revealed` event the room state transitions to `revealed=true`. Cards flip via CSS transition triggered by a class applied when `room.revealed`.

**Tailwind v4 utilities (verified):**
- `transform-3d` → `transform-style: preserve-3d` on the card wrapper
- `backface-hidden` → `backface-visibility: hidden` on each face
- `rotate-y-180` → `transform: rotateY(180deg)` for the initial front-face rotation
- `perspective-*` → `perspective:` on the container
- Transition + stagger via inline `style={{ transitionDelay: `${index * 75}ms` }}`

**Example (VoteCard):**
```tsx
// Source: Tailwind CSS v4 docs — transform-style, backface-visibility, rotate-y
function VoteCard({ value, revealed, index }: { value: string; revealed: boolean; index: number }) {
  return (
    <div
      className="relative w-14 h-20 perspective-[600px]"
      style={{ transitionDelay: revealed ? `${index * 75}ms` : '0ms' }}
    >
      {/* Wrapper — flips on reveal */}
      <div
        className={`relative w-full h-full transform-3d transition-transform duration-500 ease-out
          ${revealed ? 'rotate-y-180' : ''}`}
      >
        {/* Front face — card back (face-down) */}
        <div className="absolute inset-0 backface-hidden rounded-lg bg-slate-700 ..." />
        {/* Back face — card value */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-lg bg-white flex items-center justify-center ...">
          <span className="text-2xl font-bold">{value}</span>
        </div>
      </div>
    </div>
  )
}
```

**Note:** The `transition-delay` is only applied when `revealed=true` (stagger on flip) so cards don't animate on initial render.

### Pattern 5: Host Detection via Cookie

**What:** `isHost` flag is derived by checking if the `host-token-{roomId}` cookie exists AND validating it against Redis. The room page uses this to conditionally render HostControls vs. read-only title.

**Example:**
```typescript
// In GET /api/rooms/[roomId] — already pattern-established
const cookieStore = await cookies()
const rawToken = cookieStore.get(`host-token-${roomId}`)?.value
const isHost = rawToken ? await validateToken(rawToken, room.hostToken) : false
// Return isHost in the RoomView response so client can branch UI
```

The client receives `isHost` from the GET response and passes it down to conditionally render `HostControls` vs. a read-only story title header.

### Pattern 6: Observer Role in Join Form

**What:** JoinForm needs a role selector (voter vs observer). The join API already accepts `role: 'voter' | 'observer'` (Phase 1 `joinRoom` signature). The form just needs a checkbox or toggle.

**Example body:**
```json
{ "name": "Alice", "role": "observer" }
```

The room page then checks `myParticipant.role === 'voter'` before rendering CardDeck.

### Anti-Patterns to Avoid

- **Using `redis.pipeline()` for the reveal operation:** Pipeline is NOT atomic. Other vote commands can interleave. Use `redis.multi()`.
- **Delta-patching Pusher event payloads into client state:** The locked pattern is full-state refresh. Partial state merges create subtle bugs when events arrive out of order.
- **Sending vote VALUES in Pusher payloads before reveal:** Only send `{ ok: true }` or presence info in `vote-cast`. Vote values go only in `vote-revealed` payload (or can be omitted if client re-fetches via API — the API already enforces redaction via toRoomView).
- **Rendering CardDeck for observers:** Observer check must be on `myParticipant.role`, not `hasJoined`. An observer has joined but must not see cards.
- **Animating card flip on initial render:** Guard the stagger delay to only apply when `revealed` transitions to true, not when the component mounts.
- **Forgetting to await `params` in Next.js 16 route handlers:** All new routes must `const { roomId } = await params`. This is a Next.js 16 breaking change already present in Phase 1 routes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time event broadcast | Custom WebSocket server | `pusherServer.trigger()` | Already integrated; serverless-compatible; handles reconnection |
| Atomic multi-step Redis write | Manual check-then-set with two separate awaits | `redis.multi()` | Two separate awaits are NOT atomic; concurrent votes slip through |
| Form-encoded body parsing | Manual string splitting | `new URLSearchParams(await req.text())` | Standard Web API; needed IF presence auth endpoint is added |
| Vote value validation | Custom set membership check | Zod `z.enum([...FIBONACCI_DECK])` | Established pattern; rejects invalid values at boundary |
| CSS 3D flip | Framer Motion or JS-driven animation | Native CSS transitions + Tailwind v4 | No extra dependency; GPU-composited; `prefers-reduced-motion` support via media query |

**Key insight:** The Redis multi-command atomicity requirement is the highest-complexity engineering decision. `redis.multi()` is the correct primitive — it's one fewer moving part than Lua scripting, and the reveal use case doesn't require conditional logic inside the atomic block (the `revealed` check happens before the transaction, not inside it).

---

## Common Pitfalls

### Pitfall 1: Pipeline vs. Multi — The Atomicity Trap
**What goes wrong:** Developer uses `redis.pipeline()` for the reveal operation (hset revealed + hgetall votes). Between the two commands, a concurrent `POST /vote` writes to the votes hash. The reveal snapshot is incomplete.
**Why it happens:** `pipeline()` batches commands in one HTTP request but does NOT guarantee atomic execution. The Upstash docs are explicit: "the execution of pipelines is not atomic and the execution of other commands can interleave."
**How to avoid:** Use `redis.multi()` for the reveal route's set + read pair.
**Warning signs:** Blank cards on reveal in multi-user testing; inconsistent vote counts.

### Pitfall 2: Next.js 16 Params Must Be Awaited
**What goes wrong:** New route handler destructures params synchronously: `const { roomId } = params`. TypeScript doesn't catch this if type is widened.
**Why it happens:** Next.js 15+/16 changed `params` to `Promise<{...}>`. Phase 1 routes already handle this with `await params`. New routes must follow the same pattern.
**How to avoid:** Copy the signature from existing routes: `{ params }: { params: Promise<{ roomId: string }> }` and `const { roomId } = await params`.
**Warning signs:** `roomId` is a Promise object (logs as `[object Promise]`).

### Pitfall 3: Vote Values Leaking in Pusher Payload
**What goes wrong:** `vote-cast` event includes the vote value in the payload. Any connected client receives it in the browser network tab before reveal.
**Why it happens:** Developer includes the value for convenience; VOTE-02 is violated.
**How to avoid:** `vote-cast` payload is `{}` or `{ participantId }` at most. Values ONLY appear in `vote-revealed` payload AND are enforced server-side by `toRoomView` redaction on the GET endpoint.
**Warning signs:** Network tab shows vote values during voting phase.

### Pitfall 4: Reveal Race Condition from the Vote Side
**What goes wrong:** A vote arrives just after `revealed=true` is set. The vote API reads `room.revealed` as `false` (stale cache), writes the vote, and the participant's card flips with a value others see as unexpected.
**Why it happens:** The vote API's `getRoom()` may return a cached/slightly stale value.
**How to avoid:** The `redis.multi()` in the reveal route commits `revealed=true` atomically. The vote API reads fresh from Redis (no client-side caching). The tiny window between reveal's `getRoom()` read and `multi().exec()` is the only gap — accept this and document VOTE-05 as a best-effort guard (any vote landing after the multi() exec will find `revealed=true` on their next read). In practice, the 50–100ms Pusher round-trip makes this window negligible.
**Warning signs:** Cards showing extra votes or blank values in stress tests.

### Pitfall 5: Tailwind v4 Class Names Differ from v3
**What goes wrong:** Developer writes `[transform-style:preserve-3d]` (arbitrary Tailwind v3 syntax) instead of `transform-3d` (v4 utility).
**Why it happens:** Most examples online are pre-v4; training data is mostly v3.
**How to avoid:** Use verified v4 classes: `transform-3d`, `backface-hidden`, `backface-visible`, `rotate-y-{deg}`, `perspective-{val}`.
**Warning signs:** Card flip doesn't work; no 3D perspective visible.

### Pitfall 6: Card Flip Animates on Mount
**What goes wrong:** The stagger delay is always applied, so when the room page first loads (with `revealed=true` from a prior session), all cards immediately stagger-animate, which is jarring.
**Why it happens:** Stagger delay is applied unconditionally based on `room.revealed`.
**How to avoid:** Gate the transition delay so it only applies when transitioning from `revealed=false` to `revealed=true`. Use a `useRef` to track previous revealed state and only add the delay class on the transition event.
**Warning signs:** Cards animate on page load for revealed rooms.

### Pitfall 7: Observer Sees Card Deck
**What goes wrong:** CardDeck is shown to observers with `disabled` prop, violating the locked decision (no disabled cards for observers — just no deck at all).
**Why it happens:** Developer adds `disabled` prop to CardDeck instead of conditional render.
**How to avoid:** Gate CardDeck rendering on `myParticipant?.role === 'voter'`. Observers see zero voting UI.
**Warning signs:** Observer view shows grayed-out cards.

---

## Code Examples

### Fibonacci Deck Constant
```typescript
// Define at module level — used in both CardDeck component and Zod validation
export const FIBONACCI_DECK = ['1', '2', '3', '5', '8', '13', '21', '∞', '?'] as const
export type FibonacciValue = typeof FIBONACCI_DECK[number]
```

### Story Title API Route
```typescript
// app/api/rooms/[roomId]/story/route.ts
import { cookies } from 'next/headers'
import { redis } from '@/lib/redis'
import { pusherServer, roomChannel } from '@/lib/pusher'
import { getRoom, keys } from '@/lib/room'
import { validateToken } from '@/lib/auth'
import { z } from 'zod'

const StorySchema = z.object({ title: z.string().min(1).max(200) })

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const cookieStore = await cookies()
  const rawToken = cookieStore.get(`host-token-${roomId}`)?.value
  if (!rawToken) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const room = await getRoom(roomId)
  if (!room) return Response.json({ error: 'Room not found' }, { status: 404 })
  if (!await validateToken(rawToken, room.hostToken)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = StorySchema.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: 'Invalid title' }, { status: 400 })

  await redis.hset(keys.room(roomId), { currentStory: parsed.data.title })

  try {
    await pusherServer.trigger(roomChannel(roomId), 'story-updated', {})
  } catch { /* non-blocking */ }

  return Response.json({ ok: true })
}
```

### Zod Vote Body Validation
```typescript
// Source: Zod v4 — z.enum with const tuple
import { FIBONACCI_DECK } from '@/lib/constants'
const VoteSchema = z.object({
  value: z.enum(FIBONACCI_DECK)  // Rejects anything not in the deck
})
```

### Passing isHost to Client
```typescript
// In GET /api/rooms/[roomId]/route.ts — extend existing response
const cookieStore = await cookies()
const rawToken = cookieStore.get(`host-token-${roomId}`)?.value
const isHost = rawToken ? await validateToken(rawToken, room.hostToken) : false

return Response.json({ ...view, myParticipantId: isKnown ? myParticipantId : null, isHost })
```

Update `RoomView` type to include `isHost?: boolean` (returned by GET, not part of stored state).

### Presence Channel Auth (only if upgrading — NOT needed)
```typescript
// app/api/pusher-auth/route.ts — SKIP: public channel is sufficient
// If needed in a future phase:
export async function POST(req: Request) {
  const body = await req.text()
  const params = new URLSearchParams(body)  // Pusher sends form-encoded
  const socket_id = params.get('socket_id')!
  const channel_name = params.get('channel_name')!

  const cookieStore = await cookies()
  const participantId = /* derive from cookie */
  const presenceData = { user_id: participantId, user_info: { name: /* ... */ } }

  const auth = pusherServer.authorizeChannel(socket_id, channel_name, presenceData)
  return Response.json(auth)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind `[transform-style:preserve-3d]` arbitrary value | `transform-3d` utility class | Tailwind v4 (2025) | Cleaner class names; v4 has full 3D support natively |
| Tailwind `[backface-visibility:hidden]` arbitrary | `backface-hidden` utility | Tailwind v4 | Same |
| Next.js sync `params` destructure | `await params` (async) | Next.js 15/16 | Breaking change; already handled in Phase 1 routes |
| Pusher auth via Pages Router API handler | App Router `route.ts` with `URLSearchParams` body parse | Next.js 13+ | Form-encoded body requires explicit parsing (no express middleware) |
| `redis.pipeline()` for atomic multi-step | `redis.multi()` for guaranteed atomicity | Upstash SDK always | Semantically correct — pipeline is batching, multi is atomic |

**Deprecated/outdated:**
- Presence channels for voted/not-voted status: Public channel + full-state GET already covers VOTE-03. Presence adds auth complexity for no benefit in this phase.
- Custom CSS `rotateY` without Tailwind utilities: v4 has `rotate-y-*` natively.

---

## Open Questions

1. **Reveal window race condition acceptance**
   - What we know: Between `getRoom()` reading `revealed=false` and `redis.multi()` committing `revealed=true`, a vote can arrive. That vote WILL be included in the reveal snapshot (it arrived legitimately before reveal committed).
   - What's unclear: Is this the correct semantics? The spec says "server rejects vote submissions AFTER reveal" — votes landing in the ~1ms commit window are arguably valid.
   - Recommendation: Accept this behavior. Document it. The real VOTE-05 guard is the vote API's `if (room.revealed) return 409` after the reveal commits.

2. **`isHost` in RoomView type**
   - What we know: The GET route already returns `myParticipantId` as an ad-hoc addition outside `RoomView`. `isHost` will need the same treatment.
   - What's unclear: Whether to extend `RoomView` type or create a `RoomPageResponse` type that extends it.
   - Recommendation: Create `RoomPageResponse = RoomView & { myParticipantId: string | null; isHost: boolean }` in types/room.ts. Keeps the server storage types clean.

3. **Vote count field in RoomData**
   - What we know: `RoomData` has a `voteCount` field. The vote API could increment it. The host controls panel shows "X / Y voted".
   - What's unclear: The participant total Y is `participants.length` (voters only, not observers). The voted count X can be derived from the votes hash size (no need to maintain voteCount separately).
   - Recommendation: Derive voteCount from `Object.keys(votes).length` in `toRoomView` rather than maintaining a separate Redis field. Avoids double-write issues.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-04 | POST /story sets currentStory in Redis and triggers pusher event | unit | `npx vitest run tests/api/story.test.ts` | Wave 0 |
| SESS-04 | Non-host is rejected with 403 | unit | `npx vitest run tests/api/story.test.ts` | Wave 0 |
| IDNT-03 | POST /join with role=observer stores observer role | unit | `npx vitest run tests/api/join.test.ts` | Exists (extend) |
| IDNT-03 | Observer participant has role='observer' in toRoomView | unit | `npx vitest run tests/lib/room.test.ts` | Exists (extend) |
| VOTE-01 | POST /vote stores valid Fibonacci value in votes hash | unit | `npx vitest run tests/api/vote.test.ts` | Wave 0 |
| VOTE-01 | POST /vote rejects non-Fibonacci value with 400 | unit | `npx vitest run tests/api/vote.test.ts` | Wave 0 |
| VOTE-02 | toRoomView does not expose value when revealed=false | unit | `npx vitest run tests/lib/room.test.ts` | Exists (passes) |
| VOTE-03 | hasVoted is true after vote is stored | unit | `npx vitest run tests/lib/room.test.ts` | Exists (passes) |
| VOTE-04 | POST /reveal sets revealed=true in Redis and triggers pusher with votes payload | unit | `npx vitest run tests/api/reveal.test.ts` | Wave 0 |
| VOTE-04 | POST /reveal non-host is rejected with 403 | unit | `npx vitest run tests/api/reveal.test.ts` | Wave 0 |
| VOTE-05 | POST /vote after reveal returns 409 | unit | `npx vitest run tests/api/vote.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/room.test.ts tests/api/vote.test.ts tests/api/reveal.test.ts tests/api/story.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/vote.test.ts` — covers VOTE-01, VOTE-02, VOTE-05
- [ ] `tests/api/story.test.ts` — covers SESS-04
- [ ] `tests/api/reveal.test.ts` — covers VOTE-04

*(tests/lib/room.test.ts and tests/api/join.test.ts exist and can be extended for IDNT-03 and VOTE-03)*

---

## Sources

### Primary (HIGH confidence)
- Phase 1 codebase — `hooks/useRoom.ts`, `lib/room.ts`, `lib/pusher.ts`, `lib/pusher-client.ts`, `app/api/rooms/[roomId]/route.ts`, `types/room.ts` — directly read
- [Upstash Redis Pipeline vs Transaction docs](https://upstash.com/docs/redis/sdks/ts/pipelining/pipeline-transaction) — verified: pipeline NOT atomic, multi() IS atomic
- [Pusher channel types docs](https://pusher.com/docs/channels/using_channels/channels/) — verified: public channels require no auth; presence requires auth endpoint
- [Pusher authorization endpoint docs](https://pusher.com/docs/channels/server_api/authorizing-users/) — verified: form-encoded POST body, URLSearchParams parsing pattern
- [Tailwind CSS v4 backface-visibility docs](https://tailwindcss.com/docs/backface-visibility) — verified: `backface-hidden`, `backface-visible`
- [Tailwind CSS v4 transform-style docs](https://tailwindcss.com/docs/transform-style) — verified: `transform-3d`, `transform-flat`

### Secondary (MEDIUM confidence)
- WebSearch: Tailwind v4 3D transform utilities — multiple sources confirm `rotate-y-*`, `perspective-*`, `transform-3d` are natively available in v4 (project uses ^4)
- WebSearch: Upstash Redis eval/Lua scripting — supported via `redis.eval()` and `redis.scriptLoad()`, but `multi()` is simpler for this use case

### Tertiary (LOW confidence)
- WebSearch: Pusher presence channel auth with Next.js App Router — pattern confirmed (`URLSearchParams` for form-encoded body) but no single authoritative tutorial verified end-to-end against Next.js 16 specifically

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, Phase 1 patterns established
- API route patterns: HIGH — exact signatures verified against existing Phase 1 routes
- Redis atomicity: HIGH — verified against official Upstash pipeline/transaction docs
- CSS 3D flip: HIGH — Tailwind v4 utility names verified against official docs
- Pusher channel decision: HIGH — public channel recommendation is confirmed correct; presence adds unnecessary auth complexity
- Pusher presence auth (if needed): MEDIUM — pattern verified but not tested against Next.js 16 specifically

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack; Tailwind v4 and Upstash SDK unlikely to have breaking changes in 30 days)
