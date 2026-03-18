# Project Research Summary

**Project:** Planning Poker — Real-time estimation tool
**Domain:** Real-time multiplayer web app (Vercel-hosted, serverless)
**Researched:** 2026-03-18
**Confidence:** MEDIUM (stack versions HIGH; architectural patterns and feature scope MEDIUM)

## Executive Summary

Planning Poker is a well-understood product in a constrained deployment environment. The domain is mature — tools like PlanningPoker.com, Pointing Poker, and Scrumpoker.online have established a clear feature contract that users arrive with. The core technical challenge is not feature invention but correct architecture: getting WebSocket-style real-time synchronization working on a serverless Vercel deployment, where native WebSocket servers are explicitly unsupported. The recommended approach is to use Pusher Channels as the managed real-time layer (presence + broadcast), Upstash Redis for ephemeral session state, and Next.js 16 App Router for the full-stack React application — all three are proven together on Vercel with no persistent process requirement.

The recommended build strategy is to establish infrastructure and data model correctness first, then layer the real-time core, then build the estimation mechanics on top. The data model must enforce three non-negotiable rules from day one: vote values are never exposed before reveal (server-side filtering only, never trust client), participant identity is a server-assigned UUID (not a display name), and host identity is a token stored in a cookie (not session presence). Retrofitting any of these rules after voting logic is built is error-prone and risks shipping a product where users can inspect others' votes via the network tab — which defeats the entire anti-anchoring value proposition.

The highest-risk milestone is the simultaneous vote reveal mechanic. This is the defining UX moment of the product. It requires an atomic state transition in Redis, a broadcast that carries all vote values in a single event (not a subsequent fetch), and client-side animation triggered on event receipt — not on a round-trip. A concurrent vote-cast / reveal race condition must be explicitly guarded against with a server-side status check. Testing this feature requires multiple simultaneous browser tabs and should be validated before any downstream features are built on top of it.

## Key Findings

### Recommended Stack

The stack is purpose-selected for a Vercel serverless constraint. Pusher Channels is the primary recommendation for real-time transport because it requires no persistent server process: a Next.js Route Handler calls `pusher.trigger()` after mutating Redis, and Pusher's infrastructure delivers the event to all subscribers over WebSocket. Upstash Redis provides session state via an HTTP-based client (not TCP), which sidesteps connection pooling issues in serverless. Next.js 16 with App Router is the native fit for Vercel, and Tailwind v4 (no config file) keeps styling overhead minimal for a game-style card UI.

Supporting libraries are deliberately lightweight: `nanoid` for short room IDs, `zod` for API payload validation, `zustand` for local UI state between events, and `cookies-next` for host token persistence. The explicit anti-list is equally important: no `socket.io`, no native `ws`, no Redux, no React Query, no JWT, no Postgres — each of these adds overhead with no benefit given the ephemeral, single-session, no-auth model.

**Core technologies:**
- Next.js 16 (App Router): Full-stack framework — native Vercel deployment, API Route Handlers, React 19 support
- React 19: UI rendering — required by Next.js 16; concurrent features aid real-time state
- TypeScript 5.9: Type safety — catches event-shape bugs endemic to real-time event-driven code
- Pusher Channels (server 5.3.3, client 8.4.2): Real-time pub/sub — serverless-compatible, presence channels built in, free tier sufficient
- Upstash Redis (@upstash/redis 1.37.0): Session state — HTTP-based client, works in serverless, TTL-based auto-cleanup
- Tailwind CSS 4.2.2: Styling — zero config, utility-first, ideal for card-flip grid UI
- zustand 5.0.12: Client state — lightweight store for UI state between Pusher events
- zod 4.3.6: Validation — parse all API payloads at the boundary; TS 5.x required

### Expected Features

The feature set is well-defined and conservative. There are no novel features — every item in the MVP is a table-stakes expectation from comparable tools. The key product decision is to defer all features that would require persistence beyond a session (history, accounts, Jira integration) and defer configuration complexity (custom card decks, timers). Ship the poker table, not the whole meeting room.

