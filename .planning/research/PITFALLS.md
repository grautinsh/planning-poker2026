# Pitfalls Research

**Domain:** Real-time collaborative web app (Planning Poker)
**Researched:** 2026-03-18
**Confidence:** HIGH (Vercel limits from official docs), MEDIUM (real-time patterns from domain knowledge and architecture reasoning)

---

## Critical Pitfalls

### Pitfall 1: Attempting to Run a WebSocket Server on Vercel Functions

**What goes wrong:**
You try to use a native WebSocket server (e.g., `ws`, `socket.io` with Node adapter, or raw `net.Server`) inside a Vercel serverless function. The function either fails to deploy, fails at runtime, or connects successfully but drops all clients the moment the function returns — which is immediately.

**Why it happens:**
Vercel serverless functions are request-response by design. They terminate after sending a response. There is no persistent process to hold open a WebSocket connection. Developers coming from Node.js or Express assume the server model is the same.

**How to avoid:**
Use a managed real-time service as the WebSocket layer. Vercel's own documentation explicitly states: "Vercel Functions do not support acting as a WebSocket server." Recommended alternatives in the Vercel docs: Pusher, Ably, Supabase Realtime, or Liveblocks. Your Vercel functions only handle HTTP API calls (join room, cast vote, reveal votes) and write to shared state — the real-time service handles broadcasting those changes to all connected clients.

**Warning signs:**
- You import `ws` or `socket.io` in an `app/api/` route file
- You see "function timeout" or silent disconnections immediately after connecting
- Local dev works (because you have a long-lived dev server) but production breaks

**Phase to address:**
Phase 1 — Architecture / infrastructure setup. Must be decided before any real-time feature is built.

---

### Pitfall 2: Vote Reveal Race Condition

**What goes wrong:**
Two participants submit votes at the same moment the host triggers reveal. One of those votes arrives at the server after the reveal has been written. The room state now shows "revealed" but one participant's card is missing or shows their pre-reveal null state. From the UI perspective, one card appears blank during the reveal animation.

**Why it happens:**
With serverless functions and an external real-time service, there is no single authoritative lock over the reveal operation. A naive implementation does: (1) set `status = revealed` in the database, (2) broadcast reveal event. But a concurrent vote write that landed between steps 1 and 2 — or arrived at the client slightly after the broadcast — creates an inconsistency.

**How to avoid:**
- Make vote casting a no-op once `status = revealed` by checking state before writing: reject any vote submission if `room.status === 'revealed'`
- Use an atomic conditional update for the reveal operation: only flip to `revealed` if status is currently `voting`
- In the UI, once the reveal event is received, freeze the vote count display and do not allow further updates to vote slots
- Consider a brief "closing" grace window: for 500ms before reveal fires, reject new votes client-side and visually disable the card deck

**Warning signs:**
- Occasional blank card during reveal in testing with multiple tabs voting simultaneously
- Vote count in the header jumps up by one after reveal is already shown

**Phase to address:**
Phase 2 — Core voting flow. Must be validated with concurrent-user testing (multiple tabs) before considering the feature done.

---

### Pitfall 3: Host Leaves Room — Session Orphaned

**What goes wrong:**
The host closes the browser tab or loses connection. All participants are still connected to the real-time channel, can see each other, but no one can trigger reveal, reset, or advance to the next story. The session is permanently stuck.

**Why it happens:**
Host actions (reveal, reset, next story) are gated by host identity. If there is no host-transfer or auto-promote mechanism, and host identity is a single name/token in the room, loss of host = loss of control. The session log will never record a final estimate. Participants cannot self-rescue.

**How to avoid:**
Two options, choose one explicitly:
1. **Host transfer on disconnect:** When the host disconnects (presence event from the real-time service), automatically promote the next-oldest participant to host and broadcast the role change.
2. **Session link as the host credential:** Whoever holds the session creation token can claim host role. If the host shares the tab URL with another participant, they can refresh and reclaim host.

Given no-auth, name-only identity, option 2 is simplest: store `hostToken` (a UUID generated at room creation) in `localStorage`. Any browser holding that token is the host. Reconnecting with the same token reclaims host status.

