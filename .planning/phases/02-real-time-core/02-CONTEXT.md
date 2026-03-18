# Phase 2: Real-Time Core - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Participants can vote on a story and the host can reveal all votes simultaneously — the anti-anchoring mechanic works correctly and in real time for all connected clients. This phase delivers: story title broadcast (SESS-04), observer role (IDNT-03), card selection and vote storage (VOTE-01, VOTE-02, VOTE-03), simultaneous reveal (VOTE-04), and race condition guard (VOTE-05). Post-reveal display, session log, and round reset are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Card deck layout
- Horizontal card row at the bottom of the screen (single scrollable row)
- Selected card lifts/highlights — elevated shadow + colored border or fill, clearly distinguishes chosen card
- Fibonacci deck: 1, 2, 3, 5, 8, 13, 21, ∞, ?
- Participants can change their vote before reveal — clicking another card replaces the current vote (server stores latest only)
- Post-reveal: card deck disappears and is replaced by a post-reveal view; deck returns only after round reset (Phase 3)

### Observer experience
- Observer badge displayed clearly at the top of their view — "Observer" label
- Card deck is NOT rendered for observers; no disabled cards shown
- Observers see all activity (participant list, vote status, reveal) but have no voting UI

### Participant list voted status
- Card back icon (small face-down card icon) next to participant name when they have voted
- Replaces the current "Voted" text badge

### Vote feedback
- After selecting a card: card stays highlighted (selected state), participant list updates to show card back icon for the voter
- No toast or snackbar — UI state is the confirmation

### Reveal animation
- CSS 3D flip animation per card when reveal fires
- Slight stagger (50–100ms per card) — creates reveal drama without feeling slow
- Cards show face-down during voting phase, flip to values on reveal event

### Host controls panel
- Sticky panel at top of the room page — always visible regardless of participant count
- Host sees: story title input (submit on Enter or button click), vote progress counter ("3 / 5 voted"), Reveal button
- Reveal button is disabled/grayed until at least 1 participant has voted
- Non-hosts see: current story title read-only at the top — no input, no Reveal button
- Story title is broadcast on explicit submit (Enter or button) — not auto-save on type

### Real-time update strategy
- Pusher event fires → client calls GET /api/rooms/[roomId] → full state re-render
- No delta patching — consistent with the pattern established in Phase 1 (refreshRoom callback)
- Events to handle: participant-joined, vote-cast, story-updated, vote-revealed

### Connection indicator
- None — keep UI clean. Pusher reconnects automatically; v1 does not surface connection state to users.

### Claude's Discretion
- Pusher channel type: public vs. presence (technical decision — requirements don't mandate Pusher presence; public channel + API refresh covers VOTE-03)
- Exact card flip CSS implementation (transform-style, perspective, backface-visibility)
- Reveal atomicity strategy (Lua script vs. pipeline for Redis multi-command reveal)
- Pusher event payload structure
- Card size, exact spacing, and color palette for selected state

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/useRoom.ts` — Stub hook already subscribes to `room-{roomId}` channel. Phase 2 binds event handlers here (participant-joined, vote-cast, story-updated, vote-revealed). Returns `channel` ref.
- `lib/pusher-client.ts` — PusherClient singleton, ready for use. May need `authEndpoint` added if upgrading to presence channel.
- `lib/pusher.ts` — `pusherServer` and `roomChannel()` on server side. Channel naming comment notes Phase 2 upgrade to `presence-room-{roomId}` — but public channel may suffice.
- `components/ParticipantList.tsx` — Shows participants with hasVoted status. Needs card back icon for voted state (replaces "Voted" text).
- `lib/room.ts` — `toRoomView` already enforces vote redaction (value only included when `room.revealed === true`). `joinRoom`, `getParticipants`, `getRoom` all ready.
- `app/room/[roomId]/page.tsx` — `refreshRoom` callback already exists. Pusher events will call this.

### Established Patterns
- **State refresh via API**: `refreshRoom` → `fetch(/api/rooms/${roomId})` → `setRoom(data)`. Pusher events hook into this rather than patching state.
- **Cookie-based identity**: Host identified by `host-token-{roomId}` cookie; participant by `participant-{roomId}` cookie. Server reads these to determine role and identity.
- **Non-blocking Pusher trigger**: All server-side `pusherServer.trigger()` calls wrapped in try/catch — Pusher unavailability must not block API responses.
- **Vote redaction**: Server-side only — `toRoomView` spreads `value` only when `room.revealed === true`. Client never receives values before reveal.

### Integration Points
- New API routes needed: `POST /api/rooms/[roomId]/vote`, `POST /api/rooms/[roomId]/story`, `POST /api/rooms/[roomId]/reveal`
- `useRoom` hook: bind Pusher events, call `refreshRoom` or pass callbacks
- Room page: pass `isHost` flag (derived from cookie presence check), render `HostControls` vs read-only story title, render `CardDeck` for voters only
- `ParticipantList`: update voted indicator to card back icon

</code_context>

<specifics>
## Specific Ideas

- Card reveal feel: "staggered 3D flip, like revealing poker cards one by one — creates the anti-anchoring drama"
- Vote progress: host sees "3 / 5 voted" counter — not just the Reveal button
- Story title: sticky at top, always in view — anchors every participant to what they're voting on

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-real-time-core*
*Context gathered: 2026-03-18*