**Must have (table stakes — v1 MVP):**
- Session creation with shareable link — root of the entire dependency tree; nothing works without it
- Name-only join (no account required) — eliminates friction for an ephemeral internal tool
- Participant presence list with voted/not-voted indicator — team needs to know when everyone is ready
- Story title entry by host, displayed to all — context for what is being estimated
- Fibonacci card selection (1, 2, 3, 5, 8, 13, 21, ?, infinity) — the core estimation mechanic
- Votes hidden until host reveals — the anti-anchoring mechanic; the entire product rationale
- Host-controlled simultaneous reveal — the defining UX moment; all cards flip at once
- Post-reveal vote summary (min, max, average) — drives discussion
- Re-vote on same story — disagreement resolution
- Session log accumulating agreed estimates — the output artifact of the session
- Observer role — non-voting participants; expected by POs and stakeholders
- Real-time state sync for all of the above — non-negotiable foundation

**Should have (v1.x — add after validation):**
- Copy session log to clipboard — low effort, high value when teams ask "how do I save this?"
- Vote distribution histogram — visual spread accelerates post-reveal discussion
- Reconnection / rejoin by name — critical for mobile and flaky-wifi users
- Spectator-visible named vote cards post-reveal — accountability and discussion fuel

**Defer (v2+):**
- Story queue (pre-loaded list) — adds host workflow complexity; validate manual entry first
- Round timer — teams vary on timeboxing; validate the need before building
- Configurable card decks — explicitly out of scope for v1; most teams use Fibonacci anyway

### Architecture Approach

The architecture follows a strict separation of concerns: Next.js Route Handlers are stateless HTTP mutators (write to Redis, trigger Pusher broadcast); Pusher delivers events to all subscribed clients; Redis holds authoritative room state with a 24-hour TTL. The client-side `useRoom` hook owns the real-time subscription lifecycle and a REST fetch for initial/reconnect state. This separation means the API routes never need to be long-running, Pusher never needs to be authoritative, and Redis never needs to be queried by the client directly.

**Major components:**
1. React UI (Next.js App Router client) — renders room state, handles user actions, consumes Pusher events
2. Next.js Route Handlers (Vercel Functions) — mutate Redis state, trigger Pusher broadcasts, validate host tokens
3. Pusher Channels — delivers broadcast and presence events to all connected browser clients
4. Upstash Redis — holds authoritative room state (room metadata, hidden votes, session log) with TTL
5. `useRoom` hook — subscribes to Pusher channel, fetches full state on join/reconnect, drives local React state

**Key data model rules:**
- Room state in Redis: `room:{roomId}` hash (metadata), `room:{roomId}:votes` hash (values, never exposed until `revealed: true`), `room:{roomId}:log` list (append-only)
- Client state sourced from: Pusher presence for participant list, Pusher broadcasts for incremental updates, REST GET for initial and reconnect snapshots
- Vote reveal broadcast carries all vote values in one payload — true simultaneity, no staggered client fetches

### Critical Pitfalls

1. **WebSocket server on Vercel** — Vercel Functions do not support persistent connections. Any import of `ws` or `socket.io` in an API route will fail silently in production (works locally because the dev server is long-lived). Use Pusher exclusively for real-time; Route Handlers are HTTP-only.

2. **Vote value leakage before reveal** — Broadcasting the full room state (including vote values) on each `VOTE_CAST` event exposes values to anyone with the network tab open. The server must maintain two serialization views: redacted (voting phase, `hasVoted: boolean` only) and full (post-reveal, includes values). Apply this filter server-side, always. This is not a UI problem; it is an API design requirement.

3. **Vote reveal race condition** — A vote submitted concurrently with the reveal operation can arrive after `revealed: true` is set, producing a blank card. Guard server-side: reject vote submissions when `room.status === 'revealed'`. Make the reveal an atomic conditional write. Test with 5 concurrent tabs.

4. **State desync on reconnect** — Real-time channels do not replay missed events. A participant who reconnects after a reveal event will see a stale pre-reveal UI. On every reconnect (and on tab visibility-change), call `GET /api/rooms/{roomId}` for a full state snapshot before re-subscribing to events.

