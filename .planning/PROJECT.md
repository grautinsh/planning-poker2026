# Planning Poker

## What This Is

A real-time planning poker app for dev teams to run story point estimation sessions in a browser. A host creates a session room and shares a link; participants join by entering their name (no account needed), pick a card from a Fibonacci deck, and the host reveals all votes at once to spark discussion. Each story's final agreed estimate gets saved to the session log.

## Core Value

Every participant sees the same state in real time — votes stay hidden until the host reveals, preventing anchoring bias and making remote sprint planning feel synchronous.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Host can create a session room and get a shareable link
- [ ] Participants join by entering their name (no login required)
- [ ] Participants can join as voters or observers (observers can't vote)
- [ ] Host enters a story title/description shown to all participants before each vote
- [ ] Participants pick a card from the Fibonacci deck (1, 2, 3, 5, 8, 13, 21, ∞, ?)
- [ ] Votes are hidden from all participants (including host) until revealed
- [ ] Host manually triggers vote reveal — all cards flip simultaneously
- [ ] After reveal, host can reset the round for re-voting on the same story
- [ ] Host can move to the next story
- [ ] Final agreed estimate for each story is recorded in a session log
- [ ] All participants see real-time updates (who joined, who voted, vote reveal)

### Out of Scope

- Login / accounts — name-only entry is sufficient for internal team use
- Configurable card decks — Fibonacci is the standard, keep it simple for v1
- Jira / ticketing integrations — verbal announcement + title entry covers the need
- Auto-reveal when all voted — host controls the pace
- Mobile app — web browser is the target platform

## Context

- Target users: a single dev team doing sprint planning sessions (typically 5–12 people)
- Sessions are ephemeral — no need for long-term persistence beyond the session log
- Deployment target: Vercel (free tier)
- Real-time synchronization is the core technical challenge — the tech stack must support WebSocket-style communication or equivalent

## Constraints

- **Deployment**: Vercel — rules out persistent WebSocket servers; must use serverless-compatible real-time (e.g. Pusher, Ably, Supabase Realtime, or Vercel KV + polling)
- **Auth**: None — participant identity is name-only; host identity is session ownership (cookie/token)
- **Scale**: Small team tool — not designed for hundreds of concurrent sessions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Name-only identity (no auth) | Internal team tool; friction of accounts outweighs benefits | — Pending |
| Fibonacci deck only (v1) | Reduces scope; most teams use this by default | — Pending |
| Host-controlled reveal | Prevents anchoring; host sets discussion pace | — Pending |
| Vercel deployment | Easy, free, zero infra maintenance | — Pending |

---
*Last updated: 2026-03-18 after initialization*
