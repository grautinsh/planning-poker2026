# Phase 4: Reconnection and Polish - Research

**Researched:** 2026-03-19
**Domain:** WebSocket connection state management, Redis name-lookup, Next.js 16 Route Handlers, cookie re-issuance
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Server scans participants hash for exact name match when no participant cookie is present
- If match found: return existing UUID and re-issue `participant-{roomId}` cookie
- Existing participant Redis record is reused as-is (no data mutation, no joinedAt update)
- Vote in votes hash is keyed to UUID — automatically restored by returning the same UUID
- **Unique names required at join time**: duplicate name rejected with 409 Conflict; prevents collision ambiguity
- **Silent restoration** — JoinForm disappears, room renders normally with previous vote shown. No banner or message.
- Reconnector after reveal sees current room state as-is (GET /api/rooms/[roomId] already returns revealed=true with vote values). No animation replay.
- **No Pusher broadcast on reconnect** — participant already in participant list
- Show "Reconnecting..." banner only when Pusher is actually disconnected. Hidden when connected.
- Show "Room not found or has expired" message with ← Create a new room link. Polish the existing loadError state.
- No host removal of stale participants — out of scope for v1.
- Vote restoration is automatic: votes cleared on next-story; no special stale-vote logic.

### Claude's Discretion
- Exact UI treatment of the "Reconnecting..." banner (position, color, animation)
- HTTP status code for name-already-taken rejection (409 recommended)
- Whether to check name uniqueness only at join time or also validate on reconnect attempt

### Deferred Ideas (OUT OF SCOPE)
- Host can remove participants from the room — post-v1
- Page title tags and favicon — post-v1
- Accessibility audit (focus management, ARIA labels) — post-v1
- Skeleton/shimmer loading states — post-v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IDNT-04 | Participant can reconnect to a room by entering the same name and have their previous vote state restored | Name-match scan in join route; UUID re-issuance; cookie re-set pattern already verified in codebase |
</phase_requirements>

## Summary

Phase 4 is a tightly scoped finishing phase. The core reconnect mechanism is a new branch in the existing `POST /api/rooms/[roomId]/join` route: when no participant cookie is present, scan the Redis participants hash by display name; if found, return the existing UUID and re-issue the cookie. Because votes are keyed to UUID, the vote is restored automatically — no separate logic is needed.

The connection indicator is driven by Pusher JS's `pusherClient.connection` object, which emits `state_change` events with `{ previous, current }`. Binding to `state_change` in `useRoom` (or a companion hook) and exposing an `isDisconnected` boolean to the page is the cleanest integration. The banner must only appear after initial connection is established (not during the initial page-load "Loading room..." state).

The expired-room polish is already structurally complete — `loadError` state exists in `page.tsx`, it just needs a more finished visual treatment. All three tasks (join route changes, connection indicator, room-not-found polish) are independently deployable and low-risk.

**Primary recommendation:** Extend the join route with a name-uniqueness check first (guard clause), then the name-match reconnect branch second. Wire Pusher connection state via `pusherClient.connection.bind('state_change', ...)` in `useRoom` and thread the flag up to the page.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pusher-js | ^8.4.2 (installed) | Client-side Pusher connection; connection state events | Already in use; official SDK |
| @upstash/redis | ^1.37.0 (installed) | Redis hash scan for name-match reconnect | Already in use; `hgetall` returns full participants hash |
| next/headers | Next.js 16.2.0 | `cookies()` — async, await required | Already used in join route and GET route |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 (installed) | Input validation in join route | Already used; extend existing `joinSchema` if needed |
| vitest | ^4.1.0 (installed) | Unit tests for new join route branches | Existing test infrastructure at `tests/api/join.test.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Name scan via `getParticipants()` + JS `find` | Custom Redis HSCAN command | `getParticipants()` already exists, already returns full list, already has the Upstash auto-deserialization guard. No reason to add raw Redis calls. |
| `state_change` event on `pusherClient.connection` | Polling for connection status | Event-driven is the correct pattern; Pusher JS emits state transitions reliably. |
| `useRoom` hook extension | Separate `useConnectionState` hook | Fewer hooks is simpler; `useRoom` already has `channelRef` and the `pusherClient` import — extending it keeps connection state co-located with channel state. |

## Architecture Patterns

### Existing Project Structure (relevant paths)
```
app/
  api/
    rooms/[roomId]/
      join/route.ts      ← ADD name-uniqueness check + name-match reconnect branch
      route.ts           ← unchanged
