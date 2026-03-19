---
phase: 4
slug: reconnection-and-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/api/join.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/join.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | IDNT-04 | unit | `npx vitest run tests/api/join.test.ts` | ✅ extend | ⬜ pending |
| 4-01-02 | 01 | 1 | IDNT-04 | unit | `npx vitest run tests/api/join.test.ts` | ✅ extend | ⬜ pending |
| 4-01-03 | 01 | 1 | IDNT-04 | unit | `npx vitest run tests/api/join.test.ts` | ✅ extend | ⬜ pending |
| 4-02-01 | 02 | 2 | IDNT-04 | manual | Visual browser test | N/A | ⬜ pending |
| 4-02-02 | 02 | 2 | IDNT-04 | unit | `npx vitest run` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files required — new test cases are additions to `tests/api/join.test.ts` (already exists).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Connection indicator shows when Pusher state is `unavailable` | IDNT-04 | Requires real Pusher disconnect; cannot be simulated in unit tests | 1. Open room. 2. Disable network in DevTools. 3. Verify "Reconnecting..." banner appears. 4. Re-enable network. 5. Verify banner disappears. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
