# Roadmap: Planning Poker

## Overview

Build a real-time planning poker app from the ground up. Phase 1 establishes the data model, infrastructure, and identity rules that every other phase depends on. Phase 2 delivers the complete poker loop — join, vote, reveal, re-vote — which is the core product value and the highest-risk engineering challenge. Phase 3 closes the loop with session output (log and export). Phase 4 hardens the experience with reconnection recovery and UX polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Room creation, name-only identity, Redis schema, Pusher skeleton (completed 2026-03-18)
- [ ] **Phase 2: Real-Time Core** - Voting, simultaneous reveal, presence, re-vote
- [ ] **Phase 3: Session Output** - Session log, post-reveal display, clipboard export
- [ ] **Phase 4: Reconnection and Polish** - Reconnect by name, UX hardening

## Phase Details

### Phase 1: Foundation
**Goal**: A host can create a room and participants can join — the infrastructure and identity rules that underpin every subsequent feature are locked in correctly from the start
**Depends on**: Nothing (first phase)
**Requirements**: SESS-01, SESS-02, SESS-03, IDNT-01, IDNT-02
**Success Criteria** (what must be TRUE):
  1. Host visits the app, clicks create, and receives a shareable URL they can send to teammates
  2. A participant opens the shared link, enters only a display name, and appears in the room
  3. The host's room controls persist after the host tab reloads (host token cookie survives page reload)
  4. Rooms that are not actively used disappear automatically after 24 hours without any manual action
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold + Vitest test infrastructure (Wave 0 stubs)
- [ ] 01-02-PLAN.md — Lib layer: types, room model, auth helpers, Redis/Pusher singletons
- [ ] 01-03-PLAN.md — API routes: room create, room read, room join
- [ ] 01-04-PLAN.md — UI shell: landing page, room page, Pusher hook skeleton

### Phase 2: Real-Time Core
**Goal**: Participants can vote on a story and the host can reveal all votes simultaneously — the anti-anchoring mechanic works correctly and in real time for all connected clients
**Depends on**: Phase 1
**Requirements**: SESS-04, IDNT-03, VOTE-01, VOTE-02, VOTE-03, VOTE-04, VOTE-05
**Success Criteria** (what must be TRUE):
  1. Host enters a story title and all participants see it appear on their screen without refreshing
  2. Each participant can select a Fibonacci card and the presence list shows who has voted (but not what value) until reveal
  3. When the host triggers reveal, all cards flip simultaneously on every client in a single event — no value is visible in the network tab before the reveal
  4. A participant who joins as an observer can see all activity but has no card selection available
  5. Votes submitted after the host triggers reveal are rejected by the server; a race condition cannot produce blank or stale cards
**Plans**: 5 plans

Plans:
- [ ] 02-01-PLAN.md — Wave 0: FIBONACCI_DECK constant + test stubs (vote, story, reveal)
- [ ] 02-02-PLAN.md — API layer: vote, story, reveal routes + isHost in GET + RoomPageResponse type
- [ ] 02-03-PLAN.md — useRoom hook: bind all 4 Pusher events to onEvent callback
- [ ] 02-04-PLAN.md — UI components: HostControls, CardDeck, VoteCard with 3D flip animation
- [ ] 02-05-PLAN.md — Room page wiring + ParticipantList update + human verification checkpoint

### Phase 3: Session Output
**Goal**: The session produces a tangible record — agreed estimates are accumulated in a visible log that any participant can copy and use outside the tool
**Depends on**: Phase 2
**Requirements**: POST-01, POST-02, POST-03, LOG-01, LOG-02, LOG-03
**Success Criteria** (what must be TRUE):
  1. After reveal, every participant can see each voter's name next to their card value, plus the minimum, maximum, and average of all votes
  2. The host can reset the current story for a re-vote; all cards clear and the voting phase restarts with the story title preserved
  3. The host can move to the next story by entering a final agreed estimate; the completed story appears in the session log for all participants
  4. Any participant can click a single button to copy the full session log as plain text or Markdown to their clipboard
**Plans**: TBD

### Phase 4: Reconnection and Polish
**Goal**: The app stays usable under real-world conditions — participants who lose and regain their connection are restored to correct state without disrupting the session
**Depends on**: Phase 3
**Requirements**: IDNT-04
**Success Criteria** (what must be TRUE):
  1. A participant who closes and reopens their browser tab can re-enter their name and rejoin the room with their previous vote state restored
  2. A participant who reconnects after a reveal event sees the correct post-reveal state (not a stale pre-reveal screen)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-18 |
| 2. Real-Time Core | 0/TBD | Not started | - |
| 3. Session Output | 0/TBD | Not started | - |
| 4. Reconnection and Polish | 0/TBD | Not started | - |
