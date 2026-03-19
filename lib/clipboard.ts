import type { LogEntry } from '@/types/room'

export function buildMarkdownTable(log: LogEntry[]): string {
  const header = '| Story | Points |\n|-------|--------|'
  if (log.length === 0) return header
  const rows = log.map(e => `| ${e.story} | ${e.estimate} |`).join('\n')
  return `${header}\n${rows}`
}