**Warning signs:**
- No presence/disconnect event handling in the real-time service integration
- Host role stored only in server-side session with no recovery path
- No UI for participants when host is gone (they see a frozen state)

**Phase to address:**
Phase 2 — Room lifecycle. Must be designed alongside the room creation flow, not added as an afterthought.

---

### Pitfall 4: State Desync on Reconnect

**What goes wrong:**
A participant loses their network connection briefly (mobile, flaky wifi) and reconnects to the real-time channel. They rejoin the channel and receive new events going forward, but they missed events during the gap. Their UI shows an outdated state — e.g., they see the voting phase when the room is already in the revealed phase, or they see 3 votes when 7 have been cast.

**Why it happens:**
Real-time channels are event-driven and do not replay missed events by default. Most managed services (Pusher, Ably, Supabase Realtime) let you receive events going forward from reconnect, not historically. A participant who reconnects after a reveal event was fired will never see it via the channel alone.

**How to avoid:**
On reconnect (or on initial join), always perform a full state fetch via a REST API call: `GET /api/room/[roomId]` which returns the current authoritative room snapshot. Apply this snapshot to local state before re-subscribing to live events. This makes reconnection recovery identical to fresh join.

Implement this as a single `fetchRoomState()` function called:
- On initial page load
- On channel reconnect event
- On visibility change (tab regains focus after being hidden)

**Warning signs:**
- No HTTP endpoint exists to fetch current room state — only WebSocket events are used
- Reconnect handling only calls `channel.subscribe()` without re-fetching state
- Participants who rejoin after being kicked see stale vote counts

**Phase to address:**
Phase 2 — Real-time integration. Design the REST state-fetch endpoint at the same time as the real-time event handlers.

---

### Pitfall 5: Votes Visible Before Reveal (Information Leakage)

**What goes wrong:**
The server or real-time events expose the actual vote values (e.g., `{userId: "alice", vote: 8}`) to all connected clients, not just the host. A participant who inspects the network tab sees everyone's votes before the host triggers reveal, defeating the anchoring-bias prevention that is the app's core value.

**Why it happens:**
Developer broadcasts the full room state (including vote values) on each vote event to make "how many people have voted" visible to all. It feels efficient to send one event with all data. But this sends the vote value to all subscribers, not just whether a vote has been cast.

**How to avoid:**
Distinguish between two separate pieces of data:
- **Vote presence** (public): `{userId: "alice", hasVoted: true}` — safe to broadcast to all
- **Vote value** (private): `{userId: "alice", vote: 8}` — only included in the payload after `status = revealed`

API design rule: The `GET /api/room/[roomId]` endpoint and all real-time broadcast events must strip vote values from the payload when `room.status !== 'revealed'`. Apply this filter server-side, never trust the client to hide it.

**Warning signs:**
- Room state API returns `votes: [{name: "alice", value: 8}]` while status is `voting`
- Real-time broadcast event payload includes numeric vote values before reveal
- No server-side filtering step before broadcasting events

**Phase to address:**
Phase 1/2 — Data model and API design. The filtering rule must be baked into the room state serialization layer from the start. Retrofitting it later is error-prone.

---

### Pitfall 6: No-Auth Identity Allows Vote Stuffing / Impersonation

**What goes wrong:**
Because identity is name-only with no account system, a bad actor can join as "Alice" and submit a vote, then open a second tab and join as "Alice" again and submit a second vote, doubling their influence. Or they join as "Bob" (an existing participant) and submit a vote on Bob's behalf.

**Why it happens:**
Name-only systems have no uniqueness enforcement. The server accepts any name and creates a new participant entry, leading to duplicates.

**How to avoid:**
Assign a UUID (`participantId`) server-side or generate it client-side and store it in `sessionStorage` when a participant first joins. Use this ID — not the display name — as the authoritative identity key for votes. Enforce uniqueness of `participantId` within a room. If a second tab joins with the same `participantId` (e.g., from the same session), treat it as a reconnect, not a new participant.

For name collision: if "Alice" already exists in the room with a different `participantId`, reject the join or append a disambiguator (e.g., "Alice (2)"). Deciding this behavior explicitly is better than ignoring it.

