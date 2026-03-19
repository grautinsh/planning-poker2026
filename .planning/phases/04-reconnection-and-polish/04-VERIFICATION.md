---
phase: 04-reconnection-and-polish
verified: 2026-03-19T10:09:30Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Connection banner appears and disappears"
    expected: "After opening a room in the browser, go offline (DevTools Network → Offline). Within 5-10 seconds an amber 'Reconnecting...' banner appears at the top of the page. Restore network — banner disappears. Banner is NOT visible during initial page load (no flash)."
    why_human: "Pusher state_change event timing and banner visibility cannot be verified programmatically without a live Pusher connection."
  - test: "Room not found polish"
    expected: "Navigate to /room/does-not-exist-room-id. A polished error card appears with an info icon, 'Room not found' heading, description about 24-hour expiry, and a dark 'Create a new room' button with arrow icon. Clicking the button navigates to /."
    why_human: "Visual appearance, card layout, and navigation on click require a live browser."
  - test: "Reconnect by name — live flow"
    expected: "Join a room as 'Alice'. Clear cookies for the room (or use a fresh browser profile). Navigate back to the room URL. Enter 'Alice' again. Confirm that the same participant entry appears (not a duplicate) and any pre-reveal vote is restored."
    why_human: "End-to-end cookie + Redis state restore requires a running server and cannot be fully simulated in unit tests."
---

# Phase 4: Reconnection and Polish Verification Report

**Phase Goal:** The app stays usable under real-world conditions — participants who lose and regain their connection are restored to correct state without disrupting the session
**Verified:** 2026-03-19T10:09:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A participant with no cookie who submits their exact previous name is returned the same participantId they had before (vote state restored automatically) | VERIFIED | `app/api/rooms/[roomId]/join/route.ts` line 49–62: `allParticipants.find(p => p.name === name)` returns `nameMatch.participantId` without calling `joinRoom` or Pusher |
| 2  | A participant with a valid cookie who rejoins still gets the existing participantId (existing idempotent behavior preserved) | VERIFIED | Lines 34–44: Path A reads cookie, calls `getParticipants`, returns `existingId` if found; `joinRoom` not called |
| 3  | When Pusher enters the 'unavailable' state, a 'Reconnecting...' banner appears — NOT visible during initial page load | VERIFIED (automated) / HUMAN NEEDED (visual) | `hooks/useRoom.ts` lines 24–25: two explicit branches — only `'unavailable'` sets true, only `'connected'` clears; `page.tsx` line 129: `isDisconnected && room !== null` guard prevents flash on load |
| 4  | When Pusher returns to 'connected', the banner disappears automatically | VERIFIED (automated) / HUMAN NEEDED (visual) | `hooks/useRoom.ts` line 25: `if (current === 'connected') setIsDisconnected(false)` |
| 5  | When a room fetch returns 404 or network error, the page shows a polished 'Room not found' card with CTA back to home | VERIFIED (code) / HUMAN NEEDED (visual) | `page.tsx` lines 87–112: full polished card with icon, heading, description, CTA `<a>` — not a raw string |

