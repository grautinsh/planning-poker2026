# Feature Research

**Domain:** Real-time planning poker web app (internal dev team, Vercel-hosted)
**Researched:** 2026-03-18
**Confidence:** MEDIUM — WebSearch and WebFetch unavailable; findings based on training knowledge of established planning poker products (PlanningPoker.com, Pointing Poker, Scrumpoker.online, Agile Poker for Jira, Parabol). Patterns are well-established in this domain and unlikely to have changed significantly.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session creation + shareable link | Every poker tool works this way; users arrive expecting a URL to share | LOW | Generate a short unique room ID; URL is the invitation |
| Name-only join (no account) | The standard for ephemeral, internal tools — accounts add friction with no benefit | LOW | Store name in session/localStorage; pass as join param |
| Participant presence list | Users need to know who is in the room and whether everyone has voted | LOW | Show names; indicate voted/not-voted status (not the value) |
| Card selection from Fibonacci deck | Fibonacci (1, 2, 3, 5, 8, 13, 21) is the de facto standard; users arrive with muscle memory for it | LOW | Render a row/grid of cards; selected state is clear |
| Hidden votes until reveal | Core mechanic — the entire point of planning poker is preventing anchoring bias | MEDIUM | Server must not broadcast vote values; only "voted" boolean |
| Host-controlled reveal | Host manages discussion pace; all cards flip at once | LOW | Host emits reveal event; all clients flip simultaneously |
| Vote summary after reveal | After reveal, show the spread (min, max, average, mode) so discussion is data-driven | LOW | Pure arithmetic on the revealed votes |
| Re-vote on same story | Disagreement is common; teams need to revote after discussion | LOW | Host resets round; votes cleared, participants revote |
| Session log / story list | Teams estimate multiple stories per session; list must accumulate agreed estimates | MEDIUM | Ordered list of stories with final agreed point values |
| Real-time state sync | All participants see the same state without refreshing — who joined, who voted, reveal | HIGH | The core technical challenge; requires WebSocket or equivalent |
| Observer role | Product owners, stakeholders, or note-takers join without voting; expected in most tools | LOW | Observers see state but cannot submit a vote |
| Story title display | Host enters a title shown to all; prevents ambiguity about what is being estimated | LOW | Simple broadcast of story text to all clients |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Vote distribution histogram | Visual spread of votes accelerates discussion — "three 5s and two 13s" is clearer in a chart | LOW | Simple bar chart with a library like Chart.js or Recharts; data is already available post-reveal |
| Spectator-visible vote tally (post-reveal) | Showing each person's card face-up with their name after reveal adds accountability and discussion fuel | LOW | Already have the data; UI enhancement only |
| Round timer (optional, host-controlled) | Some teams use timeboxing to prevent over-discussion; host can start a countdown | MEDIUM | Timer state must be synced in real time; adds complexity |
| Copy session log to clipboard | One-click export of the story list with estimates — pastes into Confluence, Notion, or email | LOW | Format as Markdown or plain text; native clipboard API |
| "?" and "infinity" cards | Standard in all serious poker tools; ? = "I don't understand the story", ∞ = "too big to estimate" | LOW | Already in scope per PROJECT.md; just UI cards with special values |
| Reconnection / rejoin by name | If a participant's browser reloads, they rejoin with the same name and pick up where they left off | MEDIUM | Match on name + room ID; restore their current vote state |
| Story queue (pre-loaded list) | Host pastes story titles upfront; tool cycles through them automatically | MEDIUM | Replaces manual "host types next story" each round; smoother flow for large backlogs |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this use case.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / authentication | "We want to track who estimated what across sessions" | Adds login friction, session management, password reset flows — all overhead for an ephemeral tool; incompatible with "no auth" constraint | Name-only entry; host token via cookie for session ownership |
| Jira / Linear / GitHub integration | "Pull stories automatically from our backlog" | OAuth setup, webhook maintenance, API version drift, scope creep into project management territory; well outside Vercel free tier constraints | Host pastes story title manually; integrations belong in the ticketing tool |
| Configurable card decks (T-shirt, powers of 2, custom) | "Our team doesn't use Fibonacci" | Multiplies UI surface area, testing burden, and decision paralysis for new users; most teams standardize on Fibonacci anyway | Fibonacci only for v1; document as known limitation |
| Auto-reveal when all votes are in | "Save the host a click" | Removes host control over discussion pacing; prevents the host from checking in before reveal; teams with diverse velocities dislike it | Host-controlled reveal; the click is intentional UX |
| Persistent session history (cross-session) | "I want to look back at last sprint's estimates" | Requires database persistence, user identity, storage management — violates ephemeral session model and Vercel free tier limits | Export session log to clipboard/CSV before closing; ephemeral is the design |
| Chat / messaging inside the room | "Useful for async estimation" | This is a synchronous tool by design; chat duplicates video call; adds real-time complexity for marginal value in a collocated/video call context | Use Slack/Teams alongside; this tool is the poker table, not the meeting room |
| Mobile app (iOS/Android) | "We want a native app" | Doubles the surface area; Vercel + web covers all target use cases; browser is available on phones too | Responsive web layout so phones work in a browser |
| "Coffee break" / emoji reactions | "Fun engagement feature" | Engagement gimmicks distract from the estimation task; adds real-time event complexity | Keep UX focused; the discussion IS the engagement |
| Admin dashboard / multi-team management | "Manage multiple teams from one place" | Wrong scope for a single internal team tool; would require accounts, roles, organization model | One room, one session, one team — that's the model |

