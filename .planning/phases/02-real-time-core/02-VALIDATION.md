---
phase: 2
slug: real-time-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/lib/room.test.ts tests/api/vote.test.ts tests/api/reveal.test.ts tests/api/story.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/room.test.ts tests/api/vote.test.ts tests/api/reveal.test.ts tests/api/story.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | Wave 0 | 0 | VOTE-01, VOTE-02, VOTE-05 | unit | `npx vitest run tests/api/vote.test.ts` | ❌ W0 | ⬜ pending |
| 2-W0-02 | Wave 0 | 0 | SESS-04 | unit | `npx vitest run tests/api/story.test.ts` | ❌ W0 | ⬜ pending |
| 2-W0-03 | Wave 0 | 0 | VOTE-04 | unit | `npx vitest run tests/api/reveal.test.ts` | ❌ W0 | ⬜ pending |
| SESS-04-a | API | 1 | SESS-04 | unit | `npx vitest run tests/api/story.test.ts` | ❌ W0 | ⬜ pending |
| SESS-04-b | API | 1 | SESS-04 (non-host 403) | unit | `npx vitest run tests/api/story.test.ts` | ❌ W0 | ⬜ pending |
| IDNT-03-a | API | 1 | IDNT-03 (observer join) | unit | `npx vitest run tests/api/join.test.ts` | ✅ extend | ⬜ pending |
| IDNT-03-b | Lib | 1 | IDNT-03 (observer in view) | unit | `npx vitest run tests/lib/room.test.ts` | ✅ extend | ⬜ pending |
| VOTE-01-a | API | 1 | VOTE-01 (valid value stored) | unit | `npx vitest run tests/api/vote.test.ts` | ❌ W0 | ⬜ pending |
| VOTE-01-b | API | 1 | VOTE-01 (invalid value 400) | unit | `npx vitest run tests/api/vote.test.ts` | ❌ W0 | ⬜ pending |
| VOTE-02 | Lib | 1 | VOTE-02 (vote redaction) | unit | `npx vitest run tests/lib/room.test.ts` | ✅ passes | ⬜ pending |
| VOTE-03 | Lib | 1 | VOTE-03 (hasVoted status) | unit | `npx vitest run tests/lib/room.test.ts` | ✅ passes | ⬜ pending |
| VOTE-04-a | API | 2 | VOTE-04 (reveal atomicity) | unit | `npx vitest run tests/api/reveal.test.ts` | ❌ W0 | ⬜ pending |
| VOTE-04-b | API | 2 | VOTE-04 (non-host 403) | unit | `npx vitest run tests/api/reveal.test.ts` | ❌ W0 | ⬜ pending |
| VOTE-05 | API | 2 | VOTE-05 (post-reveal vote 409) | unit | `npx vitest run tests/api/vote.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/vote.test.ts` — stubs for VOTE-01, VOTE-02, VOTE-05
- [ ] `tests/api/story.test.ts` — stubs for SESS-04
- [ ] `tests/api/reveal.test.ts` — stubs for VOTE-04

*`tests/lib/room.test.ts` and `tests/api/join.test.ts` exist and are extended in-plan for IDNT-03 and VOTE-03.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cards flip simultaneously on all connected clients | VOTE-04 | Multi-client real-time behavior; requires two browser tabs | Open room in 2 tabs, vote in one, host triggers reveal — verify both flip at the same time |
| Card back icon appears in participant list after voting | VOTE-03 | Visual/UI behavior | Vote on a card; verify participant list shows card back icon (not "Voted" text) |
| Observer sees all activity but no card deck | IDNT-03 | Role-gated UI; requires observer join flow | Join as observer; verify "Observer" badge present, no card deck rendered |
| CSS 3D flip stagger timing feels correct | VOTE-04 | Subjective UX; no automated check | Trigger reveal with 3+ voters; verify staggered flip at 50–100ms intervals |
| Reveal button disabled until ≥1 vote | VOTE-04 | UI state; no automated check | Load room as host; verify Reveal button is disabled; cast one vote; verify it enables |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