5. **Host leaves — session orphaned** — Without host transfer or token-based host reclaim, losing the host tab permanently blocks the session. Store the host token in a cookie at room creation. Any browser presenting that token can reclaim host controls. Design this alongside room creation, not as an afterthought.

6. **No-auth identity allows vote stuffing** — Name-only identity with no deduplication lets a participant open two tabs as "Alice" and vote twice. Assign a server-generated `participantId` UUID at join time, store it in a cookie, enforce one vote per `participantId` per room. Never use display name as a primary key.

## Implications for Roadmap

Based on combined research, the suggested build order follows component dependency chains and front-loads the riskiest architectural decisions.

### Phase 1: Foundation — Data Model, Infrastructure, and Identity

**Rationale:** Everything else depends on Redis schema correctness and Pusher integration. The data model rules (vote hiding, participantId keying, host token) must be established before any feature is built — retrofitting them after voting logic exists is high-risk. Pitfalls 1, 2, 5, and 6 are all Phase 1 concerns.

**Delivers:** Working room creation, shareable link, name-only join with UUID identity, host token cookie, Redis schema with TTL, Pusher channel skeleton, REST state endpoint.

**Addresses:** Session creation + shareable link, name-only join, host identity (from FEATURES.md table stakes)

**Avoids:** WebSocket-on-Vercel pitfall (Pusher architecture locked in), vote leakage (server-side redacted serialization baked in), vote stuffing (participantId keying from day one), Vercel KV deprecation (Upstash Redis from the start)

### Phase 2: Real-Time Core — Presence, Voting, and Reveal

**Rationale:** The reveal mechanic is the highest-risk, most product-critical feature. Build it while the codebase is still small and the full participant flow is testable. This phase delivers the complete poker loop: join, vote, reveal, re-vote. The race condition and state desync pitfalls must be validated here before any downstream features depend on them.

**Delivers:** Participant presence list, observer role, story title broadcast, Fibonacci card selection, hidden vote submission, host-controlled simultaneous reveal, post-reveal vote summary, re-vote on same story.

**Uses:** Pusher presence channels, Pusher broadcast with vote payload in reveal event, Redis atomic conditional reveal write, zustand for local UI state

**Implements:** CardDeck, VoteGrid, ParticipantList, HostControls components; vote + reveal + reset API routes; `useRoom` hook with reconnect state-fetch

**Avoids:** Vote reveal race condition (atomic guard + concurrent-tab testing), state desync (REST fetch on reconnect), host-leaves orphan (host token reclaim)

### Phase 3: Session Output — Log and Export

**Rationale:** The session log is the tangible output artifact of the tool. It depends on the reveal flow (Phase 2) being complete and stable. Once the core poker loop works, this phase closes the loop by making results persistent within the session and exportable.

**Delivers:** Session log accumulating agreed estimates after each story, copy-to-clipboard export (Markdown format), spectator-visible named vote cards post-reveal.

**Addresses:** Session log, copy session log to clipboard, spectator-visible vote cards (from FEATURES.md)

### Phase 4: Polish and Resilience

**Rationale:** These features improve the experience for real usage but are not blockers for the first real sprint planning session. Reconnection recovery is the most important item here — flaky wifi and mobile users will encounter it immediately.

**Delivers:** Reconnection/rejoin by name (restore vote state on page reload), vote distribution histogram, UX hardening (reset confirmation, observer badges, stable participant sort order), cold-start latency improvements.

**Addresses:** Reconnection/rejoin by name, vote distribution histogram (from FEATURES.md v1.x)

### Phase Ordering Rationale

