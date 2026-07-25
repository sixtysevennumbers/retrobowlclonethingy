import { OFFENSE_PLAYBOOK } from '../../engine/playbook/offensePlays'
import type { OffensePlay } from '../../engine/playbook/types'

interface OffensePlaySelectorProps {
  onSelect: (play: OffensePlay) => void
  customPlays: OffensePlay[]
  onDrawPlay: () => void
}

export function OffensePlaySelector({ onSelect, customPlays, onDrawPlay }: OffensePlaySelectorProps) {
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
          <div className="mt-1 text-xs text-slate-400">Design your own route</div>
        </button>
      </div>
    </div>
  )
}