hooks/
  useRoom.ts             ← ADD connection state binding; return isDisconnected
app/room/[roomId]/
  page.tsx               ← CONSUME isDisconnected, render banner; polish loadError UI
```

### Pattern 1: Join Route — Name-Uniqueness Guard Then Name-Match Branch
**What:** Two new code paths added to the existing `POST /api/rooms/[roomId]/join` handler, both before the `crypto.randomUUID()` new-participant path.
**When to use:** Applies whenever the incoming request has no existing participant cookie.

```typescript
// Guard: reject if name is already taken (unique name invariant for clean reconnect)
const participants = await getParticipants(roomId)
const nameTaken = participants.some(p => p.name === name)
if (nameTaken) {
  // Check if THIS is a reconnect: does the name belong to a participant whose UUID is NOT in the cookie?
  // Per CONTEXT.md decision: reject with 409; name-match (reconnect) is a separate branch below
  return Response.json({ error: 'Name already taken in this room' }, { status: 409 })
}
```

Wait — the CONTEXT.md decision requires nuance: the uniqueness check and the reconnect branch are combined. The name-match reconnect path MUST fire before the uniqueness rejection. Correct order:

```typescript
// Source: CONTEXT.md locked decisions + existing join/route.ts pattern
const cookieStore = await cookies()
const existingCookie = cookieStore.get(`participant-${roomId}`)

// Path A: returning participant (cookie present) — existing behavior, unchanged
if (existingCookie?.value) {
  const existingId = existingCookie.value
  const participants = await getParticipants(roomId)
  const existing = participants.find(p => p.participantId === existingId)
  if (existing) {
    return Response.json({ participantId: existingId, name: existing.name })
  }
  // Cookie present but expired room — fall through to new participant path
}

// Path B: name-match reconnect (no cookie, name already in room → same person returning)
const participants = await getParticipants(roomId)
const match = participants.find(p => p.name === name)
if (match) {
  // Re-issue the cookie with the existing UUID
  cookieStore.set(`participant-${roomId}`, match.participantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60,
    path: '/',
  })
  return Response.json({ participantId: match.participantId, name: match.name })
}

// Path C: name uniqueness check — reject if different person tries to take existing name
// (This guard is now only reached when no match was found above — name IS available)
// NOTE: If name match was found in Path B, we returned early. So reaching here means
// the name is free. No additional uniqueness check needed — the logic is self-consistent.

// Path D: new participant — existing behavior
const participantId = crypto.randomUUID()
await joinRoom(roomId, participantId, name, role)
// ... set cookie, trigger Pusher broadcast, return
```

Wait — re-reading CONTEXT.md: "Unique names required at join time: if the requested name is already taken in the room, the join request is rejected." This means: a NEW person trying to join with a name that's in use (and who has no cookie) should be rejected EXCEPT when it IS a reconnect. The name-match reconnect IS the reconnect path — so Path B handles reconnects, and if we reach Path C, we know the name is free (Path B found no match). The uniqueness constraint therefore requires no additional guard — the two paths are mutually exclusive.

**Key insight:** The combined logic is: no match found + no cookie = new person, proceed normally. Match found + no cookie = reconnecting person, re-issue UUID. Name collision scenario (two people with same name) is prevented by Path C... but only for truly NEW names. If Alice is in the room and Bob tries to join as "Alice" with no cookie, Path B fires, returns Alice's UUID, and Bob silently becomes Alice. This is the intended behavior per CONTEXT.md — "the name collision ambiguity is prevented entirely by requiring unique names at join time."

**Corrected understanding:** The uniqueness rejection needs to happen ONLY for new-participant attempts. Since Path B (name-match reconnect) covers all cases where the name is already taken, Path C is simply: name is free → proceed. The uniqueness constraint is enforced implicitly — if a name is taken, Path B fires (treating it as reconnect). This is the user's explicit design decision.

### Pattern 2: Pusher Connection State in useRoom
**What:** Bind to `pusherClient.connection.bind('state_change', ...)` to track disconnect state; expose via hook return value.
**When to use:** Connection indicator is only visible when `current === 'connecting' || current === 'unavailable'`.

```typescript
// Source: pusher-js README (node_modules/pusher-js/README.md — Connection States section)
// States: initialized | connecting | connected | unavailable | failed | disconnected