## Feature Dependencies

```
[Session creation]
    └──requires──> [Shareable link / room ID]
                       └──required by──> [Participant join]
                                             └──required by──> [Presence list]
                                             └──required by──> [Card selection]
                                             └──required by──> [Real-time state sync]

[Real-time state sync]
    └──required by──> [Hidden votes until reveal]
    └──required by──> [Host-controlled reveal]
    └──required by──> [Presence list updates]
    └──required by──> [Observer role]

[Host-controlled reveal]
    └──required by──> [Vote summary after reveal]
    └──required by──> [Session log (recording agreed estimate)]

[Vote summary after reveal]
    └──enhances──> [Vote distribution histogram (differentiator)]

[Session log]
    └──enhances──> [Copy session log to clipboard (differentiator)]

[Card selection]
    └──requires──> [Story title display] (context for what is being estimated)

[Story queue (differentiator)]
    └──enhances──> [Story title display]
    └──conflicts──> [Manual story entry per round] (host workflow changes)
```

### Dependency Notes

- **Participant join requires session creation:** A room must exist before anyone can join. Session creation is the root of the entire dependency tree.
- **Real-time state sync underlies almost everything:** Hidden votes, presence, reveal, and observer role all depend on low-latency state propagation. This is the highest-complexity foundation piece.
- **Host-controlled reveal gates the session log:** The agreed estimate is recorded post-reveal; reveal must work before log recording is meaningful.
- **Story queue conflicts with manual story entry:** If a queue is pre-loaded, the host's per-round story entry workflow changes. These are not incompatible, but they are alternative UX flows that should not be shipped simultaneously without a clear design.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept and run a real sprint planning session.

- [ ] Session creation with shareable link — without this, nothing works
- [ ] Name-only participant join — identity without accounts
- [ ] Observer role — non-voting participants (PO, stakeholders)
- [ ] Participant presence list with voted/not-voted indicator — team needs to know when everyone is ready
- [ ] Story title entry by host, displayed to all — context for estimation
- [ ] Fibonacci card selection (1, 2, 3, 5, 8, 13, 21, ?, ∞) — the estimation mechanic
- [ ] Votes hidden until host reveals — prevents anchoring
- [ ] Host-controlled simultaneous reveal — the key UX moment
- [ ] Post-reveal vote summary (min, max, average) — drives discussion
- [ ] Re-vote on same story — disagreement resolution
- [ ] Session log accumulating agreed estimates — the output artifact
- [ ] Real-time state sync for all of the above — non-negotiable foundation

