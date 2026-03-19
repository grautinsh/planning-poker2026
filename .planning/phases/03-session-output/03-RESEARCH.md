# Phase 3: Session Output - Research

**Researched:** 2026-03-19
**Domain:** Next.js 16 App Router API routes, Upstash Redis list operations, Pusher Channels, React client state management, Clipboard API
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Post-reveal host controls:**
- After reveal, the Reveal button in the sticky HostControls panel is replaced by **Reset Round** and **Next Story →** buttons
- **Reset Round**: clears all votes, returns to voting phase, story title preserved — deck returns, VoteCard grid disappears
- **Next Story →**: switches HostControls to an inline estimate-entry mode — a small input + Confirm + Cancel appear in the panel; no modal
- Non-host participants wait silently while host enters the agreed estimate — no indicator shown to them
- On confirm: agreed estimate appended to session log, new round starts (story title cleared, votes cleared, revealed = false)

**Vote summary display:**
- Stats row appears **above** the flipped cards, between the "Results" heading and the VoteCard grid
- Format: `Min: X · Max: Y · Avg: Z.Z` (average to one decimal place)
- **Consensus case**: when all voters picked the same value, replace min/max/avg row with `✓ Consensus: X` (green treatment)
- **Non-numeric votes** (∞ and ?): excluded from average calculation; a small note shows e.g. "(2 non-numeric excluded)" — min/max only from numeric values; if all votes are non-numeric, skip stats entirely

**Session log layout:**
- Always-visible section at the bottom of the page, below all other content
- Visible from page load; shows an empty state ("No stories logged yet") until LOG-01 fires
- Each entry: **story title** + **agreed estimate** only (no timestamp)
- Copy button lives in the session log section header
- Log stored in Redis list at `room:{roomId}:log` (appended on each next-story action, TTL matches room keys)
- Broadcast via Pusher (new `story-logged` event) → all clients call `refreshRoom` to pick up updated log

**Clipboard export:**
- **Markdown table** format only — no plain-text alternative
- Format:
  ```
  | Story | Points |
  |-------|--------|
  | Auth login story | 5 |
  | User settings epic | 13 |
  ```
  No date header, no total points line — table only
- Copy feedback: button label switches to `✓ Copied!` for ~2 seconds then reverts — no toast (consistent with Phase 2 no-toast decision)

### Claude's Discretion
- Exact styling of the consensus badge (color, icon)
- Empty state illustration/text for session log
- Transition between Reveal button and Reset/Next Story buttons (swap, fade, etc.)
- Exact Redis list serialization format for log entries (JSON per entry recommended)
- Pusher event name for story-logged broadcast

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POST-01 | After reveal, all participants see each voter's name alongside their card value | Already implemented via VoteCard grid + revealed serialization view from Phase 2; no new work needed beyond confirming the existing render path is complete |
| POST-02 | After reveal, vote summary is displayed: minimum, maximum, and average | Stats computed client-side from `room.participants` values when `room.revealed === true`; pure JS reduce, no new API needed |
| POST-03 | Host can reset the current story to allow a re-vote (clears all votes, returns to voting phase, story title preserved) | New `POST /api/rooms/[roomId]/reset` route; Redis multi() to clear votes hash and set revealed=false atomically; Pusher broadcast |
| LOG-01 | Host can move to the next story, which prompts for a final agreed estimate, appends it to the session log, and starts a fresh voting round | New `POST /api/rooms/[roomId]/next-story` route; `redis.rpush` to append JSON entry to log list; atomic reset of room state; Pusher story-logged event |
| LOG-02 | Session log is visible to all participants and accumulates story title + agreed estimate for each completed story | `GET /api/rooms/[roomId]` extended to fetch log via `redis.lrange`; new `SessionLog` component; `log` field added to `RoomPageResponse` |
| LOG-03 | Participant can copy the session log to clipboard in a plain-text / Markdown format | `navigator.clipboard.writeText()` in SessionLog component; Markdown table format; button text swap feedback |
</phase_requirements>

---

## Summary