**Warning signs:**
- Vote deduplication is based on display name, not an immutable ID
- Two tabs with the same name can both appear in the participant list
- No `participantId` concept in the data model

**Phase to address:**
Phase 1 — Data model design. This affects the schema for rooms, participants, and votes.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store all room state in real-time service channel metadata only (no database) | No database needed | Room vanishes if channel is recycled by provider; no recovery, no session log | Never — session log is a stated requirement |
| Use display name as participant primary key | Simpler data model | Duplicate-name bugs, vote stuffing, reconnect confusion | Never for this app |
| Skip server-side vote filtering, hide votes in the client UI | Faster to build | Vote values visible in network tab; trivial to cheat | Never — defeats core product value |
| Poll for state instead of real-time events | Avoids WebSocket complexity | Noticeable lag for 8–12 concurrent participants; feels broken | Acceptable only as a fallback/degraded mode |
| Single global "room" instead of room-per-session | No routing needed in MVP | Collapses all teams into one session; unusable | Never |
| Skip reconnection state-fetch, assume channel replay is sufficient | Less code | Stale UI after network blip | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel Functions | Trying to run socket.io or `ws` server inside a function | Use managed real-time service; functions are HTTP-only |
| Vercel KV | Referencing Vercel KV docs or SDK | Vercel KV was discontinued December 2024; use Upstash Redis via Vercel Marketplace instead |
| Supabase Realtime / Pusher | Sending full room state (including vote values) in broadcast events | Serialize two views of room state: redacted (voting) and full (revealed); use redacted view in all broadcasts until reveal |
| Supabase Realtime / Pusher | Assuming missed events are replayed on reconnect | Always re-fetch room state via REST on reconnect; treat channels as event streams, not state stores |
| Upstash Redis (session store) | Forgetting TTL on room keys | Set a TTL (e.g., 24 hours) so abandoned rooms are cleaned up automatically; no manual cleanup required |
| Supabase Realtime | Subscribing to presence events for host-leave detection without handling the "host rejoins" case | Track host by token/ID, not just presence; presence can flicker during reconnects |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Broadcasting full participant list + all votes on every event | Payload size grows linearly with participants; unnecessary data transfer | Send delta events (e.g., `participant_joined`, `vote_cast`, `vote_revealed`) not full state snapshots | At 20+ participants per session |
| Fetching room state on every vote event received by all clients | N clients × M votes = N×M REST calls to serverless function | Only fetch state on join and reconnect; let real-time events drive incremental updates | At 10+ participants actively voting simultaneously |
| Storing session log as a growing JSON array in a single Redis key | Write amplification: rewrite entire array on each story completion | Append-only log: push each completed story as a separate list entry | Unlikely to matter at this scale, but append is still better practice |
| Cold start latency on Vercel Hobby when functions are idle | First participant to join a room gets 1–3s latency before room is created | Keep API surface minimal; consider edge runtime for the join endpoint | Every session start if app is low-traffic |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting any room ID in vote submission without verifying participant membership | Participant in room A can submit votes to room B | Validate `participantId` is a member of the target `roomId` before accepting a vote |
| Storing `hostToken` in a cookie without `HttpOnly` | XSS can steal host token and hijack session control | Use `HttpOnly; SameSite=Strict` cookies for the host token, or use `sessionStorage` (not `localStorage`) which is tab-scoped |
| Exposing real-time channel credentials (e.g., Pusher secret key) in client-side code | Anyone can publish events as if they were the server, injecting fake reveals or fake votes | Generate short-lived auth tokens server-side for subscribing to private channels; never expose service secret keys to the client |
| No rate limiting on the vote submission endpoint | Automated vote flooding | Rate limit by `participantId` + `roomId` per time window at the API route level |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Not indicating that votes are hidden (just showing blank cards) | Participants unsure if their vote registered; anxiety about the system working | Show a "voted" badge or checkmark on each participant tile — confirmed, not the value |
| Simultaneous card-flip animation feels arbitrary | Reveal feels laggy or asynchronous if not triggered simultaneously for all clients | Trigger reveal animation client-side immediately on receiving the reveal event; do not wait for a server round-trip after the event |
| No confirmation when the host resets a round | Accidental reset destroys all votes; participants must re-vote | Require a confirm step (or undo window) before resetting — especially if any votes were cast |
| Participant list order shuffles on each event | Disorienting; participants lose track of who has voted | Sort participant list by join order (stable sort); do not sort alphabetically or by vote status |
| No visual distinction between "observer" and "voter" roles | Observers look like voters who haven't voted; host waits for them | Clear visual badge on observers in the participant list |