### Add After Validation (v1.x)

Features to add once core is working and the team has used it.

- [ ] Copy session log to clipboard — trigger: teams start asking "how do I save this?"; LOW complexity, HIGH value
- [ ] Vote distribution histogram — trigger: team wants richer post-reveal discussion data; LOW complexity
- [ ] Reconnection / rejoin by name — trigger: participants report losing state on refresh; MEDIUM complexity
- [ ] Spectator-visible named vote cards post-reveal — trigger: team wants accountability; LOW complexity

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Story queue (pre-loaded list) — defer: adds host workflow complexity; validate manual entry first
- [ ] Round timer — defer: teams vary widely on whether they timebox discussion; validate the need
- [ ] Configurable card decks — defer: explicitly out of scope for v1; revisit if multiple teams with different standards adopt the tool

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Session creation + shareable link | HIGH | LOW | P1 |
| Name-only join | HIGH | LOW | P1 |
| Participant presence list | HIGH | LOW | P1 |
| Story title display | HIGH | LOW | P1 |
| Fibonacci card selection | HIGH | LOW | P1 |
| Hidden votes until reveal | HIGH | MEDIUM | P1 |
| Host-controlled reveal | HIGH | LOW | P1 |
| Vote summary after reveal | HIGH | LOW | P1 |
| Re-vote on same story | HIGH | LOW | P1 |
| Session log | HIGH | MEDIUM | P1 |
| Real-time state sync | HIGH | HIGH | P1 |
| Observer role | MEDIUM | LOW | P1 |
| Copy session log to clipboard | MEDIUM | LOW | P2 |
| Vote distribution histogram | MEDIUM | LOW | P2 |
| Reconnection / rejoin by name | MEDIUM | MEDIUM | P2 |
| Story queue (pre-loaded) | MEDIUM | MEDIUM | P3 |
| Round timer | LOW | MEDIUM | P3 |
| Configurable card decks | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Note: Direct competitor access was unavailable during research. Analysis is based on training knowledge of major planning poker products as of 2025.

| Feature | PlanningPoker.com | Pointing Poker | Scrumpoker.online | Our Approach |
|---------|-----------------|----------------|-------------------|--------------|
| Account required | Optional (free tier is no-account) | No | No | No — name only |
| Card deck | Fibonacci + configurable | Fibonacci + configurable | Fibonacci + configurable | Fibonacci only (v1) |
| Real-time sync | WebSocket | WebSocket | WebSocket | Serverless-compatible (Pusher/Ably/Supabase) |
| Host reveal | Yes | Yes | Yes | Yes |
| Observer role | Yes | Yes | Unclear | Yes |
| Jira integration | Yes (paid) | No | No | No — explicitly out of scope |
| Session history | Yes (paid) | No | No | Ephemeral + clipboard export |
| Story queue | Yes | Yes | Yes | v2+ consideration |
| Vote distribution | Yes | Basic | Yes | v1.x |
| Mobile web | Yes | Yes | Yes | Yes (responsive) |
| Mobile app | No | No | No | No |

## Sources

- Domain knowledge of established planning poker tools: PlanningPoker.com, Pointing Poker, Scrumpoker.online, Agile Poker for Jira, Parabol — MEDIUM confidence (training data, not live verified)
- PROJECT.md constraints and out-of-scope decisions — HIGH confidence (authoritative for this project)
- Agile estimation methodology literature (Fibonacci sequence rationale, anchoring bias prevention) — HIGH confidence (stable domain knowledge)
- WebSearch and WebFetch were unavailable during this research session; live competitor verification should be done before feature scope is finalized

---
*Feature research for: Real-time planning poker web app*
*Researched: 2026-03-18*
