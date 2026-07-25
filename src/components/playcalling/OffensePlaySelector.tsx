import { OFFENSE_PLAYBOOK } from '../../engine/playbook/offensePlays'
import type { OffensePlay } from '../../engine/playbook/types'

export function OffensePlaySelector({ onSelect }: { onSelect: (play: OffensePlay) => void }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-300">Call your offensive play</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OFFENSE_PLAYBOOK.map((play) => (
          <button
            key={play.id}
            onClick={() => onSelect(play)}
            className="rounded-md border border-blue-500/40 bg-blue-950/60 px-3 py-2 text-left transition hover:border-blue-400 hover:bg-blue-900"
          >
            <div className="text-sm font-semibold text-blue-100">{play.name}</div>
            <div className="text-xs text-blue-300/70">{play.formation}</div>
            <div className="mt-1 text-xs text-blue-200/60">{play.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
