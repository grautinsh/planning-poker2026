---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest) |
| **Config file** | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| **Quick run command** | `npx vitest run tests/lib/room.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/room.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | SESS-01 | unit | `npx vitest run tests/lib/room.test.ts -t "createRoom"` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | SESS-01 | unit | `npx vitest run tests/lib/room.test.ts -t "redis schema"` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | SESS-02 | unit | `npx vitest run tests/api/rooms.test.ts -t "host token cookie"` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 0 | SESS-02 | unit | `npx vitest run tests/lib/auth.test.ts -t "token roundtrip"` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 0 | SESS-03 | unit | `npx vitest run tests/lib/room.test.ts -t "TTL"` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 0 | IDNT-01 | unit | `npx vitest run tests/api/join.test.ts -t "join"` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 0 | IDNT-02 | unit | `npx vitest run tests/lib/room.test.ts -t "participantId"` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 0 | IDNT-02 | unit | `npx vitest run tests/lib/room.test.ts -t "toRoomView redacted"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration with path aliases matching tsconfig
- [ ] `tests/lib/room.test.ts` — stubs for SESS-01, SESS-03, IDNT-02 (room model, TTL, serialization filter)
- [ ] `tests/lib/auth.test.ts` — stubs for SESS-02 (token hash/validate roundtrip)
- [ ] `tests/api/rooms.test.ts` — stubs for SESS-01, SESS-02 (route handler integration with mocked Redis/Pusher)
- [ ] `tests/api/join.test.ts` — stubs for IDNT-01, IDNT-02 (join route with mocked Redis)
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8` — if not already installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shareable URL opens in a new browser tab and shows the join page | SESS-01 | Requires live browser navigation | Open created URL in incognito tab, verify join form loads |
| Host cookie persists after full page reload | SESS-02 | Requires live browser | Create room, reload, verify host controls still visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
