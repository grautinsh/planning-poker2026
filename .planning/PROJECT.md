# Planning Poker

## What This Is

A real-time planning poker app for dev teams to run story point estimation sessions in a browser. A host creates a session room and shares a link; participants join by entering their name (no account needed), pick a card from a Fibonacci deck (1–55, ∞, ?), and the host reveals all votes simultaneously to prevent anchoring bias. Completed stories accumulate in a session log that any participant can export as Markdown. Participants who lose their connection can rejoin by name and recover their state.

## Core Value

Every participant sees the same state in real time — votes stay hidden until the host reveals, preventing anchoring bias and making remote sprint planning feel synchronous.

## Requirements

### Validated

- ✓ Host can create a session room and get a shareable link — v1.0
- ✓ Participants join by entering their name (no login required) — v1.0
- ✓ Participants can join as voters or observers (observers can't vote) — v1.0
- ✓ Host enters a story title shown to all participants before each vote — v1.0
- ✓ Participants pick a card from the Fibonacci deck (1, 2, 3, 5, 8, 13, 21, 34, 55, ∞, ?) — v1.0
- ✓ Votes are hidden from all participants until revealed — v1.0
- ✓ Host manually triggers vote reveal — all cards flip simultaneously — v1.0
- ✓ After reveal, host can reset the round for re-voting on the same story — v1.0
- ✓ Host can move to the next story with an agreed estimate — v1.0
- ✓ Final agreed estimate for each story is recorded in a session log — v1.0
- ✓ All participants see real-time updates (who joined, who voted, vote reveal) — v1.0
- ✓ Participants can reconnect by name after losing their browser session — v1.0
- ✓ Any participant can copy the session log as Markdown — v1.0

### Active

(None — clean slate for v1.1)

### Out of Scope

- Login / accounts — name-only entry is sufficient for internal team use
- Configurable card decks — Fibonacci is the standard, keep it simple
- Jira / ticketing integrations — verbal announcement + title entry covers the need
- Auto-reveal when all voted — host controls the pace
- Mobile app — web browser is the target platform
- Participant presence tracking — "stay in list" behaviour is fine for short synchronous sessions

## Context

- **Shipped:** v1.0 — 2026-03-19
- **Codebase:** ~2,440 TypeScript/TSX LOC, 4 phases, 17 plans, 67 automated tests
- **Stack:** Next.js 16 App Router, Upstash Redis, Pusher Channels, Tailwind CSS v4, Vitest
- **Deployment:** Vercel (free tier)
- **Users:** Single dev team, sprint planning sessions (5–12 people, ephemeral sessions)
- **Known limitations:** No per-participant offline indicator; participants stay in the list until 24h TTL

## Constraints

- **Deployment**: Vercel — serverless; real-time via Pusher Channels
- **Auth**: None — participant identity is name-only; host identity is cookie/token
- **Scale**: Small team tool — not designed for hundreds of concurrent sessions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Name-only identity (no auth) | Internal team tool; friction of accounts outweighs benefits | ✓ Works well — no user complaints |
| Fibonacci deck only (extended to 34, 55) | Reduces scope; added 34/55 mid-build for completeness | ✓ Good call |
| Host-controlled reveal | Prevents anchoring; host sets discussion pace | ✓ Core mechanic works |
| Vercel deployment | Easy, free, zero infra maintenance | ✓ Deploying v1.0 |
| Pusher `unavailable` state for disconnect indicator | Avoids false flash on initial connect | ✓ Correct — `connecting` excluded intentionally |
| `isDisconnected` clears only on `connected` | Prevents banner disappearing during retry cycles | ✓ Bug found and fixed in Phase 4 |
| Name-match reconnect (no cookie) | Lets participants recover state after tab close | ✓ Works; no duplicate participant |
| Participants stay in list when offline | Simpler than presence channels; fine for short sessions | — Pending user feedback |

---
*Last updated: 2026-03-19 after v1.0 milestone*
