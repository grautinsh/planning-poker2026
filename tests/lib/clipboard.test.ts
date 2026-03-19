import { describe, it, expect } from 'vitest'
import type { LogEntry } from '@/types/room'
import { buildMarkdownTable } from '@/lib/clipboard'

// lib/clipboard.ts is a stub — all tests fail red until Plan 02 provides real implementation.

describe('buildMarkdownTable', () => {
  it('returns just header rows when passed an empty array', () => {
    const result = buildMarkdownTable([])
    expect(result).toBe('| Story | Points |\n|-------|--------|')
  })

  it('returns markdown table with one data row for a single entry', () => {
    const entries: LogEntry[] = [{ story: 'Auth login', estimate: '5' }]
    const result = buildMarkdownTable(entries)
    expect(result).toBe('| Story | Points |\n|-------|--------|\n| Auth login | 5 |')
  })

  it('does not break table structure when story contains a pipe character', () => {
    const entries: LogEntry[] = [{ story: 'Login | Logout', estimate: '3' }]
    const result = buildMarkdownTable(entries)
    // The pipe in the story name must be escaped so the markdown table stays valid
    expect(result).not.toMatch(/^\| Login \| Logout \| 3 \|/)
    expect(result).toContain('| Points |')
  })

  it('produces exactly the right format: header + separator + data rows, no date or total lines', () => {
    const entries: LogEntry[] = [{ story: 'Story A', estimate: '8' }]
    const result = buildMarkdownTable(entries)
    const lines = result.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('| Story | Points |')
    expect(lines[1]).toBe('|-------|--------|')
    expect(lines[2]).toBe('| Story A | 8 |')
  })
})