Phase 3 is an additive phase built on a well-established codebase. Phases 1 and 2 have established all infrastructure patterns: Next.js 16 App Router API routes with async params, Upstash Redis with `@upstash/redis` SDK, Pusher Channels for real-time broadcast, and Vitest with vi.mock() for testing. No new dependencies are required.

The core work is: (1) extending `HostControls` to render three different button states (pre-reveal, post-reveal action, estimate-entry); (2) computing vote statistics client-side from the existing `participants` array; (3) two new API routes (`reset`, `next-story`); (4) extending the GET `/api/rooms/[roomId]` response to include the session log; (5) a new `SessionLog` component; and (6) clipboard export using the Web Clipboard API.

The most delicate technical area is the `next-story` route's atomicity: it must append to the Redis log list AND reset room state (clear votes, set revealed=false, clear currentStory) in a way that is consistent. Using `redis.multi()` for the reset fields and a separate sequential `rpush` is the established pattern, but the order matters. The research below clarifies this.

**Primary recommendation:** Use `redis.multi()` for the atomic room state reset (revealed=false, voteCount=0, currentStory='') and `redis.del()` for votes; issue `redis.rpush` for the log entry before or in the same pipeline since list append does not need to be atomic with the reset.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@upstash/redis` | ^1.37.0 | Redis list operations (`rpush`, `lrange`) for session log | Already in use; `RPushCommand` and `LRangeCommand` confirmed in type definitions |
| `pusher` (server) | ^5.3.3 | Broadcast `story-logged` event to all clients | Already in use for all other events |
| `pusher-js` (client) | ^8.4.2 | Receive `story-logged` via `useRoom` hook | Already wired for `participant-joined`, `vote-cast`, `story-updated`, `vote-revealed` |
| `next` | 16.2.0 | App Router API routes with `params: Promise<{roomId}>` pattern | Project standard; async params MUST be awaited |
| `zod` | ^4.3.6 | Input validation on new routes | Already used in vote route |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `navigator.clipboard` | Web API (no install) | Clipboard write for LOG-03 | Built into modern browsers; no library needed for simple text copy |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `navigator.clipboard.writeText()` | `copy-to-clipboard` npm package | Package adds bundle weight with no benefit for a single use; Web API is sufficient and already available |
| Redis list (`rpush`/`lrange`) | Redis hash with incrementing index | List is semantically correct for an ordered log; lrange returns ordered results naturally |

**No new packages to install.** All dependencies are already present.

---

## Architecture Patterns

### Recommended Project Structure
```
app/api/rooms/[roomId]/
├── route.ts               # GET — extend to include log[]
├── reset/route.ts         # POST — new, host-only
└── next-story/route.ts    # POST — new, host-only

components/
├── HostControls.tsx       # Extend: 3 display states
└── SessionLog.tsx         # New component

types/room.ts              # Add LogEntry type + log field to RoomPageResponse
lib/room.ts                # Add getLog(roomId) function
```

### Pattern 1: Extending the GET /api/rooms/[roomId] Response

The established pattern is: GET returns full room state, all Pusher events trigger `refreshRoom` which calls GET. The `log` field slots naturally into `RoomPageResponse`.

**`types/room.ts` additions:**
```typescript
// Source: existing type file pattern
export type LogEntry = {
  story: string
  estimate: string
}

// Extend RoomPageResponse:
export type RoomPageResponse = RoomView & {
  myParticipantId: string | null
  isHost: boolean
  log: LogEntry[]  // ADD: session log entries, always present (empty array if none)
}
```

**`lib/room.ts` additions:**
```typescript
// Source: established getParticipants pattern in lib/room.ts
export async function getLog(roomId: string): Promise<LogEntry[]> {
  const raw = await redis.lrange(keys.log(roomId), 0, -1)
  if (!raw || raw.length === 0) return []
  return raw.map(v => typeof v === 'string' ? JSON.parse(v) : v as LogEntry)
}
```

**`app/api/rooms/[roomId]/route.ts` addition:**
```typescript
// After existing fetches, add:
const log = await getLog(roomId)
return Response.json({ ...view, myParticipantId: isKnown ? myParticipantId : null, isHost, log })
```

### Pattern 2: Reset Route (POST-03)

Follows the exact reveal route structure. Clears votes hash and sets `revealed=false` atomically using `redis.multi()`.

```typescript
// Source: established pattern from app/api/rooms/[roomId]/reveal/route.ts
// POST /api/rooms/[roomId]/reset

