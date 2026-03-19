import type { ParticipantView } from '@/types/room'

interface ParticipantListProps {
  participants: ParticipantView[]
  myParticipantId: string | null
}

// ParticipantItem extracted at module level — not defined inside ParticipantList
// Rule: defining a component inside another creates a new type each render, remounting it
function ParticipantItem({
  participant,
  isMe,
}: {
  participant: ParticipantView
  isMe: boolean
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
      <span className="font-medium text-gray-900">
        {participant.name}
        {isMe && <span className="ml-1 text-xs text-blue-500">(you)</span>}
      </span>
      {participant.role === 'observer' && (
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">observer</span>
      )}
      <span className="ml-auto text-sm">
        {participant.hasVoted ? (
          <span className="flex items-center gap-1 text-indigo-500" aria-label="Has voted">
            {/* Card back icon — inline SVG of a face-down playing card */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="2" width="18" height="20" rx="2" ry="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
            <span className="text-xs font-medium">Voted</span>
          </span>
        ) : (
          <span className="text-slate-400 text-sm">Waiting</span>
        )}
      </span>
    </li>
  )
}

export function ParticipantList({ participants, myParticipantId }: ParticipantListProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">
        Participants ({participants.length})
      </h2>
      {participants.length === 0 ? (
        <p className="text-gray-400 text-sm">No participants yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {participants.map(p => (
            <ParticipantItem
              key={p.participantId}
              participant={p}
              isMe={p.participantId === myParticipantId}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
