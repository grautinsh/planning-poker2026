---
phase: 02-real-time-core
plan: "02"
subsystem: api
tags: [redis, pusher, zod, voting, anti-anchoring, atomic]

# Dependency graph
requires:
  - phase: 02-01
    provides: "lib/constants.ts (FIBONACCI_DECK), lib/room.ts (getRoom, keys), lib/auth.ts (validateToken), lib/pusher.ts (pusherServer, roomChannel), lib/redis.ts (redis with multi()), test infrastructure"
provides:
  - "POST /api/rooms/[roomId]/vote — vote submission with Fibonacci validation and reveal guard"
  - "POST /api/rooms/[roomId]/story — host-only story title update with Pusher broadcast"
  - "POST /api/rooms/[roomId]/reveal — atomic multi() reveal with vote-revealed Pusher event"
  - "RoomPageResponse type in types/room.ts extending RoomView with isHost and myParticipantId"
  - "GET /api/rooms/[roomId] returns isHost boolean derived from host-token cookie"
affects: [02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "redis.multi() for atomic reveal (not pipeline) — hset + hgetall in one transaction"
    - "Pusher triggers are non-blocking (try/catch) — unavailability does not block API response"
    - "Zod validation before Redis ops — fail fast, no wasted Redis calls"
    - "Vote value never in response body (VOTE-02) — anti-anchoring enforced at serialization layer"
    - "Host auth: cookie check → getRoom → validateToken sequence in host-only routes"

key-files:
  created:
    - app/api/rooms/[roomId]/vote/route.ts
    - app/api/rooms/[roomId]/story/route.ts
    - app/api/rooms/[roomId]/reveal/route.ts
    - tests/api/vote.test.ts
    - tests/api/story.test.ts
    - tests/api/reveal.test.ts
  modified:
    - types/room.ts
    - app/api/rooms/[roomId]/route.ts

key-decisions:
  - "redis.multi() enforced in reveal route — atomic snapshot of votes and revealed flag prevents race conditions"
  - "Vote-cast Pusher event carries empty payload {} — only signals that a vote occurred, never reveals the value"
  - "isHost derived per-request via validateToken (constant-time) — not cached in Redis to avoid stale host state"
  - "Participant cookie absence in vote route returns 401, not 403 — unauthenticated vs forbidden distinction"

patterns-established:
  - "Host auth sequence: rawToken from cookie → getRoom → validateToken — replicated in story and reveal routes"
  - "409 Conflict for state-machine violations (voting closed, already revealed) — not 400"
  - "Non-blocking Pusher pattern with try/catch — consistent across all routes"

requirements-completed: [SESS-04, VOTE-01, VOTE-02, VOTE-04, VOTE-05]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 02 Plan 02: API Routes (Vote, Story, Reveal) Summary

**Three server-side route handlers enforcing anti-anchoring invariants: vote redaction until reveal, Fibonacci-only validation, atomic redis.multi() reveal, and host-auth gate on story/reveal endpoints**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-19T04:47:56Z
- **Completed:** 2026-03-19T04:51:29Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- POST /api/rooms/[roomId]/vote: validates Fibonacci deck membership (Zod enum), guards against post-reveal voting (409), stores in Redis votes hash, triggers vote-cast with empty payload (VOTE-01, VOTE-02, VOTE-05)
- POST /api/rooms/[roomId]/story: host-only with validateToken, 1-200 char title validation, hsets currentStory, triggers story-updated (SESS-04)
- POST /api/rooms/[roomId]/reveal: host-only, uses redis.multi() for atomic hset+hgetall, triggers vote-revealed with full votes payload (VOTE-04)
- GET /api/rooms/[roomId] extended: now returns isHost boolean derived from host-token cookie via validateToken
- RoomPageResponse type added to types/room.ts formalizing GET response shape

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement vote, story, and reveal API routes** - `2c3f7d1` (feat)
2. **Task 2: Extend types/room.ts and update GET route to include isHost** - `ef38fc8` (feat)

## Files Created/Modified
- `app/api/rooms/[roomId]/vote/route.ts` - POST vote handler: Fibonacci validation, reveal guard, Redis hset, Pusher vote-cast
- `app/api/rooms/[roomId]/story/route.ts` - POST story handler: host auth, title validation, Redis hset, Pusher story-updated
- `app/api/rooms/[roomId]/reveal/route.ts` - POST reveal handler: host auth, redis.multi() atomic transaction, Pusher vote-revealed
- `tests/api/vote.test.ts` - 8 tests covering VOTE-01, VOTE-02, VOTE-05 (describe.skip removed)
- `tests/api/story.test.ts` - 7 tests covering SESS-04 (describe.skip removed)
- `tests/api/reveal.test.ts` - 7 tests covering VOTE-04 (describe.skip removed)
- `types/room.ts` - Added RoomPageResponse type extending RoomView
- `app/api/rooms/[roomId]/route.ts` - Added isHost derivation via validateToken + cookie

## Decisions Made
- Used `redis.multi()` (not `pipeline()`) for atomic reveal — multi() guarantees both hset and hgetall execute as one unit
- vote-cast Pusher event sends empty payload — only the event itself signals activity, never revealing vote value
- `isHost` computed via `validateToken` (constant-time comparison) on every GET request — prevents host token leakage through timing attacks
- 409 Conflict for voting-after-reveal and double-reveal — clear state-machine violation semantics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required beyond what Phase 01 already set up.

## Next Phase Readiness
- All three API routes are available for client integration in plans 02-03 through 02-05
- Vote security invariants (redaction, reveal guard, atomic reveal) are enforced server-side
- isHost boolean in GET response enables host-only UI controls in plan 02-05
- redis.multi() pattern established — reusable if future operations require atomicity

## Self-Check: PASSED

All created files confirmed present. All task commits verified in git log.

---
*Phase: 02-real-time-core*
*Completed: 2026-03-19*