// Auth guard — same host-token cookie + validateToken pattern
// Then:
const tx = redis.multi()
tx.hset(keys.room(roomId), { revealed: 'false', voteCount: '0' })
tx.del(keys.votes(roomId))
await tx.exec()

// Re-apply TTL on votes key (del removes it, TTL needs re-setting on next vote cast)
// NOTE: votes key TTL is set on room creation only; after del, TTL is gone
// New votes route already handles this — the votes key gets a fresh TTL on next rpush
// (Review: current vote route uses hset which doesn't reset TTL — verify in Phase 4)

// Idempotency guard: if not revealed, reset is a no-op (return 409 or 200)
// Decision: return 409 if !room.revealed to prevent unintended resets

// Pusher broadcast: 'round-reset' event (empty payload — clients call refreshRoom)
await pusherServer.trigger(roomChannel(roomId), 'round-reset', {})
```

**`useRoom` hook extension** — add binding for `round-reset`:
```typescript
channel.bind('round-reset', onEvent)
```

### Pattern 3: Next-Story Route (LOG-01)

The most complex route. Must atomically reset room state AND append to the log.

```typescript
// POST /api/rooms/[roomId]/next-story
// Body: { estimate: string }

// Validation: estimate must be non-empty string, max 20 chars (consistent with card values)
// Auth guard: host-only

// 1. Append log entry FIRST (before reset, so entry is durable even if reset fails)
const entry: LogEntry = {
  story: room.currentStory,
  estimate: trimmedEstimate,
}
await redis.rpush(keys.log(roomId), JSON.stringify(entry))
// NOTE: rpush on an existing key preserves TTL; key was pre-expired in createRoom()

// 2. Atomic reset of room state
const tx = redis.multi()
tx.hset(keys.room(roomId), {
  revealed: 'false',
  voteCount: '0',
  currentStory: '',
})
tx.del(keys.votes(roomId))
await tx.exec()

// 3. Pusher broadcast: 'story-logged' event
await pusherServer.trigger(roomChannel(roomId), 'story-logged', {})
// Empty payload — clients call refreshRoom which fetches updated log
```

**`useRoom` hook extension** — add binding for `story-logged`:
```typescript
channel.bind('story-logged', onEvent)
```

### Pattern 4: HostControls Three-State Logic

`HostControls` needs a new `revealed` prop to switch between states. Internal `uiState` drives which button set renders.

```typescript
// Three UI states:
type HostUIState = 'voting' | 'post-reveal' | 'entering-estimate'

// State transitions:
// 'voting' → 'post-reveal': when revealed prop becomes true (useEffect watching revealed)
// 'post-reveal' → 'voting': after reset succeeds
// 'post-reveal' → 'entering-estimate': when host clicks "Next Story →"
// 'entering-estimate' → 'voting': after next-story confirm succeeds
// 'entering-estimate' → 'post-reveal': on Cancel

// IMPORTANT: sync uiState with revealed prop
useEffect(() => {
  if (!revealed) setUiState('voting')
  // Don't force to 'post-reveal' on mount if host is mid-entry
  // Simpler: if revealed and uiState === 'voting', switch to 'post-reveal'
  if (revealed && uiState === 'voting') setUiState('post-reveal')
}, [revealed])
```

### Pattern 5: Vote Stats Computation (POST-02)

Pure client-side computation from `room.participants`. Runs only when `room.revealed === true`.

```typescript
// Source: design decisions in CONTEXT.md
// Non-numeric values: '∞' and '?'
const NUMERIC_RE = /^\d+$/

function computeStats(participants: ParticipantView[]) {
  const voters = participants.filter(p => p.role === 'voter' && p.value !== undefined)
  if (voters.length === 0) return null

  const numeric = voters.filter(p => NUMERIC_RE.test(p.value!)).map(p => parseInt(p.value!, 10))
  const nonNumericCount = voters.length - numeric.length

  if (numeric.length === 0) return null  // all non-numeric → skip stats entirely

  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length

  const isConsensus = voters.every(p => p.value === voters[0].value)

  return { min, max, avg, isConsensus, consensusValue: voters[0].value, nonNumericCount }
}
```

**Consensus display:** When `isConsensus === true` AND all voters have a value AND voters.length > 0, show `✓ Consensus: X` in green. The consensus check should only fire when all voters have voted (i.e., no `undefined` values after reveal).

### Pattern 6: Clipboard Export (LOG-03)

```typescript
// Source: Web Clipboard API — browser built-in
// No library needed

