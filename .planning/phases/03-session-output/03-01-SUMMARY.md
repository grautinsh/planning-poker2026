---
phase: 03-session-output
plan: 01
subsystem: testing
tags: [vitest, tdd, stubs, red-phase]

# Dependency graph
requires:
  - phase: 02-real-time-core
    provides: Existing test patterns (reveal.test.ts, story.test.ts), lib/room.ts keys, types/room.ts

provides:
  - Failing test stubs for computeStats (POST-02)
  - Failing test stubs for buildMarkdownTable (LOG-03)
  - Failing test stubs for POST /reset (POST-03)
  - Failing test stubs for POST /next-story (LOG-01)
  - Log field assertion extension in rooms.test.ts (LOG-02)
  - LogEntry type in types/room.ts
  - Stub lib files (lib/stats.ts, lib/clipboard.ts) with TODO throws
  - Stub route files (reset/route.ts, next-story/route.ts) with TODO throws

affects: [03-02-PLAN, 03-03-PLAN, 03-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED stubs: create stub implementation files that throw 'TODO: not implemented' so test imports resolve but tests fail; vi.mock not needed when real stub file exists"

key-files:
  created:
    - tests/lib/stats.test.ts
    - tests/lib/clipboard.test.ts
    - tests/api/reset.test.ts
    - tests/api/next-story.test.ts
    - lib/stats.ts
    - lib/clipboard.ts
    - app/api/rooms/[roomId]/reset/route.ts
    - app/api/rooms/[roomId]/next-story/route.ts
  modified:
    - tests/api/rooms.test.ts
    - types/room.ts

key-decisions:
  - "Stub implementation files created for non-existent modules: vitest cannot intercept vi.mock factories for modules that don't exist on disk — stub files (throwing TODO) are required for the import to resolve and tests to run"
  - "LogEntry type added to types/room.ts in Plan 01 rather than Plan 02 — required by clipboard.ts stub import chain"
  - "rooms.test.ts mock for lib/room extended with getLog: vi.fn().mockResolvedValue([]) ahead of Plan 02 implementation"

patterns-established:
  - "TDD Wave 0 pattern: stub files throw TODO, tests assert real expected values — tests fail because stub throws instead of returning expected result"
  - "API route stubs follow same pattern as lib stubs — minimal export that throws, real implementation replaces body in later plan"

requirements-completed: [POST-02, POST-03, LOG-01, LOG-02, LOG-03]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 3 Plan 01: Session Output — Wave 0 Test Stubs Summary

**TDD RED stubs for 5 requirements: 27 failing tests across 4 new files and 1 extended file, with stub lib and route files so imports resolve**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T06:24:14Z
- **Completed:** 2026-03-19T06:29:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created 29 failing tests (27 fail red, 2 existing rooms tests still pass) across 5 test files
- Added LogEntry type, lib/stats.ts stub, lib/clipboard.ts stub for import chain resolution
- Created reset and next-story route stubs so API test imports don't crash
- Extended rooms.test.ts mock with getLog ahead of Plan 02 implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stats and clipboard test stubs** - `5f10631` (test)
2. **Task 2: Create reset and next-story API test stubs + extend rooms test** - `9495726` (test)

**Plan metadata:** (docs commit — see below)

_Note: TDD RED phase — stubs intentionally throw to make all tests fail._

## Files Created/Modified
- `tests/lib/stats.test.ts` - 6 failing tests for computeStats (POST-02)
- `tests/lib/clipboard.test.ts` - 4 failing tests for buildMarkdownTable (LOG-03)
- `tests/api/reset.test.ts` - 6 failing tests for POST /reset (POST-03)
- `tests/api/next-story.test.ts` - 9 failing tests for POST /next-story (LOG-01)
- `tests/api/rooms.test.ts` - Extended with 2 log field tests (LOG-02)
- `lib/stats.ts` - Stub: throws TODO, exports computeStats and StatsResult type
- `lib/clipboard.ts` - Stub: throws TODO, exports buildMarkdownTable
- `app/api/rooms/[roomId]/reset/route.ts` - Stub: throws TODO, exports POST handler
- `app/api/rooms/[roomId]/next-story/route.ts` - Stub: throws TODO, exports POST handler
- `types/room.ts` - Added LogEntry type ({ story, estimate })

## Decisions Made
- **Stub files over vi.mock**: vitest cannot mock modules that don't exist on disk — even with a vi.mock factory the module resolver rejects the path at import time. Solution: create stub implementation files that throw 'TODO: not implemented', which makes the import resolve while keeping all tests red.
- **LogEntry type in Plan 01**: Required earlier than planned (Plan 02 was the target) because lib/clipboard.ts stub imports it. No downstream impact.
- **rooms.test.ts getLog mock added preemptively**: The mock factory needed getLog to avoid a missing property warning when Plan 02 adds getLog to the GET route. Added as a passive mock (returns []) that doesn't affect existing tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub lib and route files so test imports resolve**
- **Found during:** Task 1 (stats and clipboard stubs), Task 2 (reset and next-story stubs)
- **Issue:** vitest module resolver rejects `@/lib/stats` etc. at the file system level before vi.mock factory can intercept — results in "Cannot find package" error and 0 tests running, violating "not 'no tests found'" done criteria
- **Fix:** Created minimal stub files (lib/stats.ts, lib/clipboard.ts, reset/route.ts, next-story/route.ts) that export the expected functions/handlers but throw 'TODO: not implemented' — imports resolve, tests run, tests fail red
- **Files modified:** lib/stats.ts, lib/clipboard.ts, app/api/rooms/[roomId]/reset/route.ts, app/api/rooms/[roomId]/next-story/route.ts
- **Verification:** npx vitest run shows 27 FAIL, 2 PASS, 0 "no tests found"
- **Committed in:** 5f10631 (Task 1), 9495726 (Task 2)

**2. [Rule 2 - Missing Critical] Added LogEntry type to types/room.ts**
- **Found during:** Task 1 (clipboard stub)
- **Issue:** lib/clipboard.ts stub imports LogEntry from @/types/room; type didn't exist yet
- **Fix:** Added `export type LogEntry = { story: string; estimate: string }` to types/room.ts
- **Files modified:** types/room.ts
- **Verification:** TypeScript import resolves, no type error
- **Committed in:** 5f10631 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking/missing)
**Impact on plan:** Both fixes required to achieve the plan's done criteria. The vi.mock limitation is a vitest-specific behavior; stub files are the standard workaround. No scope creep.

## Issues Encountered
- vitest's module resolver pre-checks file existence even with vi.mock factories — this is a known vitest behavior difference from Jest. The plan's suggested vi.mock pattern only works for modules that already exist on disk.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 Wave 0 test stubs in place and failing red
- Plan 02 (lib implementation) must implement computeStats and buildMarkdownTable to turn stats/clipboard tests green
- Plan 03 (route implementation) must implement reset and next-story handlers to turn API tests green
- Plan 02 must also add getLog to GET /api/rooms/[roomId] route and lib/room.ts to turn rooms.test.ts log tests green
- No blockers

---
*Phase: 03-session-output*
*Completed: 2026-03-19*