- Phase 1 before Phase 2: Redis schema and Pusher channel architecture cannot be retrofitted once voting logic exists. The two server-side data rules (vote hiding, participantId keying) are foundational.
- Phase 2 before Phase 3: The session log depends on the reveal flow completing cleanly. Building log storage before the reveal mechanic is proven creates integration risk.
- Phase 3 before Phase 4: Export and output are more valuable to early users than reconnection polish. Teams will ask "how do I save this?" before they encounter reconnection issues.
- Reveal in Phase 2, not later: The architecture research explicitly warns against deferring reveal to the end. It is the highest-complexity state transition and must be tested in a complete context.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Vote Reveal):** The atomic conditional reveal in Upstash Redis (using `WATCH`/`MULTI`/`EXEC` or Lua scripting) may need specific API verification — Upstash's HTTP client has constraints on multi-command transactions. Validate before implementation.
- **Phase 2 (Pusher Presence):** Pusher Channels presence authentication requires a server-side auth endpoint (`/api/pusher/auth`). The exact auth flow with Next.js App Router should be verified against current Pusher documentation before building.

Phases with standard patterns (skip research):
- **Phase 1 (Infrastructure):** nanoid room IDs, httpOnly cookies with cookies-next, Upstash Redis hash + TTL — all well-documented, no ambiguity.
- **Phase 3 (Session Log):** Redis append-only List, clipboard API — standard patterns with no complexity.
- **Phase 4 (Polish):** Component-level UX work and histogram rendering (Recharts or similar) — standard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Package versions confirmed via npm registry (HIGH); rationale for Vercel/Pusher/Upstash patterns based on training data (MEDIUM); Pusher and Upstash free tier limits should be verified at their pricing pages before launch |
| Features | MEDIUM | Domain is mature and stable; analysis based on training knowledge of major tools (no live competitor access); feature scope driven by PROJECT.md constraints which are HIGH confidence |
| Architecture | HIGH | Vercel WebSocket constraint confirmed via official docs; patterns (event-sourced state, separate read model for redacted vs. full votes, REST on reconnect) are established and well-reasoned |
| Pitfalls | HIGH (infrastructure), MEDIUM (patterns) | Vercel limits from official docs (HIGH); race condition, desync, and identity pitfalls from domain reasoning and established patterns (MEDIUM) |

**Overall confidence:** MEDIUM-HIGH — the architecture is well-grounded in documented constraints; feature scope is conservative and well-understood; the main uncertainty is free-tier limit verification and specific Pusher/Upstash API behaviors at implementation time.

### Gaps to Address

- **Pusher free tier limits:** 200 concurrent connections, 200k messages/day — confirmed from training data but should be verified at https://pusher.com/channels/pricing before committing. If a team uses this for all sprint planning across an org, 200 concurrent may be insufficient.
- **Upstash Redis free tier:** 10k commands/day — verify at https://upstash.com/pricing. A busy day of sprint planning sessions (multiple teams) could approach this limit.
- **Pusher presence auth flow with Next.js App Router:** The `/api/pusher/auth` endpoint pattern for presence channel authentication needs verification against current Pusher docs. This is a known requirement but the exact implementation details depend on current SDK versions.
- **Upstash Redis multi-command atomicity:** The reveal operation should be atomic. Upstash's HTTP client has constraints on `MULTI`/`EXEC` pipelines — verify the correct approach (Lua script vs. pipeline) before implementing the reveal route.
- **Next.js 16 specifics:** Next.js 16 was released after the research knowledge cutoff (Aug 2025). Peer dependency compatibility is confirmed via npm, but any breaking changes in App Router Route Handler behavior should be checked against the changelog during setup.

## Sources

### Primary (HIGH confidence)
- Vercel Functions documentation — WebSocket restriction, max duration, Hobby plan limits, KV deprecation
- npm registry (live) — all package version numbers

### Secondary (MEDIUM confidence)
- Training data (Aug 2025 cutoff) — Pusher/Ably/Supabase Realtime comparison; Upstash Redis serverless patterns; Next.js App Router architecture; event-sourced real-time state pattern
- Training data — competitor feature analysis (PlanningPoker.com, Pointing Poker, Scrumpoker.online, Agile Poker for Jira, Parabol)
- Training data — Pusher free tier limits (200 concurrent, 200k msgs/day); Upstash free tier (10k commands/day)

### Tertiary (LOW confidence)
- Training data — Next.js 16 App Router specifics (released after knowledge cutoff; npm peer deps confirm React 19 compatibility but changelog not verified)

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