function buildMarkdownTable(log: LogEntry[]): string {
  const header = '| Story | Points |\n|-------|--------|'
  const rows = log.map(e => `| ${e.story} | ${e.estimate} |`).join('\n')
  return `${header}\n${rows}`
}

async function handleCopy() {
  const text = buildMarkdownTable(log)
  await navigator.clipboard.writeText(text)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

**Button label:** `copied ? '✓ Copied!' : 'Copy'` — consistent with the Phase 2 no-toast pattern.

### Anti-Patterns to Avoid
- **Storing log as a Redis hash with numeric keys:** Use a Redis list (`rpush`/`lrange`) — it's the correct data structure for an ordered append-only log.
- **Computing stats on the server:** Stats are derived purely from `participants` data already in the GET response; computing server-side adds no value and increases route complexity.
- **Using `pipeline()` instead of `multi()` for reset:** `pipeline()` is NOT atomic. `multi()` is atomic. Same lesson learned from the reveal route.
- **Fetching log separately from the room:** No separate `/api/rooms/[roomId]/log` endpoint needed — include it in the existing GET response per the established "single fetch" pattern.
- **Modal for estimate entry:** Explicitly decided against. Use inline state in HostControls panel.
- **Toast notifications:** The project explicitly uses no-toast; button text swap is the only feedback mechanism.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic Redis state reset | Manual sequential hset + del | `redis.multi()` with `tx.hset()` + `tx.del()` | Non-atomic sequential writes create a race window where one client sees revealed=false but votes still present |
| Clipboard writing | `document.execCommand('copy')` | `navigator.clipboard.writeText()` | `execCommand` is deprecated; Clipboard API is the standard and already supported by all targets |
| Ordered log storage | Redis hash with incremental keys or JSON array in a single string | Redis list with `rpush`/`lrange` | Native ordered structure; no deserialization of the entire list on append; TTL works correctly |

**Key insight:** The existing `redis.multi()` pattern from the reveal route is the blueprint for all state-mutation routes in this phase.

---

## Common Pitfalls

### Pitfall 1: TTL Loss on `redis.del(votes)`
**What goes wrong:** The reveal route pre-sets TTL on `keys.votes(roomId)` at room creation. When `reset` calls `tx.del(keys.votes(roomId))`, the key is deleted. The next time a participant casts a vote, `hset` creates a new key WITHOUT a TTL — votes could accumulate indefinitely.
**Why it happens:** Redis `del` removes the key and its TTL. `hset` on a non-existent key creates it without TTL.
**How to avoid:** In the vote route, after `hset`, call `redis.expire(keys.votes(roomId), ROOM_TTL_SECONDS)`. Review whether the existing vote route already does this.
**Warning signs:** Votes key persisting after room hash expires.

### Pitfall 2: Consensus False Positive When Not All Voters Have Voted
**What goes wrong:** `computeStats` checks `voters.every(p => p.value === voters[0].value)`. If some voters haven't submitted a vote, `p.value` is `undefined`, and `undefined === undefined` evaluates to `true`, triggering a false consensus.
**Why it happens:** JavaScript equality; unvoted participants have no `value` field on the revealed view but are still in the participants array.
**How to avoid:** Filter to only participants who have a defined value: `const voters = participants.filter(p => p.role === 'voter' && p.value !== undefined)`. Check `voters.length === allVoters.length` before declaring consensus, or simply rely on the filter — if the server prevents reveal before anyone voted, all voter values will be present post-reveal.

### Pitfall 3: `useEffect` Dependency Loop in HostControls State Sync
**What goes wrong:** Syncing `uiState` with the `revealed` prop via `useEffect` that also reads `uiState` causes re-render loops if not careful.
**Why it happens:** `useEffect` depending on both `revealed` and `uiState` fires whenever either changes; if the effect sets `uiState`, it triggers another run.
**How to avoid:** The effect should only have `[revealed]` as dependency; the `uiState` read inside the effect is fine (closure captures current value without re-triggering on uiState changes).

### Pitfall 4: `rpush` on a Non-Existent Key After TTL Expiry
**What goes wrong:** `keys.log(roomId)` TTL is set at room creation. If a session runs close to 24h, the log key may expire while the room hash is still alive. `rpush` auto-creates the key but without TTL.
**Why it happens:** Redis list `rpush` on a non-existent key creates it with no expiry.
**How to avoid:** After each `rpush`, call `redis.expire(keys.log(roomId), ROOM_TTL_SECONDS)`. This is idempotent — resetting TTL to 24h from now on every story completion is the correct behavior.

### Pitfall 5: Next.js 16 Async Params Pattern
**What goes wrong:** Writing `{ params }: { params: { roomId: string } }` instead of `{ params }: { params: Promise<{ roomId: string }> }` causes a runtime error in Next.js 16.
**Why it happens:** Next.js 16 changed params to be a Promise (consistent with other async APIs).
**How to avoid:** All new routes must use `const { roomId } = await params`. Confirmed by reviewing existing routes in the codebase — they all follow this pattern.

### Pitfall 6: `navigator.clipboard` Requires Secure Context
**What goes wrong:** `navigator.clipboard.writeText()` throws in non-HTTPS contexts (except localhost).
**Why it happens:** Clipboard API requires a secure context (HTTPS or localhost) per browser security policy.
**How to avoid:** Development (localhost) and production (Vercel HTTPS) both satisfy this. No fallback needed for this project's targets.

---

## Code Examples

Verified patterns from existing codebase:

### Upstash Redis List Operations
```typescript
// rpush — append to list (creates key if not exists)
await redis.rpush(keys.log(roomId), JSON.stringify(entry))
// Re-set TTL after rpush to prevent expiry drift:
await redis.expire(keys.log(roomId), ROOM_TTL_SECONDS)

// lrange — fetch all entries (0 to -1 = entire list)
const raw = await redis.lrange(keys.log(roomId), 0, -1)
// raw is string[] — each element is a JSON-encoded LogEntry
```

### Atomic Reset Pattern
```typescript
// Source: established in reveal route (app/api/rooms/[roomId]/reveal/route.ts)
const tx = redis.multi()
tx.hset(keys.room(roomId), {
  revealed: 'false',
  voteCount: '0',
  currentStory: '',
})
tx.del(keys.votes(roomId))
await tx.exec()
```

### Existing Route Auth Guard Pattern
```typescript
// Source: all existing host-only routes
const cookieStore = await cookies()
const rawToken = cookieStore.get(`host-token-${roomId}`)?.value
if (!rawToken) return Response.json({ error: 'Forbidden' }, { status: 403 })

const room = await getRoom(roomId)
if (!room) return Response.json({ error: 'Room not found' }, { status: 404 })

if (!await validateToken(rawToken, room.hostToken)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Pusher Non-Blocking Trigger Pattern
```typescript
// Source: all existing routes
try {
  await pusherServer.trigger(roomChannel(roomId), 'story-logged', {})
} catch (err) {
  console.error('Pusher trigger failed:', err)
}
```

### Upstash Auto-Deserialization Guard
```typescript
// Source: lib/room.ts getParticipants — same guard needed in getLog
return raw.map(v => typeof v === 'string' ? JSON.parse(v) : v as LogEntry)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `document.execCommand('copy')` | `navigator.clipboard.writeText()` | ~2020 (Clipboard API widespread) | `execCommand` is deprecated; async Clipboard API is universal in Chromium, Firefox, Safari |
| Next.js 14 sync params | Next.js 15+/16 async params (`params: Promise<...>`) | Next.js 15 | MUST await params before destructuring — existing routes in this project already follow this |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Deprecated in all browsers. Use `navigator.clipboard.writeText()`.
- Pipeline for atomic operations: `redis.pipeline()` is non-atomic. For atomicity, always use `redis.multi()`.

---

## Open Questions

1. **Vote route TTL after `del(votes)`**
   - What we know: `createRoom()` sets TTL on `keys.votes(roomId)`. `reset` route deletes the votes key via `tx.del()`.
   - What's unclear: Does the existing vote route re-set TTL on `hset`? If not, votes key after a reset will have no expiry.
   - Recommendation: Add `redis.expire(keys.votes(roomId), ROOM_TTL_SECONDS)` in the vote route as a defensive measure, or in the reset route after `tx.exec()`. Review the vote route during implementation.

2. **Consensus with observers present**
   - What we know: Observers have `role === 'observer'` and no `value`. Stats should only consider voters.
   - What's unclear: No ambiguity — `filter(p => p.role === 'voter')` handles this correctly.
   - Recommendation: Confirmed non-issue.

3. **Empty `currentStory` on next-story**
   - What we know: `next-story` clears `currentStory` to `''`. The story title used in the log entry is captured before the reset.
   - What's unclear: Should `next-story` be rejected if `currentStory` is empty? An empty story title in the log would look wrong.
   - Recommendation: Validate that `room.currentStory` is non-empty before appending to log; return 422 if empty.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/api/reset.test.ts tests/api/next-story.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POST-01 | Voter name + value visible after reveal | unit (existing) | `npx vitest run tests/api/reveal.test.ts` | Yes (reveal.test.ts covers VOTE-04; POST-01 is render-only, no new API) |
| POST-02 | Vote stats computed correctly (min/max/avg, consensus, non-numeric exclusion) | unit | `npx vitest run tests/lib/stats.test.ts` | No — Wave 0 gap |
| POST-03 | Reset route clears votes, sets revealed=false, preserves story | unit | `npx vitest run tests/api/reset.test.ts` | No — Wave 0 gap |
| LOG-01 | Next-story appends to log, resets room, broadcasts story-logged | unit | `npx vitest run tests/api/next-story.test.ts` | No — Wave 0 gap |
| LOG-02 | GET /api/rooms/[roomId] returns log field with entries | unit | `npx vitest run tests/api/rooms.test.ts` | Partial (rooms.test.ts exists; needs extension for log field) |
| LOG-03 | Markdown table format is correct (header + rows, no extras) | unit | `npx vitest run tests/lib/clipboard.test.ts` | No — Wave 0 gap |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/reset.test.ts tests/api/next-story.test.ts tests/lib/stats.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/reset.test.ts` — covers POST-03 (host-only, atomic multi, Pusher broadcast, 403/404/409 guards)
- [ ] `tests/api/next-story.test.ts` — covers LOG-01 (rpush, multi reset, Pusher, empty story guard)
- [ ] `tests/lib/stats.test.ts` — covers POST-02 (numeric filtering, avg precision, consensus detection, all-non-numeric skip)
- [ ] `tests/lib/clipboard.test.ts` — covers LOG-03 (markdown table format, empty log, special characters in story titles)
- [ ] `tests/api/rooms.test.ts` — extend existing file to assert `log` field present in GET response (empty array when no entries)

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `lib/room.ts`, `types/room.ts`, `app/api/rooms/[roomId]/reveal/route.ts`, `hooks/useRoom.ts`, `components/HostControls.tsx`, `app/room/[roomId]/page.tsx`
- `node_modules/@upstash/redis/nodejs.d.ts` — Confirmed: `RPushCommand`, `LRangeCommand`, `LLenCommand` all present in the Upstash SDK v1.37.0
- `.planning/phases/03-session-output/03-CONTEXT.md` — User decisions (authoritative for this phase)
- `vitest.config.ts` — Test infrastructure configuration

### Secondary (MEDIUM confidence)
- Web Clipboard API — `navigator.clipboard.writeText()` standard; secure context requirement is documented behavior across all major browsers

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; confirmed via package.json and type definitions
- Architecture: HIGH — all patterns directly copied from established codebase patterns
- Pitfalls: HIGH — derived from direct code inspection of existing routes and Redis behavior
- Test infrastructure: HIGH — vitest.config.ts and test file patterns are confirmed

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack — Next.js 16, Pusher, Upstash; no fast-moving dependencies for this phase's work)
