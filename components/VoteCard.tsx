'use client'

interface VoteCardProps {
  value: string
  revealed: boolean
  index: number
  participantName?: string
}

export function VoteCard({ value, revealed, index, participantName }: VoteCardProps) {
  return (
    <div className="relative w-14 h-20 perspective-[600px]">
      <div
        className={[
          'relative w-full h-full transform-3d transition-transform duration-500 ease-out motion-reduce:transition-none',
          revealed ? 'rotate-y-180' : '',
        ].join(' ')}
        style={{ transitionDelay: revealed ? `${index * 75}ms` : '0ms' }}
      >
        {/* Front face — card back (face-down during voting) */}
        <div className="absolute inset-0 backface-hidden rounded-lg bg-slate-700 flex items-center justify-center">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          </div>
        </div>

        {/* Back face — card value (visible after reveal) */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-lg bg-white border border-slate-200 flex flex-col items-center justify-center gap-1">
          <span className="text-2xl font-bold text-slate-800">{value}</span>
          {participantName && (
            <span className="text-xs text-slate-500 truncate max-w-12 text-center">
              {participantName}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