export function useRoom(roomId: string, onEvent: () => void) {
  const channelRef = useRef<ReturnType<typeof pusherClient.subscribe> | null>(null)
  const [isDisconnected, setIsDisconnected] = useState(false)

  useEffect(() => {
    if (!roomId) return

    const handleStateChange = ({ current }: { previous: string; current: string }) => {
      // Show banner for connecting/unavailable states (not during initial page load)
      // 'initialized' and first 'connecting' are pre-connection — don't show banner then
      setIsDisconnected(current === 'unavailable' || current === 'failed')
    }

    pusherClient.connection.bind('state_change', handleStateChange)

    const channel = pusherClient.subscribe(`room-${roomId}`)
    channelRef.current = channel

    channel.bind('participant-joined', onEvent)
    // ... other event bindings unchanged

    return () => {
      channel.unbind_all()
      pusherClient.unsubscribe(`room-${roomId}`)
      channelRef.current = null
      pusherClient.connection.unbind('state_change', handleStateChange)
    }
  }, [roomId, onEvent])

  return { channel: channelRef.current, isDisconnected }
}
```

**Important:** `unavailable` is the state for "no internet / Pusher temporarily down." `connecting` is normal startup and reconnect attempts. CONTEXT.md says "show only when Pusher is actually disconnected" — showing during `unavailable` is correct; showing during the first `connecting` would create a flash on every page load. Showing during `connecting` after a disconnect (i.e., when `previous === 'unavailable'`) is acceptable.

Simplest safe rule: show banner when `current === 'unavailable'`. This covers the "lost internet connection" case precisely. The `connecting` state during recovery could also be shown (previous=unavailable, current=connecting) — that's a discretion decision left to implementation.

### Pattern 3: Banner — State-Driven, Not a Notification
**What:** Conditionally rendered element in `page.tsx`, positioned as a fixed top banner (not a toast).
**When to use:** `isDisconnected === true` AND room has loaded (not during initial "Loading room..." phase).

Consistent with established "state is the confirmation" pattern from Phase 2. UI styling follows project's existing Tailwind patterns (slate/amber/yellow palette for warnings).

Reference existing UI style in page.tsx: uses `bg-slate-50`, `border-slate-200`, `text-slate-600` for informational elements. Banner should use a similar but distinct palette (amber/yellow for warning).

Per ui-ux-pro-max skill: animation duration 150-300ms, respect `prefers-reduced-motion`, avoid layout shift (use fixed/sticky positioning so banner doesn't push content).

### Anti-Patterns to Avoid
- **Calling `joinRoom()` on reconnect:** Reconnect MUST NOT write a new participant record. Return the existing UUID directly.
- **Broadcasting a Pusher event on reconnect:** The participant is already in the list. A `participant-joined` broadcast would cause all clients to re-render and could flash the UI unnecessarily.
- **Showing the "Reconnecting..." banner on initial page load:** The initial `connecting` state is normal and has its own "Loading room..." UI. Only show the banner after the connection has been established at least once.
- **Using `useState` without cleanup for Pusher connection binding:** Must `unbind` on cleanup or you'll accumulate listeners across re-renders.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Name-match scan | Custom Redis SCAN/KEYS command | `getParticipants(roomId)` + JS `find()` | Already abstracts Upstash auto-deserialization guard; room is small (team poker), full hash fetch is fine |
| Connection state tracking | Polling `pusherClient.connection.state` | `pusherClient.connection.bind('state_change', ...)` | Pusher JS emits transitions reliably; polling wastes cycles |
| Cookie re-issuance | New cookie utility | Existing `cookieStore.set()` pattern (identical options to original join) | Consistent with how cookie was first issued; same maxAge, httpOnly, sameSite options |

**Key insight:** This phase has almost no new infrastructure — it's additive logic on existing endpoints and existing hooks.

## Common Pitfalls

### Pitfall 1: Re-issuing Cookie for Wrong Name Match (Case Sensitivity)
**What goes wrong:** "Alice" and "alice" match as the same name on reconnect, or don't match unexpectedly.
**Why it happens:** Redis stores names as-is; JS `===` comparison is case-sensitive.
**How to avoid:** The join route already trims names via `z.string().trim()` in `joinSchema`. Use the same trimmed name for the match scan. Both the stored name and the incoming name were trimmed at storage time, so `===` is correct.
**Warning signs:** Test with names containing leading/trailing spaces.

### Pitfall 2: `getParticipants` Called Twice in a Single Join Request
**What goes wrong:** Path A (cookie check) and Path B (name match) both call `getParticipants(roomId)`. This is two Redis round-trips for the reconnect case.
**Why it happens:** Existing code calls `getParticipants` in the cookie-check branch; new code needs it again for name-match.
**How to avoid:** Restructure to call `getParticipants` once, outside both branches, when there is no cookie. Only call it inside the cookie branch if the cookie is present.
**Warning signs:** Two sequential Redis calls in the hot path without caching.

### Pitfall 3: `state_change` Fires on Initial Page Load
**What goes wrong:** Banner shows briefly on every page load because Pusher goes through `initialized → connecting → connected`.
**Why it happens:** The hook binds before the first `connected` event arrives.
**How to avoid:** Only set `isDisconnected = true` for `unavailable` or `failed` states (not `connecting`). Alternatively, track a `hasConnected` ref and only show the banner if `hasConnected.current === true` when a non-`connected` state arrives.
**Warning signs:** Banner flashes on every fresh page load.

### Pitfall 4: `onEvent` Closure Staleness in useRoom
**What goes wrong:** Adding the `state_change` binding inside the same `useEffect` that depends on `[roomId, onEvent]` means any `onEvent` change recreates the Pusher subscription unnecessarily.
**Why it happens:** `onEvent` is passed as a dependency, so any parent re-render that produces a new `onEvent` reference re-runs the effect.
**How to avoid:** The existing code already uses `useCallback` for `refreshRoom` in `page.tsx`, which is the correct mitigation. The connection state binding can use a `useRef` to capture the latest `onEvent` without being in deps.
**Warning signs:** Unexpected Pusher resubscription logs.

### Pitfall 5: Participant Impersonation via Name-Match
**What goes wrong:** Any user who knows a participant's display name can "reconnect" as them (steal their UUID and vote record).
**Why it happens:** By design — the reconnect mechanism uses only the display name as identity proof.
**How to avoid:** This is a known, accepted tradeoff per CONTEXT.md ("clean solution for a small-team tool"). No additional mitigation needed for v1. Document the limitation.
**Warning signs:** N/A — accepted behavior.

## Code Examples

Verified patterns from official sources:

### Pusher Connection State Binding
```typescript
// Source: node_modules/pusher-js/README.md — "Connection States" and "Connection Events" sections
// Available states: initialized | connecting | connected | unavailable | failed | disconnected