**Score:** 5/5 truths verified (automated code checks pass; 3 truths require human confirmation for live behavior)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/rooms/[roomId]/join/route.ts` | Name-match reconnect branch + no-match new-participant path | VERIFIED | 93 lines. Path B1 (name match): re-issues cookie, returns existing UUID, skips `joinRoom` and Pusher. Path B2 (no match): original new-participant flow unchanged. |
| `tests/api/join.test.ts` | Unit tests covering reconnect returns existing UUID, cookie re-issued, joinRoom not called, new joiner path | VERIFIED | 135 lines. `describe('reconnect')` block at line 81 has 4 tests (Tests A–D). All 9 tests in file pass. |
| `hooks/useRoom.ts` | `isDisconnected` boolean tracked via `pusherClient.connection.bind('state_change', ...)`, unbound in cleanup | VERIFIED | 38 lines. `useState(false)` at line 8; named `handleStateChange` bound at line 27, unbound at line 33; returns `{ channel, isDisconnected }`. |
| `app/room/[roomId]/page.tsx` | `isDisconnected` destructured from `useRoom`; amber banner rendered when `isDisconnected && room !== null`; polished loadError card | VERIFIED | Line 80: `const { isDisconnected } = useRoom(roomId, refreshRoom)`. Lines 129–140: amber fixed banner with `role="status"` and `aria-live="polite"`. Lines 87–112: polished card. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/rooms/[roomId]/join/route.ts` | `lib/room.ts#getParticipants` | Single call before branching | VERIFIED | `getParticipants` called once at line 48 in Path B before the `if (nameMatch)` branch — result `allParticipants` reused in both B1 and B2. (Note: Path A also calls `getParticipants` at line 38, but this is a separate, mutually exclusive branch.) |
| `tests/api/join.test.ts` | `app/api/rooms/[roomId]/join/route.ts` | `vi.mock('@/lib/room')` + dynamic import | VERIFIED | Line 3: `vi.mock('@/lib/room', ...)` present with `getParticipants: vi.fn().mockResolvedValue([])`. Line 19: `const { POST } = await import(...)`. Five `getParticipants.mockResolvedValue` overrides in tests. |
| `hooks/useRoom.ts` | `pusherClient.connection` | `bind('state_change', handleStateChange)` with `unbind` in cleanup | VERIFIED | Line 27: `pusherClient.connection.bind('state_change', handleStateChange)`. Line 33 (cleanup): `pusherClient.connection.unbind('state_change', handleStateChange)`. Named handler used — precise unbind confirmed. |
| `app/room/[roomId]/page.tsx` | `hooks/useRoom.ts` | `isDisconnected` destructured from `useRoom` return | VERIFIED | Line 80: `const { isDisconnected } = useRoom(roomId, refreshRoom)`. Line 129: `{isDisconnected && room !== null && (` renders banner. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| IDNT-04 | 04-01-PLAN.md, 04-02-PLAN.md | Participant can reconnect to a room by entering the same name and have their previous vote state restored | SATISFIED | Name-match branch in join route returns original UUID (restores Redis vote state). Connection banner gives real-time feedback during disconnection. Two-plan implementation confirmed in code and tests. |

**Orphaned requirements check:** REQUIREMENTS.md Traceability table maps only IDNT-04 to Phase 4. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/rooms/[roomId]/join/route.ts` | 87–89 | `console.error('Pusher trigger failed:', err)` | Info | Expected — this is intentional error logging for a non-fatal Pusher failure in Path B2. Not a stub. |

No blockers or warnings found. No TODO/FIXME/placeholder comments in any modified file. No empty implementations (`return null`, `return {}`, `=> {}`). No stub handlers.

### Human Verification Required

#### 1. Connection Banner — Appear on Disconnect, Disappear on Reconnect

**Test:** Start dev server (`npm run dev`). Open a room. Open DevTools → Network tab → set throttling to "Offline". Wait 5–10 seconds.
**Expected:** Amber "Reconnecting..." banner appears at the top of the room page with a spinning icon. Restore network to "Online" — banner disappears automatically.
**Why human:** Pusher's `state_change` event from `'connected'` to `'unavailable'` requires a live WebSocket connection and actual network interruption; this cannot be simulated in unit tests.

#### 2. No Banner Flash on Initial Page Load

**Test:** Hard-refresh the room page while online.
**Expected:** The amber banner does NOT appear during the initial `initialized → connecting → connected` Pusher sequence. The page loads cleanly without a flash of the banner.
**Why human:** Timing of Pusher state transitions during initial connect is environment-dependent.

#### 3. Room Not Found — Polished Error Card

**Test:** Navigate to `/room/does-not-exist-room-id` in the browser.
**Expected:** A centered card shows: info icon (circle with i), "Room not found" heading (slate-800, semibold), description about 24-hour expiry (slate-500), and a dark slate-900 "Create a new room" button with left-arrow icon. Clicking the button navigates to `/`.
**Why human:** Visual layout, typography, and CTA navigation require browser confirmation.

#### 4. Reconnect by Name — Live End-to-End Flow

**Test:** Join a room as "Alice" (voter). Note the participantId or cast a vote. Clear the `participant-{roomId}` cookie (or open a fresh incognito window and navigate to the same room URL). Enter "Alice" as the name.
**Expected:** The same participant entry appears in the room — no duplicate "Alice" — and any previously cast vote is still associated with that participant.
**Why human:** End-to-end cookie + Redis participant restore requires a live server and real HTTP cookie handling.

### Gaps Summary

No gaps found. All five observable truths are implemented correctly in code, all four artifacts are substantive (not stubs), all key links are wired, and the sole requirement IDNT-04 is satisfied. The phase is code-complete. Three truths require human confirmation for live UI behavior (banner timing, visual appearance, and end-to-end reconnect flow) — these cannot be verified programmatically.

---

_Verified: 2026-03-19T10:09:30Z_
_Verifier: Claude (gsd-verifier)_