---

## "Looks Done But Isn't" Checklist

- [ ] **Vote reveal:** Verify that vote values cannot be read from network tab before reveal — test with browser devtools open on a non-host browser
- [ ] **Reconnection:** Disconnect a participant's network for 5 seconds mid-session, reconnect, and verify their UI matches current room state exactly
- [ ] **Host loss:** Close the host's tab during a voting round; verify other participants receive a clear signal and can continue (or transfer host)
- [ ] **Concurrent votes:** Open 5 tabs, vote from all simultaneously, verify only one vote per participant is recorded
- [ ] **Session log:** Complete 3 stories in a session, verify all 3 appear in the log with correct estimates after the session ends
- [ ] **Observer cannot vote:** Verify the card deck is non-interactive for observer-role participants
- [ ] **Reveal is one-way:** After reveal, verify the "cast vote" action is disabled; votes cannot be changed post-reveal
- [ ] **Vercel cold start:** First request to a fresh deployment — verify the room creation endpoint responds within an acceptable time

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| WebSocket server on Vercel (deployed wrong) | HIGH | Migrate to managed real-time service; requires redesigning event flow and replacing all socket logic |
| Vote reveal race condition discovered in production | MEDIUM | Add server-side guard (reject votes when status=revealed); deploy hotfix; affected sessions may need manual reset |
| Host loss with no recovery mechanism | MEDIUM | Add host-token reclaim flow; existing orphaned sessions cannot be recovered retroactively |
| State desync on reconnect (discovered in testing) | LOW | Add REST state-fetch on reconnect event; additive change, does not require schema changes |
| Vote value leakage discovered | HIGH | Audit and patch every code path that serializes room state; re-test all API endpoints and broadcast events; consider security disclosure if sessions are live |
| Vercel KV dependency (discontinued Dec 2024) | MEDIUM | Migrate to Upstash Redis via Vercel Marketplace; connection strings and SDK differ but commands are compatible |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebSocket on Vercel | Phase 1: Architecture | Verify no `ws`/`socket.io` in function code; real-time service SDK confirmed as the only channel |
| Vote reveal race condition | Phase 2: Core voting flow | Concurrent-tab test: 5 tabs vote, host reveals simultaneously, zero blank cards |
| Host-leaves orphaned session | Phase 2: Room lifecycle | Close host tab mid-vote; confirm participants see a host-gone state or host transfers |
| State desync on reconnect | Phase 2: Real-time integration | Simulate 5s network drop during voting; confirm state matches on reconnect |
| Vote value leakage | Phase 1/2: Data model + API | Inspect network tab as non-host during voting phase; vote values must not appear |
| No-auth identity / vote stuffing | Phase 1: Data model | Two tabs with same name in same room; confirm only one participant entry and one vote allowed |
| Vercel KV deprecation | Phase 1: Infrastructure | Use Upstash Redis via Vercel Marketplace; no Vercel KV SDK in package.json |
| Observer cannot vote | Phase 2: Participant roles | Join as observer; card deck must be non-interactive |

---

## Sources

- Vercel official limits documentation: https://vercel.com/docs/limits/overview (confirmed WebSocket restriction, function timeouts, Hobby plan limits)
- Vercel Functions limitations: https://vercel.com/docs/functions/limitations (confirmed max duration, payload size, file descriptors)
- Vercel KV deprecation: https://vercel.com/docs/redis (confirmed KV discontinued December 2024; migrated to Upstash Redis)
- Vercel WebSocket guidance: https://vercel.com/docs/limits/overview#websockets ("Vercel Functions do not support acting as a WebSocket server")
- Domain knowledge: real-time collaborative app patterns (MEDIUM confidence — based on established patterns in WebSocket/event-driven systems)

---
*Pitfalls research for: Real-time planning poker collaborative web app*
*Researched: 2026-03-18*
