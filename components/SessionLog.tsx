'use client'

import { useState, useCallback } from 'react'
import type { LogEntry } from '@/types/room'
import { buildMarkdownTable } from '@/lib/clipboard'

interface SessionLogProps {
  log: LogEntry[]
}

export function SessionLog({ log }: SessionLogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const text = buildMarkdownTable(log)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [log])

  return (
    <section aria-label="Session log" className="mt-8 border-t border-slate-100 pt-6">
      {/* Section header with title and copy button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs text-slate-500 uppercase tracking-wide font-medium">
          Session Log
        </h2>
        <button
          type="button"
          onClick={handleCopy}
          disabled={log.length === 0}
          className="text-sm text-slate-500 hover:text-slate-700 px-2 py-1 rounded transition-colors disabled:opacity-[0.38] disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Copy session log as markdown"
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>

      {/* Content area */}
      {log.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">
          No stories logged yet
        </p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {log.map((entry, i) => (
            <li key={i} className="flex justify-between items-baseline py-2">
              <span className="text-sm text-slate-700">{entry.story}</span>
              <span className="text-sm font-semibold text-indigo-600 ml-4 shrink-0">
                {entry.estimate}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
