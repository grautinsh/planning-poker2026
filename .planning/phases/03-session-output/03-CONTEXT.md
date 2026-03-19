# Phase 3: Session Output - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Session produces a tangible record: post-reveal stats, host controls for reset and next-story, a session log visible to all participants, and clipboard export. This phase delivers POST-01, POST-02, POST-03, LOG-01, LOG-02, LOG-03. Reconnection recovery and UX polish are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Post-reveal host controls
- After reveal, the Reveal button in the sticky HostControls panel is replaced by **Reset Round** and **Next Story →** buttons
- **Reset Round**: clears all votes, returns to voting phase, story title preserved — deck returns, VoteCard grid disappears
- **Next Story →**: switches HostControls to an inline estimate-entry mode — a small input + Confirm + Cancel appear in the panel; no modal
- Non-host participants wait silently while host enters the agreed estimate — no indicator shown to them
- On confirm: agreed estimate appended to session log, new round starts (story title cleared, votes cleared, revealed = false)

### Vote summary display
- Stats row appears **above** the flipped cards, between the "Results" heading and the VoteCard grid
- Format: `Min: X · Max: Y · Avg: Z.Z` (average to one decimal place)
- **Consensus case**: when all voters picked the same value, replace min/max/avg row with `✓ Consensus: X` (green treatment)
- **Non-numeric votes** (∞ and ?): excluded from average calculation; a small note shows e.g. "(2 non-numeric excluded)" — min/max only from numeric values; if all votes are non-numeric, skip stats entirely

### Session log layout
- Always-visible section at the bottom of the page, below all other content
- Visible from page load; shows an empty state ("No stories logged yet") until LOG-01 fires
- Each entry: **story title** + **agreed estimate** only (no timestamp)
- Copy button lives in the session log section header
- Log stored in Redis list at `room:{roomId}:log` (appended on each next-story action, TTL matches room keys)
- Broadcast via Pusher (new `story-logged` event) → all clients call `refreshRoom` to pick up updated log

### Clipboard export
- **Markdown table** format only — no plain-text alternative
- Format:
  ```
  | Story | Points |
  |-------|--------|
  | Auth login story | 5 |
  | User settings epic | 13 |
  ```
  No date header, no total points line — table only
- Copy feedback: button label switches to `✓ Copied!` for ~2 seconds then reverts — no toast (consistent with Phase 2 no-toast decision)

### Claude's Discretion
- Exact styling of the consensus badge (color, icon)
- Empty state illustration/text for session log
- Transition between Reveal button and Reset/Next Story buttons (swap, fade, etc.)
- Exact Redis list serialization format for log entries (JSON per entry recommended)
- Pusher event name for story-logged broadcast

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/HostControls.tsx` — Sticky panel with story input + Reveal button. Phase 3 adds a post-reveal state (Reveal replaced by Reset + Next Story) and an estimate-entry state. Needs `revealed` prop passed in.
- `components/VoteCard.tsx` — Already renders flipped cards with participant name. No changes needed for POST-01.
- `app/room/[roomId]/page.tsx` — VoteCard grid already rendered on `room.revealed`. Stats row slots above the existing `flex flex-wrap gap-4` card grid.
- `lib/room.ts` — `keys` object already has `keys.log(roomId)` defined (l.12). `getRoom` and `getParticipants` patterns established. New `getLog(roomId)` function follows same pattern.
- `app/api/rooms/[roomId]/reveal/route.ts` — Reveal route already exists. Reset and next-story need new POST routes.
- `types/room.ts` — `RoomPageResponse` needs a `log: LogEntry[]` field added. `LogEntry = { story: string; estimate: string }`.

### Established Patterns
- **State refresh via API**: All Pusher events trigger `refreshRoom` → GET /api/rooms/[roomId] → `setRoom`. Session log returned in this response (no separate fetch needed).
- **Host-only routes**: Check `host-token-{roomId}` cookie + `validateToken`. Reset and next-story are host-only.
- **Non-blocking Pusher**: `pusherServer.trigger()` in try/catch on all routes.
- **Redis keys**: `keys.*` helper in `lib/room.ts` — add `log` key there (already defined at l.12).
- **No toast**: UI state is the confirmation. Clipboard exception: button text swap only.

### Integration Points
- New API routes: `POST /api/rooms/[roomId]/reset`, `POST /api/rooms/[roomId]/next-story`
- `GET /api/rooms/[roomId]` — extend to fetch log and include in response
- `HostControls` — needs `revealed` prop, renders different button set post-reveal; inline estimate entry state
- `app/room/[roomId]/page.tsx` — add stats row + session log section below existing content
- New `SessionLog` component — renders log entries + copy button
- `types/room.ts` — add `LogEntry` type and `log` field to `RoomPageResponse`

</code_context>

<specifics>
## Specific Ideas

- Consensus moment: "✓ Consensus: 5" — green treatment, replaces the dry min/max/avg. Adds a satisfying moment when team agrees.
- Clipboard: Markdown table pastes cleanly into Notion, GitHub, Linear, Confluence — the tools teams actually use.
- No header or total in clipboard — user adds context themselves; keeps the output clean and unopinionated.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-session-output*
*Context gathered: 2026-03-19*
