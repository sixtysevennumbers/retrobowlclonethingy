import { DEFENSE_PLAYBOOK } from '../../engine/playbook/defensePlays'
import type { DefensePlay } from '../../engine/playbook/types'

interface DefensePlaySelectorProps {
  onSelect: (play: DefensePlay) => void
  customPlays: DefensePlay[]
  onDrawPlay: () => void
}

export function DefensePlaySelector({ onSelect, customPlays, onDrawPlay }: DefensePlaySelectorProps) {
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
        {customPlays.map((play) => (
          <button
            key={play.id}
            onClick={() => onSelect(play)}
            className="rounded-md border border-yellow-500/40 bg-yellow-950/30 px-3 py-2 text-left transition hover:border-yellow-400 hover:bg-yellow-900/40"
          >
            <div className="text-sm font-semibold text-yellow-100">{play.name}</div>
            <div className="text-xs text-yellow-300/70">Your Play</div>
            <div className="mt-1 text-xs text-yellow-200/60">{play.description}</div>
          </button>
        ))}
        <button
          onClick={onDrawPlay}
          className="rounded-md border border-dashed border-white/25 bg-slate-800/40 px-3 py-2 text-left text-slate-300 transition hover:border-white/40 hover:bg-slate-800"
        >
          <div className="text-sm font-semibold">+ Draw a Play</div>
          <div className="mt-1 text-xs text-slate-400">Design your own scheme</div>
        </button>
      </div>
    </div>
  )
}