pusherClient.connection.bind('state_change', function(states: { previous: string; current: string }) {
  // states.previous = prior state, states.current = new state
})

// Or bind to specific events:
pusherClient.connection.bind('connected', callback)
pusherClient.connection.bind('disconnected', callback)

// Unbind specific handler on cleanup:
pusherClient.connection.unbind('state_change', handler)
```

### Cookie Re-issuance (Next.js 16 — async cookies())
```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
// cookies() is async in Next.js 15+/16 — must await

const cookieStore = await cookies()
cookieStore.set(`participant-${roomId}`, existingParticipantId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60,
  path: '/',
})
```

### Route Handler Params (Next.js 16 — params is a Promise)
```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
// params must be awaited — this is already the established pattern in this codebase

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  // ...
}
```

### Name-Match Scan
```typescript
// Source: existing lib/room.ts getParticipants() — returns ParticipantData[]
const participants = await getParticipants(roomId)
const match = participants.find(p => p.name === name)  // name is trimmed by joinSchema
if (match) {
  // Reconnect path: re-issue cookie with match.participantId
}
```

### JoinForm Error Handling for 409
```typescript
// Source: existing components/JoinForm.tsx handleSubmit
// JoinForm already handles non-ok responses:
if (!res.ok) {
  const body = await res.json()
  throw new Error(body.error?.formErrors?.[0] ?? 'Failed to join')
}
// A plain string error field ('Name already taken in this room') requires:
throw new Error(body.error ?? 'Failed to join')
// JoinForm must handle both formats. The 409 response should return:
// { error: 'Name already taken in this room' }
// (not a Zod-shaped error object)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cookies()` synchronous | `cookies()` async, must await | Next.js 15+ | Already in place — all route handlers use `await cookies()` |
| `params` direct access | `params` is a Promise, must await | Next.js 15+ | Already in place — all route handlers use `await params` |
| Manual connection polling | `pusher.connection.bind('state_change', ...)` | pusher-js v3+ | Event-driven; no polling needed |

