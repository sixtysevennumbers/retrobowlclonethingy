import { describeOutcome, opponentGoalDistance } from '../../domain/gameState'
import { DefensePlaySelector } from '../playcalling/DefensePlaySelector'
import { OffensePlaySelector } from '../playcalling/OffensePlaySelector'
import { Scoreboard } from '../hud/Scoreboard'
import { DriveTracker } from '../hud/DriveTracker'
import { FieldCanvas } from '../field/FieldCanvas'
import { useGameStore } from '../../state/useGameStore'

export function GameScreen() {
  const homeTeam = useGameStore((s) => s.homeTeam)
  const awayTeam = useGameStore((s) => s.awayTeam)
  const userSide = useGameStore((s) => s.userSide)
  const gameState = useGameStore((s) => s.gameState)
  const phase = useGameStore((s) => s.phase)
  const frames = useGameStore((s) => s.frames)
  const lastOutcome = useGameStore((s) => s.lastOutcome)
  const callUserPlay = useGameStore((s) => s.callUserPlay)
  const callPunt = useGameStore((s) => s.callPunt)
  const callFieldGoal = useGameStore((s) => s.callFieldGoal)
  const finishAnimation = useGameStore((s) => s.finishAnimation)
  const continueToNextPlay = useGameStore((s) => s.continueToNextPlay)
  const resetGame = useGameStore((s) => s.resetGame)

  const userIsOnOffense = gameState.possession === userSide
  const offenseTeam = gameState.possession === 'home' ? homeTeam : awayTeam
  const defenseTeam = gameState.possession === 'home' ? awayTeam : homeTeam

  if (phase === 'final') {
    const winner = gameState.score.home === gameState.score.away ? null : gameState.score.home > gameState.score.away ? homeTeam : awayTeam
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-2xl font-bold">Final Score</h2>
        <div className="text-lg">
          {awayTeam.abbreviation} {gameState.score.away} — {homeTeam.abbreviation} {gameState.score.home}
        </div>
        <div className="text-slate-400">{winner ? `${winner.name} win!` : 'Tie game.'}</div>
        <button onClick={resetGame} className="rounded-md bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500">
          Play Again
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Scoreboard gameState={gameState} homeTeam={homeTeam} awayTeam={awayTeam} />
      <div className="flex justify-center">
        <FieldCanvas frames={frames} offenseTeam={offenseTeam} defenseTeam={defenseTeam} playing={phase === 'animating'} onComplete={finishAnimation} />
      </div>
      <DriveTracker gameState={gameState} homeTeam={homeTeam} awayTeam={awayTeam} />

      {phase === 'pre_snap' && userIsOnOffense && gameState.down === 4 && (
        <div className="flex gap-2">
          <button onClick={callPunt} className="flex-1 rounded-md border border-white/15 bg-slate-800/80 px-3 py-2 font-semibold hover:bg-slate-700">
            Punt
          </button>
          <button
            onClick={callFieldGoal}
            className="flex-1 rounded-md border border-white/15 bg-slate-800/80 px-3 py-2 font-semibold hover:bg-slate-700"
          >
            Attempt Field Goal ({opponentGoalDistance(gameState) + 17} yd)
          </button>
        </div>
      )}

      {phase === 'pre_snap' &&
        (userIsOnOffense ? <OffensePlaySelector onSelect={callUserPlay} /> : <DefensePlaySelector onSelect={callUserPlay} />)}

      {phase === 'animating' && <div className="text-center text-sm text-slate-400">Play in motion…</div>}

      {phase === 'result' && lastOutcome && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-white/10 bg-slate-900/70 p-4">
          <div className="text-lg font-semibold">{describeOutcome(lastOutcome)}</div>
          <button onClick={continueToNextPlay} className="rounded-md bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500">
            Next Play
          </button>
        </div>
      )}
    </div>
  )
}
