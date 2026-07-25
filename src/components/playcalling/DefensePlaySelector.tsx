import { DEFENSE_PLAYBOOK } from '../../engine/playbook/defensePlays'
import type { DefensePlay } from '../../engine/playbook/types'

export function DefensePlaySelector({ onSelect }: { onSelect: (play: DefensePlay) => void }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-300">Call your defensive play</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DEFENSE_PLAYBOOK.map((play) => (
          <button
            key={play.id}
            onClick={() => onSelect(play)}
            className="rounded-md border border-red-500/40 bg-red-950/60 px-3 py-2 text-left transition hover:border-red-400 hover:bg-red-900"
          >
            <div className="text-sm font-semibold text-red-100">{play.name}</div>
            <div className="mt-1 text-xs text-red-200/60">{play.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
