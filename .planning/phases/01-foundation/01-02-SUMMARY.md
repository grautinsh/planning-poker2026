---
phase: 01-foundation
plan: 02
subsystem: database
tags: [redis, upstash, pusher, typescript, tdd, vitest]

# Dependency graph
requires:
  - phase: 01-foundation-plan-01
    provides: Next.js scaffold, vitest config, test stub files in RED state

provides:
  - types/room.ts — RoomData, ParticipantData, ParticipantView, RoomView
  - lib/auth.ts — hashToken (SHA-256 hex), validateToken (timing-safe)
  - lib/redis.ts — Upstash Redis singleton
  - lib/pusher.ts — Pusher server singleton, roomChannel() helper
  - lib/pusher-client.ts — Pusher browser singleton (use client)
  - lib/room.ts — keys helpers, createRoom, joinRoom, toRoomView, getRoom, getParticipants

affects: [01-foundation-plan-03, 01-foundation-plan-04, phase-02]

# Tech tracking
tech-stack:
  added: [@upstash/redis, pusher, pusher-js (singletons wired), vitest globals]
  patterns: [Redis key namespace with TTL, UUID-keyed participant hash, serialization filter for vote redaction, timing-safe token comparison]

key-files:
  created:
    - types/room.ts
    - lib/auth.ts
    - lib/redis.ts
    - lib/pusher.ts
    - lib/pusher-client.ts
    - lib/room.ts
  modified:
    - tests/lib/auth.test.ts
    - tests/lib/room.test.ts
    - tsconfig.json

key-decisions:
  - "Upstash Redis singleton instantiated at module level — reused across all route handler invocations"
  - "Redis key helpers centralized in lib/room.ts keys object — all key construction goes through this single source of truth"
  - "toRoomView serialization filter uses spread operator to conditionally include value field — value property is absent (not undefined) when revealed=false"
  - "timingSafeEqual from Node crypto used for token validation — prevents timing attacks on token comparison"
  - "tsconfig.json updated with vitest/globals types so tsc --noEmit exits 0 without @types/jest"

patterns-established:
  - "Redis singleton pattern: instantiate once at module level, import { redis } everywhere"
  - "Key namespace pattern: keys.room(id), keys.votes(id), keys.participants(id), keys.log(id)"
  - "TTL pattern: expire all four room keys after createRoom to prevent orphaned keys"
  - "Participant UUID pattern: participantId (UUID) is always the hash key, display name is stored in JSON value only"
  - "Serialization filter pattern: toRoomView strips vote values when room.revealed === false"

requirements-completed: [SESS-01, SESS-02, SESS-03, IDNT-02]

# Metrics
duration: 7min
completed: 2026-03-18
---

# Phase 1 Plan 02: Lib Layer Summary

**Redis-backed room model with UUID-keyed participants, vote-redacting serialization, Upstash/Pusher singletons, and SHA-256 timing-safe host auth — 9 tests GREEN, tsc --noEmit exits 0**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T19:11:33Z
- **Completed:** 2026-03-18T19:18:43Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Defined TypeScript types (RoomData, ParticipantData, ParticipantView, RoomView) — shared contract for entire project
- Implemented host auth with SHA-256 hashing and timing-safe comparison
- Built Redis room model with correct key namespace, 86400s TTL on all 4 key types, UUID-keyed participant storage
- Vote redaction serialization filter enforced server-side in toRoomView — value field absent when revealed=false
- Wired Upstash Redis, Pusher server, and Pusher browser singletons

## Task Commits

Each task was committed atomically:

1. **Task 1: Define shared types and implement lib/auth.ts** - `d0d8ea2` (feat)
2. **Task 2: Implement lib/redis.ts, lib/pusher.ts, lib/pusher-client.ts, lib/room.ts** - `6e3fa14` (feat)

## Files Created/Modified
- `types/room.ts` - Shared TypeScript types: RoomData, ParticipantData, ParticipantView, RoomView
- `lib/auth.ts` - hashToken (SHA-256 hex string) and validateToken (timing-safe comparison)
- `lib/redis.ts` - Upstash Redis singleton, imported by lib/room.ts
- `lib/pusher.ts` - Pusher server singleton + roomChannel() naming helper
- `lib/pusher-client.ts` - Pusher browser singleton with 'use client' directive
- `lib/room.ts` - Redis key helpers, createRoom, joinRoom, toRoomView, getRoom, getParticipants
- `tests/lib/auth.test.ts` - Updated from stub to real tests — 3 tests GREEN
- `tests/lib/room.test.ts` - Updated from stub to real tests with mocked Redis — 6 tests GREEN
- `tsconfig.json` - Added vitest/globals types reference for tsc compatibility

## Decisions Made
- Upstash Redis singleton instantiated at module level for reuse across route handler invocations
- Redis key helpers centralized in lib/room.ts `keys` object — single source of truth for key names
- `toRoomView` uses spread operator to make value field absent (not undefined) when revealed=false
- `timingSafeEqual` from Node's built-in `crypto` module — prevents timing attacks without external deps
- Added `"types": ["vitest/globals"]` to tsconfig.json so tsc --noEmit exits 0 without installing @types/jest

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added vitest/globals to tsconfig.json types**
- **Found during:** Task 2 (final verification with tsc --noEmit)
- **Issue:** TypeScript reported "Cannot find name 'describe'" and "Cannot find name 'expect'" in test files — tsc --noEmit would not exit 0 as required
- **Fix:** Added `"types": ["vitest/globals"]` to tsconfig.json compilerOptions — vitest includes globals.d.ts in its package
- **Files modified:** tsconfig.json
- **Verification:** npx tsc --noEmit exits 0, all 9 tests still GREEN
- **Committed in:** 6e3fa14 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (missing critical)
**Impact on plan:** Required for tsc --noEmit to pass — no scope creep, purely a TypeScript config correctness fix.

## Issues Encountered
- Plan 01-01 (project scaffolding) had not been executed prior to this plan execution. The project was already fully scaffolded and committed (Next.js 16, all deps, vitest config, test stubs), so execution of 01-02 proceeded without issue. No SUMMARY.md existed for 01-01.

## User Setup Required
**External services require configuration before runtime use:**
- `UPSTASH_REDIS_REST_URL` — from Upstash console
- `UPSTASH_REDIS_REST_TOKEN` — from Upstash console
- `PUSHER_APP_ID`, `NEXT_PUBLIC_PUSHER_KEY`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_CLUSTER` — from Pusher dashboard

These are not needed for tests (Redis is mocked in room.test.ts) but are required for any route handler to function.

## Next Phase Readiness
- All lib-layer imports are ready: `@/lib/room`, `@/lib/auth`, `@/lib/redis`, `@/lib/pusher`, `@/lib/pusher-client`
- Plan 01-03 (API routes) can import directly from these modules
- tests/api/rooms.test.ts and tests/api/join.test.ts remain RED — correct state for Plan 01-03

---
*Phase: 01-foundation*
*Completed: 2026-03-18*
