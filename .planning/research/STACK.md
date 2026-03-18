# Stack Research

**Domain:** Real-time multiplayer web app (Planning Poker)
**Researched:** 2026-03-18
**Confidence:** MEDIUM — versions verified via npm registry; rationale based on training data (Aug 2025 cutoff) cross-referenced with package metadata. No WebSearch/WebFetch available during this session.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.0 | Full-stack React framework | App Router + Route Handlers give you API endpoints in the same repo as the UI; Vercel is Next.js's native deployment target, zero config. Supports React 19. |
| React | 19.2.4 | UI rendering | Required by Next.js 16; concurrent features (useOptimistic, use()) help with real-time state. |
| TypeScript | 5.9.3 | Type safety | Catches the class of bugs (wrong event shapes, missing fields on session state) that are common in real-time event-driven apps. Not optional on a stateful app like this. |
| Pusher Channels | server: 5.3.3, client: 8.4.2 | Real-time pub/sub | **Primary recommendation.** Pusher has a persistent WebSocket server you never manage; your Next.js Route Handler just calls `pusher.trigger()`. Free tier (200 concurrent connections, 200k messages/day) is more than sufficient for a single team tool. Presence channels give you who-is-online with one API call. Works perfectly on Vercel serverless. |
| Tailwind CSS | 4.2.2 | Styling | v4 drops the config file; just import in CSS. Zero-runtime, utility-first, ideal for a card-flip / grid-based game UI. No design system overhead. |

### Real-Time Layer — Decision

**Pusher Channels is recommended over alternatives for this use case.** See the comparison below. The critical constraint is Vercel serverless: you cannot hold a WebSocket connection open in a Route Handler (execution limit ~10s on hobby tier). You need a dedicated WebSocket host. Pusher is the industry-standard solution for this exact scenario.

**Pusher integration model for this app:**
- Next.js Route Handler (`POST /api/event`) receives a game action (vote, reveal, reset).
- Handler authenticates the request, mutates session state in storage, then calls `pusher.trigger(roomId, eventName, payload)`.
- All browser clients subscribed to the channel receive the event over Pusher's WebSocket.
- No polling. No long-running serverless functions.

### Session / State Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Upstash Redis | @upstash/redis 1.37.0 | Session state storage | HTTP-based Redis client — works in serverless/edge environments without connection pooling problems. Vercel KV is powered by Upstash under the hood, but using @upstash/redis directly gives you more control and avoids vendor lock-in. Free tier: 10,000 commands/day, plenty for ephemeral sessions. Store the room state (participants, votes, current story) as a single JSON blob keyed by room ID. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.1.7 | Generate room IDs | Generates short, URL-safe, collision-resistant IDs for room links (e.g. `poker.app/room/V1StGXR8`). Use instead of UUID — shorter output, edge-safe, no crypto dependency issues. |
| zod | 4.3.6 | Runtime validation | Validate all incoming API payloads (join room, cast vote, reveal). Prevents malformed state from entering the system. Use for Route Handler input parsing. |
| zustand | 5.0.12 | Client-side game state | Lightweight store for local UI state (my vote, revealed/hidden, loading states). Do NOT use for authoritative state — that lives in Redis and arrives via Pusher events. zustand only manages what the UI needs between events. |
| cookies-next | 6.1.1 | Host identity cookie | Store host token in a cookie after room creation so the host can reclaim host controls on page reload. Name-only auth means a cookie is the only identity mechanism needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit + integration tests | Faster than Jest, native ESM, compatible with the Next.js/TypeScript setup. Test game logic (vote aggregation, round reset, reveal rules) in isolation without a browser. |
| @testing-library/react (16.3.2) | Component tests | Test card selection UI and reveal animation triggers without Playwright overhead. |
| ESLint (10.0.3) | Linting | Use with `@eslint/js` and `typescript-eslint`. Next.js ships its own ESLint config — extend it. |
| Prettier (3.8.1) | Formatting | Non-negotiable for team projects. Configure once, forget. |

---

## Installation

```bash
# Create Next.js app (use latest, TypeScript, App Router, Tailwind)
npx create-next-app@latest planning-poker --typescript --tailwind --app

# Core real-time
npm install pusher pusher-js

# Storage
npm install @upstash/redis

# Utilities
npm install nanoid zod zustand cookies-next

# Dev dependencies
npm install -D vitest @testing-library/react @testing-library/user-event
```

---

## Alternatives Considered

### Real-Time Transport

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Pusher Channels | **Ably** (2.20.0) | Ably has a more generous free tier message limit and better SDK ergonomics, but is less widely documented for Next.js serverless patterns. Use Ably if you hit Pusher's 200 concurrent connection limit or need message history. |
| Pusher Channels | **Supabase Realtime** | Supabase Realtime (Broadcast + Presence) is a strong alternative if you're already using Supabase Postgres for persistence. For this app (ephemeral sessions, Redis storage, no need for DB-backed rows), pulling in the full Supabase client for realtime alone is unnecessary weight. |
| Pusher Channels | **PartyKit** (0.0.115) | PartyKit (Durable Objects on Cloudflare Workers) is the most elegant solution for multiplayer apps — each room IS a live server process. However, it runs on Cloudflare, not Vercel, requires deploying a separate PartyKit server, and is still pre-1.0. Excellent choice if you move off Vercel or want the cleanest architecture; not right for Vercel-only constraint. |
| Pusher Channels | **Liveblocks** (3.15.3) | Liveblocks is the premium option — excellent presence, CRDT storage, React hooks. Overkill for planning poker (no conflict resolution needed), and its free tier is more restrictive for concurrent users. Use if you need collaborative document editing features. |
| Pusher Channels | **Vercel KV + polling** | Polling is simple but creates noticeable lag (typically 1–3s) on vote reveal, which defeats the "all cards flip simultaneously" requirement. Not recommended. |

