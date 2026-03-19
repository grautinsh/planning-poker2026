---
phase: 04-reconnection-and-polish
plan: "02"
subsystem: ui
tags: [pusher, react, hooks, reconnection, tailwind, accessibility]

# Dependency graph
requires:
  - phase: 02-real-time-core
    provides: pusherClient singleton and useRoom hook with Pusher channel subscription

provides:
  - isDisconnected boolean from useRoom hook tracking Pusher 'unavailable' state
  - Fixed amber top-bar "Reconnecting..." banner with aria-live accessibility
  - Polished "Room not found" error card with icon, description, and CTA button

affects:
  - Any future work that modifies useRoom or the room page component

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Named connection state handler bound and unbound on Pusher connection object (not channel) within useEffect
    - Banner uses fixed positioning to avoid layout shift on appearance
    - State transitions: only 'unavailable' sets true, only 'connected' clears — resilient to intermediate retry states

key-files:
  created: []
  modified:
    - hooks/useRoom.ts
    - app/room/[roomId]/page.tsx

key-decisions:
  - "isDisconnected clears only on 'connected' (not on every non-'unavailable' state) — prevents banner disappearing during Pusher reconnect retry cycles"
  - "Banner uses fixed top-0 positioning (no layout shift) with amber palette distinct from page's slate palette"
  - "Banner guarded by room !== null — prevents flash during initial page load when room is still fetching"

patterns-established:
  - "Pusher connection state tracking: bind named handler inside useEffect, unbind in cleanup — enables precise removal"
  - "Banner visibility: two separate conditions (unavailable → show, connected → hide) rather than single equality check"

requirements-completed:
  - IDNT-04

# Metrics
duration: ~20min
completed: 2026-03-19
---

# Phase 4 Plan 02: Connection Banner and Room-Not-Found Polish Summary

**Pusher disconnection banner (amber fixed top bar) and polished "Room not found" error card added to room page, with isDisconnected state tracked in useRoom hook via named connection handler**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-19
- **Completed:** 2026-03-19
- **Tasks:** 2 auto + 1 human-verify + 1 bug fix
- **Files modified:** 2

## Accomplishments

- Extended `useRoom` hook to track Pusher connection state, returning `isDisconnected` that is true only when Pusher enters 'unavailable' (not during normal initial connect sequence)
- Added fixed amber "Reconnecting..." banner to room page with spinning icon, `role="status"`, `aria-live="polite"`, and `motion-reduce:animate-none` for reduced-motion accessibility
- Polished the room-not-found error state from a raw red string to a finished card with an info icon, descriptive copy about 24-hour expiry, and a dark CTA button with arrow icon
- Post-verification bug fix: changed single-equality banner logic to two explicit `if` branches so banner only clears on 'connected', not any non-'unavailable' transition

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isDisconnected to useRoom hook** - `114365b` (feat)
2. **Task 2: Render reconnecting banner + polish loadError** - `4f82af4` (feat)
3. **Task 3 bug fix: Clear isDisconnected only on 'connected'** - `3bb2299` (fix)

## Files Created/Modified

- `hooks/useRoom.ts` - Added useState for isDisconnected; named handleStateChange bound to pusherClient.connection inside existing useEffect; unbind in cleanup; returns { channel, isDisconnected }
- `app/room/[roomId]/page.tsx` - Destructures isDisconnected from useRoom; renders amber fixed banner when isDisconnected && room !== null; replaces raw loadError string with polished error card

## Decisions Made

- isDisconnected clears only on `'connected'` — prevents the banner from vanishing during Pusher's internal reconnect retry cycle (e.g., when the state briefly visits 'connecting' between retries)
- Banner positioned `fixed top-0 left-0 right-0 z-50` to avoid pushing page content when it appears/disappears
- Banner condition includes `room !== null` guard to ensure it never flashes during initial page load (room is null while fetching)
- Spinner SVG uses `animate-spin motion-reduce:animate-none` per ui-ux-pro-max accessibility rules

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed banner clearing logic post-human-verification**
- **Found during:** Task 3 (human verify) — identified by orchestrator after approval
- **Issue:** Original implementation used `setIsDisconnected(current === 'unavailable')` — a single equality check that would set isDisconnected to false for any state that isn't 'unavailable' (including 'connecting' during retry cycles), causing the banner to disappear prematurely
- **Fix:** Split into two explicit branches: `if (current === 'unavailable') setIsDisconnected(true)` and `if (current === 'connected') setIsDisconnected(false)` — banner now only clears when Pusher fully reconnects
- **Files modified:** hooks/useRoom.ts
- **Verification:** State logic reviewed; banner persists through intermediate retry states
- **Committed in:** 3bb2299

---

**Total deviations:** 1 auto-fixed (1 bug — post-verify state logic correction)
**Impact on plan:** Necessary correctness fix. No scope creep.

## Issues Encountered

None during planned task execution. The banner logic edge case was caught at the human-verify checkpoint and fixed as a targeted one-line patch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Connection resilience UI complete for Phase 4
- useRoom hook interface is stable: `{ channel, isDisconnected }` — consumers can extend if needed
- No blockers for remaining Phase 4 plans

---
*Phase: 04-reconnection-and-polish*
*Completed: 2026-03-19*
