import type { GameState } from '../../domain/gameState'
import type { Team } from '../../domain/team'

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Scoreboard({ gameState, homeTeam, awayTeam }: { gameState: GameState; homeTeam: Team; awayTeam: Team }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-slate-900/80 px-4 py-3">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide text-slate-400">{awayTeam.abbreviation}</div>
        <div className="text-2xl font-bold">{gameState.score.away}</div>
      </div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide text-slate-400">Q{gameState.quarter}</div>
        <div className="font-mono text-lg">{formatClock(gameState.clockSec)}</div>
      </div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide text-slate-400">{homeTeam.abbreviation}</div>
        <div className="text-2xl font-bold">{gameState.score.home}</div>
      </div>
    </div>
  )
}