### Storage

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @upstash/redis | **Vercel KV** (@vercel/kv 3.0.0) | Vercel KV is Upstash Redis with a Vercel-branded SDK. Use it if you want tighter Vercel integration and don't mind the vendor lock-in. The @upstash/redis client works identically and is more portable. |
| @upstash/redis | **In-memory (Map in module scope)** | Works only for development/single-instance. Vercel's serverless functions can spin up multiple instances; a module-level Map is not shared across them. Do not use for production. |

### Framework

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 App Router | **Next.js 14/15 Pages Router** | Pages Router is stable and well-documented. Use it only if your team is already deeply familiar with it — App Router is the forward-looking default for Vercel deployments. |
| Next.js 16 App Router | **Remix / React Router v7** | Strong for data loading patterns, but Vercel's native optimizations (ISR, Edge Runtime) are built for Next.js. Not wrong, just unnecessary friction. |
| Next.js 16 App Router | **SvelteKit** | Excellent choice if the team knows Svelte. Pusher/Upstash work identically. Not recommended here because the ecosystem assumption is React/TypeScript. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Native WebSocket server (e.g., `ws` package in a Next.js Custom Server) | Requires `next start` with a custom server, which means you CANNOT deploy to Vercel. Vercel does not support persistent Node.js processes. | Pusher Channels (or Ably/Supabase Realtime) |
| Socket.io | Same problem as above — requires a persistent Node.js process. Socket.io is not serverless-compatible. Long-polling fallback still requires a persistent connection pool. | Pusher Channels |
| Vercel Edge Runtime for game API routes | Edge Runtime doesn't support Node.js crypto APIs, has a 25MB bundle limit, and Upstash Redis HTTP client behaves differently at edge. Keep game Route Handlers in Node.js runtime. | Standard Node.js Runtime Route Handlers |
| Database (Postgres/SQLite) for session state | Sessions are ephemeral (no long-term storage needed), small (5–12 participants, one current story), and need sub-100ms reads. A relational DB adds migration complexity with no benefit. | Redis (Upstash) for volatile session state |
| Redux / Redux Toolkit | Massive boilerplate for a small state graph. The session state arrives from Pusher events — you need a simple reactive store, not a reducer-action-selector pipeline. | zustand |
| React Query / TanStack Query | Useful for server state synchronization via HTTP. But game state arrives via WebSocket push, not HTTP polling. TanStack Query adds complexity without value here. | Pusher events + zustand |
| JWT for host authentication | No login system exists. JWTs require a signing secret and token verification middleware. A simple signed session cookie (set at room creation) is sufficient. | cookies-next with a room-scoped host token |

---

## Stack Patterns by Variant

**If the team prefers an all-in-one SaaS backend:**
- Replace Pusher + Upstash with Supabase (Realtime Broadcast + Presence + Postgres)
- Because Supabase handles real-time, storage, and optionally auth in one dashboard
- Trade-off: Supabase free tier has more constraints on concurrent connections than Pusher

**If Vercel constraint is relaxed (e.g., Railway, Fly.io, Render):**
- Use PartyKit for the real-time layer — each room gets a Durable Object, state lives in the actor, no external Redis needed
- PartyKit's model is the cleanest for game-room-style apps; it's just not Vercel-compatible

**If the app needs to scale beyond a single team (multi-tenant SaaS):**
- Add Clerk for authentication (name-only identity won't suffice)
- Upgrade Upstash to a paid plan or switch to PlanetScale/Turso for persistent session logs
- Move Pusher to a private cluster (Pusher Business tier)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| next@16.2.0 | react@^19.0.0 | Next.js 16 requires React 19; do not mix with React 18 |
| tailwindcss@4.2.2 | postcss@^8 | Tailwind v4 uses a new CSS-first config; no `tailwind.config.js` needed |
| pusher-js@8.4.2 | All modern browsers + React 19 | No known conflicts |
| @upstash/redis@1.37.0 | Node.js 18+ | Works in Next.js App Router Route Handlers (Node runtime) |
| zustand@5.0.12 | react@^19.0.0 | zustand v5 is React 19 compatible |
| zod@4.3.6 | TypeScript 5.x | zod v4 requires TS 5.0+ |
| nanoid@5.1.7 | ESM only | Next.js App Router handles ESM natively; no transpilation needed |
| cookies-next@6.1.1 | next@16.x | Works in both App Router Server Components and Route Handlers |

---

## Sources

- npm registry (live) — version numbers for all packages above: HIGH confidence
- Training data (Aug 2025 cutoff) — rationale for Vercel/WebSocket constraints, Pusher presence channel patterns, Redis-as-session-store pattern: MEDIUM confidence
- Pusher free tier limits (200 concurrent, 200k msgs/day) — training data: MEDIUM confidence, verify at https://pusher.com/channels/pricing before committing
- Upstash free tier (10k commands/day) — training data: MEDIUM confidence, verify at https://upstash.com/pricing
- Next.js 16 App Router patterns — training data: MEDIUM confidence (Next.js 16 released after Aug 2025 cutoff; peer dependency data from npm confirms React 19 compatibility)
- PartyKit Cloudflare-only constraint — confirmed via package metadata (depends on `@cloudflare/workers-types`, `miniflare`): HIGH confidence

---

*Stack research for: Real-time Planning Poker — Vercel deployment*
*Researched: 2026-03-18*
