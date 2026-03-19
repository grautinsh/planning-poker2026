# Requirements: Planning Poker

**Defined:** 2026-03-18
**Core Value:** Every participant sees the same state in real time — votes stay hidden until the host reveals, preventing anchoring bias and making remote sprint planning feel synchronous.

## v1 Requirements

### Sessions

- [x] **SESS-01**: Host can create a room and receive a shareable URL
- [x] **SESS-02**: Room creation issues a host token stored in an httpOnly cookie, allowing the host to reclaim controls if their tab closes or reloads
- [x] **SESS-03**: Rooms automatically expire after 24 hours (Redis TTL — no manual cleanup needed)
- [x] **SESS-04**: Host can enter a story title that is immediately broadcast and displayed to all participants

### Identity

- [x] **IDNT-01**: Participant can join a room by entering only a display name (no account or login required)
- [x] **IDNT-02**: Server assigns a UUID to each participant at join time; this UUID (not display name) is the primary key for vote tracking
- [x] **IDNT-03**: Participant can choose to join as an observer (can see all activity but cannot vote)
- [ ] **IDNT-04**: Participant can reconnect to a room by entering the same name and have their previous vote state restored

### Voting

- [x] **VOTE-01**: Participant can select a card from the Fibonacci deck (1, 2, 3, 5, 8, 13, 21, ∞, ?)
- [x] **VOTE-02**: Vote values are never exposed to any client (including the host) before reveal — server enforces a redacted serialization view during voting phase
- [x] **VOTE-03**: Participants can see a presence indicator for each participant showing voted / not voted (but not the value)
- [x] **VOTE-04**: Host can trigger a reveal; all vote values are transmitted in a single broadcast event and all cards flip simultaneously on every client
- [x] **VOTE-05**: The server rejects vote submissions after the host has triggered a reveal (prevents race condition producing blank cards)

### Post-Reveal

- [ ] **POST-01**: After reveal, all participants see each voter's name alongside their card value
- [ ] **POST-02**: After reveal, vote summary is displayed: minimum, maximum, and average
- [ ] **POST-03**: Host can reset the current story to allow a re-vote (clears all votes, returns to voting phase, story title preserved)

### Session Log

- [ ] **LOG-01**: Host can move to the next story, which prompts for a final agreed estimate, appends it to the session log, and starts a fresh voting round
- [ ] **LOG-02**: Session log is visible to all participants and accumulates story title + agreed estimate for each completed story
- [ ] **LOG-03**: Participant can copy the session log to clipboard in a plain-text / Markdown format

## v2 Requirements

### Enhancements

- **ENH-01**: Vote distribution histogram displayed post-reveal (visual spread of votes)
- **ENH-02**: Story queue — host can pre-load a list of stories before the session starts

### Notifications

- **NOTF-01**: Round timer — optional countdown per story (configurable by host)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Login / accounts | Name-only entry is sufficient for internal team use; auth adds friction with no benefit |
| Configurable card decks | Fibonacci is standard; v1 keeps it simple |
| Jira / ticketing integration | Verbal announcement + title entry covers the need |
| Auto-reveal when all voted | Host controls the pace — deliberate product decision |
| Mobile app | Web browser is the target platform |
| Chat / comments | Out of scope for the estimation tool; teams use existing comms |
| Session history across multiple sessions | Ephemeral tool; copy-to-clipboard covers export needs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 1 | Complete |
| SESS-02 | Phase 1 | Complete |
| SESS-03 | Phase 1 | Complete |
| SESS-04 | Phase 2 | Complete |
| IDNT-01 | Phase 1 | Complete |
| IDNT-02 | Phase 1 | Complete |
| IDNT-03 | Phase 2 | Complete |
| IDNT-04 | Phase 4 | Pending |
| VOTE-01 | Phase 2 | Complete |
| VOTE-02 | Phase 2 | Complete |
| VOTE-03 | Phase 2 | Complete |
| VOTE-04 | Phase 2 | Complete |
| VOTE-05 | Phase 2 | Complete |
| POST-01 | Phase 3 | Pending |
| POST-02 | Phase 3 | Pending |
| POST-03 | Phase 3 | Pending |
| LOG-01 | Phase 3 | Pending |
| LOG-02 | Phase 3 | Pending |
| LOG-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*