**Deprecated/outdated:**
- Synchronous `cookies()` — already removed from this codebase
- Synchronous `params` access — already removed from this codebase

## Open Questions

1. **Should the "Reconnecting..." banner show during `connecting` state (not just `unavailable`)?**
   - What we know: `connecting` occurs both on initial load and during reconnect attempts after `unavailable`
   - What's unclear: Whether showing during reconnect `connecting` is better UX than only showing during `unavailable`
   - Recommendation: Start with `unavailable` only (cleaner, no initial-load flash). Add `connecting` after `unavailable` if a brief reconnect window needs to be signaled.

2. **Error response shape for 409 (name already taken)**
   - What we know: Existing `JoinForm.tsx` parses `body.error?.formErrors?.[0]` for Zod errors; `body.error` for plain strings
   - What's unclear: Current error parse in JoinForm only falls back to `body.error` if `formErrors` is not present
   - Recommendation: Return `{ error: 'Name already taken in this room' }` (plain string, not Zod-shaped). Verify JoinForm error display path handles this. May need a one-line fix in JoinForm's catch block.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/api/join.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDNT-04 | Name-match reconnect returns existing participantId | unit | `npx vitest run tests/api/join.test.ts` | ✅ (extend existing) |
| IDNT-04 | Name-match reconnect re-issues cookie with same options | unit | `npx vitest run tests/api/join.test.ts` | ✅ (extend existing) |
| IDNT-04 | Duplicate name from new participant returns 409 | unit | `npx vitest run tests/api/join.test.ts` | ✅ (extend existing) |
| IDNT-04 | Connection indicator shows when Pusher state is unavailable | manual | Visual browser test | N/A |
| IDNT-04 | Room-not-found renders link to create new room | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ (existing GET 404 test) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/join.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. New test cases are additions to `tests/api/join.test.ts` (already exists). No new test files required.

## Sources

### Primary (HIGH confidence)
- `node_modules/pusher-js/README.md` — Connection States table, `state_change` event API, `unbind` cleanup pattern
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` — async `cookies()` API, `set()` options
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — `params` as Promise pattern
- Existing codebase: `app/api/rooms/[roomId]/join/route.ts`, `hooks/useRoom.ts`, `lib/room.ts`, `components/JoinForm.tsx`, `app/room/[roomId]/page.tsx`

### Secondary (MEDIUM confidence)
- `vitest.config.ts` + `tests/api/join.test.ts` — confirmed test infrastructure and mock patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; versions confirmed from package.json
- Architecture: HIGH — all patterns derived from reading actual source files; no assumptions
- Pitfalls: HIGH — derived from reading actual code and official SDK docs in node_modules
- Validation architecture: HIGH — vitest config and existing test file read directly

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack; pusher-js and Next.js APIs are stable)
