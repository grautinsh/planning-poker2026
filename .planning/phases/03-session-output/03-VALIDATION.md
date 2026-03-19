---
phase: 3
slug: session-output
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/api/reset.test.ts tests/api/next-story.test.ts tests/lib/stats.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/reset.test.ts tests/api/next-story.test.ts tests/lib/stats.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-W0-01 | W0 | 0 | POST-02 | unit stub | `npx vitest run tests/lib/stats.test.ts` | ❌ W0 | ⬜ pending |
| 3-W0-02 | W0 | 0 | POST-03 | unit stub | `npx vitest run tests/api/reset.test.ts` | ❌ W0 | ⬜ pending |
| 3-W0-03 | W0 | 0 | LOG-01 | unit stub | `npx vitest run tests/api/next-story.test.ts` | ❌ W0 | ⬜ pending |
| 3-W0-04 | W0 | 0 | LOG-03 | unit stub | `npx vitest run tests/lib/clipboard.test.ts` | ❌ W0 | ⬜ pending |
| 3-W0-05 | W0 | 0 | LOG-02 | unit extension | `npx vitest run tests/api/rooms.test.ts` | ✅ partial | ⬜ pending |
| 3-01-01 | 01 | 1 | POST-02, POST-03 | unit | `npx vitest run tests/lib/stats.test.ts tests/api/reset.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | LOG-01, LOG-02 | unit | `npx vitest run tests/api/next-story.test.ts tests/api/rooms.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | LOG-03 | unit | `npx vitest run tests/lib/clipboard.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | POST-01, POST-02 | manual | See manual verification table | N/A | ⬜ pending |
| 3-04-01 | 04 | 2 | POST-03, LOG-01 | manual | See manual verification table | N/A | ⬜ pending |
| 3-05-01 | 05 | 2 | LOG-02, LOG-03 | manual | See manual verification table | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/stats.test.ts` — stubs for POST-02 (numeric filtering, avg precision, consensus detection, all-non-numeric skip)
- [ ] `tests/api/reset.test.ts` — stubs for POST-03 (host-only, atomic multi, Pusher broadcast, 403/404/409 guards)
- [ ] `tests/api/next-story.test.ts` — stubs for LOG-01 (rpush, multi reset, Pusher, empty story guard)
- [ ] `tests/lib/clipboard.test.ts` — stubs for LOG-03 (markdown table format, empty log, special characters in story titles)
- [ ] `tests/api/rooms.test.ts` — extend existing file to assert `log` field present in GET response (empty array when no entries)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vote stats row renders above VoteCard grid | POST-02 | UI layout — no DOM testing setup | Open revealed room; verify min/max/avg (or consensus) appears above flipped cards |
| Consensus badge shown in green when all votes match | POST-02 | Visual style — no DOM testing setup | Vote same value from 2+ voter tabs; reveal; verify green `✓ Consensus: X` replaces stats row |
| Reset Round clears cards and returns to voting phase | POST-03 | UI state transition — multi-tab scenario | Host clicks Reset Round; verify VoteCard grid disappears, CardDeck reappears for voters |
| Next Story inline estimate entry in HostControls | LOG-01 | UI component state — no DOM testing | Click Next Story →; verify input + Confirm + Cancel appear in-panel (no modal) |
| Session log appears at page bottom from load | LOG-02 | Full page render — needs browser | Load room page; verify "No stories logged yet" empty state at bottom |
| Session log updates in real time via Pusher | LOG-02 | Real-time multi-client — needs Pusher | Complete a next-story action; verify log entry appears without page refresh on all connected tabs |
| Clipboard copy produces correct markdown table | LOG-03 | Clipboard API — needs browser context | Click copy; paste into text editor; verify markdown table format with correct columns |
| Copy button text briefly shows `✓ Copied!` | LOG-03 | Timer-based UI state — visual | Click copy button; verify label switches then reverts after ~2 seconds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
