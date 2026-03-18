---
phase: 01-foundation
plan: "04"
subsystem: ui
tags: [react, nextjs, pusher, tailwind, hooks]

# Dependency graph
requires:
  - phase: 01-foundation-03
    provides: POST /api/rooms, GET /api/rooms/[roomId], POST /api/rooms/[roomId]/join API routes

provides:
  - Landing page with Create Room button (app/page.tsx)
  - Room page orchestrating JoinForm and ParticipantList (app/room/[roomId]/page.tsx)
  - Extracted JoinForm component with voter and observer join buttons (components/JoinForm.tsx)
  - Extracted ParticipantList + ParticipantItem components (components/ParticipantList.tsx)
  - Pusher subscription hook skeleton for Phase 2 (hooks/useRoom.ts)
  - Environment variable example file documenting all required variables (.env.local.example)

affects: [02-voting, 03-realtime, Phase 2 Pusher presence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract components at module level — never define components inside components to prevent remount on parent re-render"
    - "Composition over boolean props — RoomPage conditionally renders JoinForm or ParticipantList directly"
    - "Server-side cookie forwarding — GET /api/rooms/[roomId] reads participant cookie and includes myParticipantId so client skips join form for returning participants"
    - "Upstash auto-deserialization guard — typeof check before JSON.parse in getParticipants"
    - "useCallback with explicit dependencies — all event handlers and async fetchers wrapped in useCallback"

key-files:
  created:
    - app/page.tsx
    - app/room/[roomId]/page.tsx
    - components/JoinForm.tsx
    - components/ParticipantList.tsx
    - hooks/useRoom.ts
    - .env.local.example
  modified:
    - lib/room.ts
    - app/api/rooms/[roomId]/route.ts

key-decisions:
  - "Module-level component extraction: JoinForm, ParticipantList, and ParticipantItem defined at module level — prevents React from treating them as new component types on parent re-render (no input focus loss)"
  - "Cookie-driven join state: GET /api/rooms/[roomId] returns myParticipantId from participant cookie so the room page correctly shows participant list instead of join form for already-joined users on refresh"
  - "Upstash auto-deserialization: Upstash SDK may return already-parsed objects; getParticipants now checks typeof before JSON.parse to avoid 'unexpected token' errors"

patterns-established:
  - "Component extraction: top-level file per component, no inline definitions inside other components"
  - "Composition pattern: parent renders child A or child B based on state — no boolean props passed to shared components"
  - "Hook skeleton pattern: Phase 1 hooks subscribe to channel and return ref; Phase 2 binds event handlers"

requirements-completed: [SESS-01, IDNT-01]

# Metrics
duration: 45min
completed: 2026-03-18
---

# Phase 01 Plan 04: UI Shell Summary

**React UI shell with module-level JoinForm and ParticipantList components, landing page with room creation, and a Pusher subscription hook stub for Phase 2**

## Performance

- **Duration:** ~45 min (including human verification and post-checkpoint bug fixes)
- **Started:** 2026-03-18T19:25:00Z
- **Completed:** 2026-03-18T21:49:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 8

## Accomplishments
- Landing page with Create Room button that calls POST /api/rooms and redirects to /room/{roomId}
- Room page that composes JoinForm and ParticipantList — no boolean props, no inline component definitions
- JoinForm with both Voter and Observer join paths, error display, and functional setState patterns
- ParticipantList with extracted ParticipantItem sub-component showing vote status and "(you)" indicator
- Pusher subscription hook skeleton ready for Phase 2 event binding
- Post-checkpoint fixes: Upstash deserialization guard and server-side cookie forwarding for join-state persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Build UI shell** - `3e71cc9` (feat)
2. **Task 2: Post-checkpoint bug fixes** - `8e98d10` (fix)

**Plan metadata:** (created in final commit)

## Files Created/Modified
- `app/page.tsx` - Landing page with Create Room button, useCallback-wrapped handler, error display
- `app/room/[roomId]/page.tsx` - Room orchestration: conditionally renders JoinForm or ParticipantList based on join state
- `components/JoinForm.tsx` - Voter and observer join buttons, name input, error display, useCallback for handlers
- `components/ParticipantList.tsx` - Participant list with module-level ParticipantItem sub-component
- `hooks/useRoom.ts` - Pusher channel subscription skeleton; Phase 2 will bind event handlers
- `.env.local.example` - All six required environment variables documented
- `lib/room.ts` - getParticipants: typeof guard before JSON.parse (Upstash auto-deserialization fix)
- `app/api/rooms/[roomId]/route.ts` - GET now reads participant cookie and returns myParticipantId in response

## Decisions Made
- Module-level component extraction enforced for JoinForm, ParticipantList, and ParticipantItem to prevent React remounting them on parent re-renders (prevents input focus loss on keystroke)
- Server-side cookie forwarding added to GET /api/rooms/[roomId] so the room page can skip the join form for returning participants without a separate cookie-reading endpoint
- Upstash SDK returns pre-parsed objects when values are stored as JSON objects; added typeof check before JSON.parse rather than wrapping in try/catch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Upstash auto-deserialization in getParticipants**
- **Found during:** Human verification (post-checkpoint)
- **Issue:** Upstash Redis SDK sometimes returns already-parsed objects instead of JSON strings; `JSON.parse(v as string)` threw "Unexpected token" when given an object
- **Fix:** Added `typeof v === 'string' ? JSON.parse(v) : v` guard in `getParticipants`
- **Files modified:** `lib/room.ts`
- **Verification:** Participant list renders correctly after join
- **Committed in:** `8e98d10`

**2. [Rule 2 - Missing Critical] Added myParticipantId to GET /api/rooms/[roomId] response**
- **Found during:** Human verification (post-checkpoint)
- **Issue:** Room page had no way to know if the current browser was already joined; join form always appeared on page load/refresh even for returning participants
- **Fix:** GET route reads the `participant-{roomId}` cookie and verifies the participantId exists in Redis before including it in the response; room page sets myParticipantId state from initial fetch
- **Files modified:** `app/api/rooms/[roomId]/route.ts`, `app/room/[roomId]/page.tsx`
- **Verification:** Reloading room page after joining shows participant list, not join form
- **Committed in:** `8e98d10`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes required for correct user experience. No scope creep — both directly relate to the join flow described in the plan's success criteria.

## Issues Encountered
- None during task 1 execution
- Two bugs surfaced during human verification: Upstash deserialization and missing join-state persistence (both fixed and committed post-checkpoint)

## User Setup Required
**External services require manual configuration.** Copy `.env.local.example` to `.env.local` and fill in:
- `PUSHER_APP_ID`, `NEXT_PUBLIC_PUSHER_KEY`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_CLUSTER` — from Pusher Dashboard (free Channels app)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — from Upstash Console (free Redis database)

## Next Phase Readiness
- Full create-and-join flow verified end to end by human testing
- `hooks/useRoom.ts` provides a clean Pusher subscription entry point for Phase 2 real-time event binding
- All 16 unit tests pass; TypeScript compiles cleanly
- Phase 2 can begin with vote submission UI and Pusher event handlers

---
*Phase: 01-foundation*
*Completed: 2026-03-18*
