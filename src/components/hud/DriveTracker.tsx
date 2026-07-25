import { FIELD_LENGTH_YARDS, type GameState } from '../../domain/gameState'
import type { Team } from '../../domain/team'

function yardLineLabel(state: GameState): string {
  const midfield = FIELD_LENGTH_YARDS / 2
  if (state.possession === 'home') {
    return state.ballOn <= midfield ? `OWN ${Math.round(state.ballOn)}` : `OPP ${Math.round(FIELD_LENGTH_YARDS - state.ballOn)}`
  }
  return state.ballOn >= midfield ? `OWN ${Math.round(FIELD_LENGTH_YARDS - state.ballOn)}` : `OPP ${Math.round(state.ballOn)}`
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return '4th'
}

export function DriveTracker({ gameState, homeTeam, awayTeam }: { gameState: GameState; homeTeam: Team; awayTeam: Team }) {
  const possessingTeam = gameState.possession === 'home' ? homeTeam : awayTeam
  return (
    <div className="flex flex-col gap-1 rounded-md border border-white/10 bg-slate-900/60 px-4 py-2 text-sm">
      <div className="text-slate-300">
        <span className="font-semibold text-slate-100">{possessingTeam.abbreviation} ball</span> — {ordinal(gameState.down)} & {gameState.distance} at{' '}
        {yardLineLabel(gameState)}
      </div>
      {gameState.lastPlaySummary && <div className="text-slate-400">{gameState.lastPlaySummary}</div>}
    </div>
  )
}
