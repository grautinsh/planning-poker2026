# Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-19
**Phases:** 4 | **Plans:** 17 | **Tests:** 67

### What Was Built

1. Room creation with shareable URL, Redis persistence, 24h TTL
2. Name-only join with UUID identity, host token cookie
3. Real-time Fibonacci voting (11-card deck) with anti-anchoring reveal
4. Observer role, vote stats (min/max/avg), 3D card flip animation
5. Session log with Markdown export (clipboard)
6. Name-match reconnect after cookie loss, Pusher disconnect indicator

### What Worked

- TDD (RED → GREEN) kept API routes correct from the start — no regressions
- GSD wave-based execution let backend and frontend plans run in sequence cleanly
- Keeping Pusher event logic in `useRoom` hook made the room page simple to reason about
- Single `FIBONACCI_DECK` constant serving both client UI and server validation — one change propagates everywhere

### What Was Inefficient

- Reconnect indicator bug (banner flashing off during retries) was caught only at human verification — a unit test for the state machine would have caught it earlier
- ROADMAP.md had stale `[ ]` checkboxes for completed phases — tooling gap

### Patterns Established

- `keys.*` helper in `lib/room.ts` as single source of truth for Redis key names
- `toRoomView` serialization filter for anti-anchoring: vote values only included when `revealed === true`
- `useRoom` hook owns all Pusher subscriptions; page components are declarative consumers

### Key Lessons

- Pusher state transitions: `unavailable` fires when offline, but retries cycle through `connecting` → `unavailable` repeatedly. State machines that track "has been unavailable" need to clear only on `connected`, not on any non-`unavailable` state.
- Redis `hgetall` returns fields in non-deterministic order — always sort results by a stable field (e.g. `joinedAt`) before returning to the client.

### Cost Observations

- Model mix: 100% sonnet
- Sessions: ~4 context windows across 4 phases
- Notable: All phases completed in a single day (2026-03-18 → 2026-03-19)

## Cross-Milestone Trends

| Milestone | Phases | Plans | Tests | Days |
|-----------|--------|-------|-------|------|
| v1.0 MVP  | 4      | 17    | 67    | 2    |
