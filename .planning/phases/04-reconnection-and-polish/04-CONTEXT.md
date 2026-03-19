# Phase 4: Reconnection and Polish - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The app stays usable under real-world conditions. Participants who lose their cookie (different browser, cleared cookies) can re-enter their name and rejoin with their previous vote state restored. A subtle connection indicator appears only during Pusher disconnect. Stale participant removal and cosmetic polish (favicon, a11y) are out of scope for v1.

</domain>

<decisions>
## Implementation Decisions

### Name-match reconnect
- Server scans the participants hash for an exact name match when no participant cookie is present
- If a match is found: return the existing UUID and re-issue the `participant-{roomId}` cookie — future refreshes work normally
- Existing participant Redis record is reused as-is (no data mutation, no joinedAt update)
- Vote in the votes hash is keyed to the UUID — automatically restored by returning the same UUID
- **Unique names required at join time**: if the requested name is already taken in the room, the join request is rejected (409 Conflict or similar). This prevents the name-collision ambiguity entirely and is the cleanest solution for a small-team tool

### Post-reconnect experience
- **Silent restoration** — JoinForm disappears, room renders normally with their previous vote shown. No banner or message. Same feel as page refresh.
- A participant who reconnects after a reveal sees the current room state as-is (GET /api/rooms/[roomId] already returns revealed=true with vote values). No animation replay.
- **No Pusher broadcast on reconnect** — they were already in the participant list; no announcement needed

### Connection indicator
- Show a subtle "Reconnecting..." banner **only when Pusher is actually disconnected**. Hidden when connected (which is the normal state). Consistent with Phase 2's "keep UI clean" decision — noise only when actionable.

### Expired/not-found rooms
- Show "Room not found or has expired" message with a ← Create a new room link. The loadError state in page.tsx already exists; this polishes it to look finished.

### Stale participants
- No host removal — out of scope for v1. Leavers show as "hasn't voted" which is accurate.
- Vote restoration is automatic: votes are cleared on next-story, so a returning participant's vote only appears for the round it was cast. No special stale-vote logic needed.

### Claude's Discretion
- Exact UI treatment of the "Reconnecting..." banner (position, color, animation)
- HTTP status code for name-already-taken rejection (409 recommended)
- Whether to check name uniqueness only at join time or also validate on reconnect attempt

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/api/rooms/[roomId]/join/route.ts` — Existing cookie check path already works for page refresh. Name-match reconnect is a new branch in the same endpoint: when no cookie → scan participants by name → if found, return existing UUID + set cookie.
- `lib/room.ts` → `getParticipants(roomId)` — Returns full participant list. Name-match scan uses this. No new Redis function needed for the basic reconnect case.
- `app/room/[roomId]/page.tsx` — `loadError` state already handles failed room fetch; just needs polished presentation.
- `hooks/useRoom.ts` — Subscribes to Pusher channel. Pusher client emits connection state events (`pusher:connection_established`, `pusher:connection_failed`, etc.) that can drive the reconnection indicator.

### Established Patterns
- **Cookie-based identity**: `participant-{roomId}` httpOnly cookie (maxAge 24h). Re-issuing the same cookie on name-match reconnect is consistent with how it was originally set.
- **GET /api/rooms/[roomId] returns full state**: including `revealed`, vote values (when revealed), and log. Reconnecting participant gets correct current state on first load — no special "catch-up" logic needed.
- **No toast**: UI state is the confirmation pattern. "Reconnecting..." banner follows the same principle — state-driven, not a notification.
- **Non-blocking Pusher**: all server-side `pusherServer.trigger()` calls are in try/catch. If no broadcast on reconnect, this remains unchanged.

### Integration Points
- `POST /api/rooms/[roomId]/join` — Add name-uniqueness check (reject if name taken) + name-match branch (return existing UUID if no cookie and name matches)
- `hooks/useRoom.ts` — Bind Pusher connection state events to drive a `isDisconnected` flag in room page state
- `app/room/[roomId]/page.tsx` — Render subtle "Reconnecting..." banner when `isDisconnected` is true

</code_context>

<specifics>
## Specific Ideas

- Name uniqueness check doubles as the reconnect collision prevention — one rule solves both problems cleanly
- "Reconnecting..." banner: only show on actual Pusher disconnect, not during initial page load (which has its own "Loading room..." state)

</specifics>

<deferred>
## Deferred Ideas

- Host can remove participants from the room — post-v1
- Page title tags and favicon — post-v1
- Accessibility audit (focus management, ARIA labels) — post-v1
- Skeleton/shimmer loading states — post-v1

</deferred>

---

*Phase: 04-reconnection-and-polish*
*Context gathered: 2026-03-19*
