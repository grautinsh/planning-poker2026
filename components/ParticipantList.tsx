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
      <span className="font-medium">
        {participant.name}
        {isMe && <span className="ml-1 text-xs text-blue-500">(you)</span>}
      </span>
      {participant.role === 'observer' && (
        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">observer</span>
      )}
      <span className="ml-auto text-sm">
        {participant.hasVoted ? (
          <span className="text-green-600 font-medium">Voted</span>
        ) : (
          <span className="text-gray-400">Waiting</span>
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
