---
phase: 04-reconnection-and-polish
plan: "01"
subsystem: api
tags: [reconnect, identity, cookie, redis, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: join route with cookie-based idempotency and UUID-primary identity
  - phase: 02-real-time-core
    provides: participant list in Redis via getParticipants
provides:
  - Name-match reconnect path in join route (IDNT-04): no-cookie requests whose name matches an existing participant are treated as reconnects and receive the original UUID
  - Name-uniqueness enforcement: no-cookie requests with a name not in the room create a new participant as before
  - Unit tests covering all three join paths (cookie path A, reconnect path B1, new participant path B2)
affects: [any feature that reads participant identity, vote submission, session log]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single getParticipants call before branching — avoids double Redis round-trip in no-cookie path"
    - "Name comparison with === (both sides trimmed at input time via zod schema)"
    - "Reconnect path skips joinRoom and Pusher trigger — existing Redis record reused as-is"

key-files:
  created: []
  modified:
    - app/api/rooms/[roomId]/join/route.ts
    - tests/api/join.test.ts

key-decisions:
  - "No-cookie request with name already in room is treated as reconnect (not rejected) — accepted trust tradeoff for team setting"
  - "getParticipants called once in Path B before branching — result shared between name-match check and new-participant path to avoid double Redis round-trip"
  - "Reconnect path does NOT call joinRoom() or trigger Pusher — existing Redis record is reused, no state mutation"
  - "Cookie re-issuance on reconnect uses identical options to original join: httpOnly, secure, sameSite strict, maxAge 86400, path /"

patterns-established:
  - "TDD red-green commit sequence: test commit (failing) → feat commit (passing)"
  - "Reconnect before new-participant: always check existing participants before generating new UUID"

requirements-completed: [IDNT-04]

# Metrics
duration: 1min
completed: 2026-03-19
---

# Phase 4 Plan 1: Name-Match Reconnect Summary

**Cookie-free participant reconnection via name-match lookup in join route, with single Redis call and no joinRoom/Pusher side-effects on reconnect**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-19T07:56:13Z
- **Completed:** 2026-03-19T07:57:13Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Added Path B to join route: `getParticipants` called once when no cookie present, result used for both name-match check and new-participant creation
- Path B1 (reconnect): name found in participants hash → re-issues cookie with existing UUID, returns existing participant, skips joinRoom and Pusher trigger
- Path B2 (new joiner): name not found → original new-participant path unchanged
- Added 4 new unit tests in `describe('reconnect')` block covering all new behaviors
- Full test suite: 67 tests across 11 files, all green

## Task Commits

Each task was committed atomically (TDD pattern):

1. **Task 2 RED: Add failing reconnect test cases** - `8e81829` (test)
2. **Task 1 GREEN: Implement name-match reconnect in join route** - `16f0ad1` (feat)

_Note: TDD order followed — tests written first (RED), then implementation (GREEN)_

## Files Created/Modified

- `app/api/rooms/[roomId]/join/route.ts` - Added Path B (name-match reconnect branch B1 + existing new-participant branch B2)
- `tests/api/join.test.ts` - Added `describe('reconnect')` with 4 test cases

## Decisions Made

- Name comparison uses `===` — both sides trimmed at input time (zod schema trims incoming name; stored names were trimmed at original join time), no case folding needed
- No 409 rejection branch: a no-cookie request with a taken name IS the reconnect path — returning existing UUID, not creating new (trusted team context per CONTEXT.md)
- getParticipants call moved to before the branching point (not inside each branch) — single Redis round-trip for the entire no-cookie path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TDD sequence proceeded cleanly: RED (3 new failures), GREEN (all 9 tests pass), full suite (67/67 green).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Join route now supports three clean paths: existing cookie, name-match reconnect, new participant
- Reconnect path is stateless from the server's perspective — no data mutation, no events
- Ready for Phase 4 Plan 2 (UI-level reconnect feedback if applicable)

---
*Phase: 04-reconnection-and-polish*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: app/api/rooms/[roomId]/join/route.ts
- FOUND: tests/api/join.test.ts
- FOUND: .planning/phases/04-reconnection-and-polish/04-01-SUMMARY.md
- FOUND: commit 8e81829 (test RED)
- FOUND: commit 16f0ad1 (feat GREEN)
