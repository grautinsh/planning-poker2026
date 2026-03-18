---
phase: 01-foundation
plan: 03
subsystem: api
tags: [next.js, route-handlers, cookies, zod, pusher, redis, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-foundation-plan-02
    provides: lib/room.ts, lib/auth.ts, lib/redis.ts, lib/pusher.ts — all imports used by these route handlers

provides:
  - app/api/rooms/route.ts — POST /api/rooms (room creation with httpOnly host-token cookie)
  - app/api/rooms/[roomId]/route.ts — GET /api/rooms/[roomId] (room state with vote redaction via toRoomView)
  - app/api/rooms/[roomId]/join/route.ts — POST /api/rooms/[roomId]/join (participant join with UUID cookie, idempotent on refresh)

affects: [01-foundation-plan-04, phase-02]

# Tech tracking
tech-stack:
  added: [zod/v4 (request body validation)]
  patterns: [async params pattern (Next.js 15+/16), async cookies pattern, httpOnly cookie per-room naming, zod safeParse with flatten() error response, idempotent join via existing cookie check]

key-files:
  created:
    - app/api/rooms/route.ts
    - app/api/rooms/[roomId]/route.ts
    - app/api/rooms/[roomId]/join/route.ts
  modified:
    - tests/api/rooms.test.ts
    - tests/api/join.test.ts

key-decisions:
  - "Cookie naming includes roomId (host-token-{roomId}, participant-{roomId}) — prevents cross-room cookie collisions when user visits multiple rooms"
  - "join endpoint checks for existing participant cookie before creating new UUID — idempotency prevents duplicate participants on page refresh"
  - "Pusher trigger wrapped in try/catch in join route — Pusher unavailability does not block participant from joining"
  - "zod/v4 import path (not 'zod') — project uses zod v4 and the v4 subpath export is available and preferred"

patterns-established:
  - "async params pattern: { params }: { params: Promise<{ roomId: string }> } then const { roomId } = await params"
  - "async cookies pattern: const cookieStore = await cookies() — required in Next.js 15+/16"
  - "Per-room cookie naming: host-token-{roomId} and participant-{roomId} — scoped to specific room"
  - "Idempotent join: check cookie + verify in Redis, return existing identity if found"

requirements-completed: [SESS-01, SESS-02, SESS-03, IDNT-01, IDNT-02]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 1 Plan 03: API Routes Summary

**Three Next.js 16 App Router route handlers wiring lib layer to HTTP — room creation with httpOnly cookies, vote-redacting GET, and idempotent participant join with Pusher broadcast**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T19:21:46Z
- **Completed:** 2026-03-18T19:23:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- POST /api/rooms creates room via lib, issues httpOnly host-token-{roomId} cookie with 24h TTL
- GET /api/rooms/[roomId] returns vote-redacted RoomView via toRoomView — votes never exposed before reveal
- POST /api/rooms/[roomId]/join validates name with zod, assigns server UUID, sets httpOnly participant cookie, broadcasts via Pusher
- Idempotent join: existing cookie + Redis verification returns same participantId without creating duplicate participants
- All 16 tests pass GREEN (9 lib tests unchanged + 2 rooms API tests + 5 join API tests)
- TypeScript: npx tsc --noEmit exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement POST /api/rooms and GET /api/rooms/[roomId]** - `8262d54` (feat)
2. **Task 2: Implement POST /api/rooms/[roomId]/join** - `0845848` (feat)

## Files Created/Modified
- `app/api/rooms/route.ts` - POST handler: nanoid(8) roomId, crypto.randomUUID() host token, SHA-256 hash stored in Redis, httpOnly cookie set
- `app/api/rooms/[roomId]/route.ts` - GET handler: loads room + participants + votes from Redis, returns toRoomView result (votes redacted when revealed=false)
- `app/api/rooms/[roomId]/join/route.ts` - POST handler: zod validation, idempotent cookie check, UUID assignment, participant storage, Pusher trigger
- `tests/api/rooms.test.ts` - Updated from RED stubs to real integration tests with mocked Redis/auth/cookies
- `tests/api/join.test.ts` - Updated from RED stubs to real integration tests including idempotency and UUID-key assertion

## Decisions Made
- Cookie naming includes roomId (host-token-{roomId}, participant-{roomId}) to prevent cross-room collisions
- Join endpoint is idempotent: existing cookie + Redis verification returns same participantId without creating duplicates
- Pusher trigger wrapped in try/catch — Pusher unavailability does not block participant join
- zod/v4 subpath import confirmed working with installed zod v4.3.6

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
No new external services required. Same env vars as Plan 02 (Upstash Redis, Pusher) must be present for runtime.

## Next Phase Readiness
- All three Phase 1 API routes are implemented and tested
- Plan 01-04 (UI layer) can call POST /api/rooms, GET /api/rooms/[roomId], and POST /api/rooms/[roomId]/join
- Phase 2 (Vote Reveal) can import these routes as integration points and extend the join route for presence channel upgrade

---
*Phase: 01-foundation*
*Completed: 2026-03-18*

## Self-Check: PASSED
- app/api/rooms/route.ts: FOUND
- app/api/rooms/[roomId]/route.ts: FOUND
- app/api/rooms/[roomId]/join/route.ts: FOUND
- Commit 8262d54: FOUND
- Commit 0845848: FOUND
