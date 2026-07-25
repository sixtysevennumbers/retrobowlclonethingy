import type { PlayOutcome, PlaySituation } from '../engine/outcome/types'
import { clamp, randInt, type Rng } from '../engine/rng'

export type Quarter = 1 | 2 | 3 | 4
export type Side = 'home' | 'away'

export const QUARTER_LENGTH_SEC = 15 * 60
export const FIELD_LENGTH_YARDS = 100

/**
 * `ballOn` is absolute field position, 0 = home's own goal line, 100 = away's
 * own goal line. Home always drives toward 100, away always drives toward 0 —
 * this sim doesn't swap ends at halftime, it's purely a rendering axis.
 */
export interface GameState {
  quarter: Quarter
  clockSec: number
  possession: Side
  down: 1 | 2 | 3 | 4
  distance: number
  ballOn: number
  score: Record<Side, number>
  driveStartYard: number
  gameOver: boolean
  lastPlaySummary: string | null
}

export function otherSide(side: Side): Side {
  return side === 'home' ? 'away' : 'home'
}

/** Direction of travel (+1 or -1 along the ballOn axis) for the possessing team. */
export function offenseDirection(possession: Side): 1 | -1 {
  return possession === 'home' ? 1 : -1
}

/** Yards remaining until the possessing team's own goal line (used for safeties). */
export function ownGoalDistance(state: GameState): number {
  return state.possession === 'home' ? state.ballOn : FIELD_LENGTH_YARDS - state.ballOn
}

/** Yards remaining until the possessing team's opponent's goal line (used for TDs). */
export function opponentGoalDistance(state: GameState): number {
  return state.possession === 'home' ? FIELD_LENGTH_YARDS - state.ballOn : state.ballOn
}

export function toPlaySituation(state: GameState): PlaySituation {
  return {
    down: state.down,
    distance: state.distance,
    ownGoalDistance: ownGoalDistance(state),
    opponentGoalDistance: opponentGoalDistance(state),
  }
}

export function createInitialGameState(receivingTeam: Side): GameState {
  const startYard = receivingTeam === 'home' ? 25 : 75
  return {
    quarter: 1,
    clockSec: QUARTER_LENGTH_SEC,
    possession: receivingTeam,
    down: 1,
    distance: 10,
    ballOn: startYard,
    score: { home: 0, away: 0 },
    driveStartYard: startYard,
    gameOver: false,
    lastPlaySummary: null,
  }
}

function startNewDrive(state: GameState, possession: Side, ballOn: number): GameState {
  const clamped = Math.max(1, Math.min(FIELD_LENGTH_YARDS - 1, ballOn))
  return {
    ...state,
    possession,
    down: 1,
    distance: 10,
    ballOn: clamped,
    driveStartYard: clamped,
  }
}

function advanceClock(state: GameState, elapsedSec: number): GameState {
  let clockSec = state.clockSec - elapsedSec
  let quarter = state.quarter
  let gameOver = state.gameOver

  while (clockSec <= 0 && !gameOver) {
    if (quarter >= 4) {
      gameOver = true
      clockSec = 0
    } else {
      quarter = (quarter + 1) as Quarter
      clockSec += QUARTER_LENGTH_SEC
    }
  }

  return { ...state, clockSec, quarter, gameOver }
}

/**
 * Applies a resolved PlayOutcome to the game state: moves the ball, handles
 * downs/turnovers/scoring, and advances the clock. Pure function — no
 * physics/animation concerns here, those consume the same PlayOutcome
 * separately to drive the canvas.
 */
export function applyPlayOutcome(state: GameState, outcome: PlayOutcome): GameState {
  const dir = offenseDirection(state.possession)
  let next = advanceClock(state, outcome.timeElapsedSec)
  if (next.gameOver) return next

  if (outcome.type === 'touchdown') {
    next = {
      ...next,
      score: { ...next.score, [next.possession]: next.score[next.possession] + 7 },
      lastPlaySummary: describeOutcome(outcome),
    }
    return startNewDrive(next, otherSide(next.possession), next.possession === 'home' ? 25 : 75)
  }

  if (outcome.type === 'interception' || outcome.type === 'fumble') {
    const newBallOn = clampField(next.ballOn + outcome.yards * dir)
    return startNewDrive({ ...next, lastPlaySummary: describeOutcome(outcome) }, otherSide(next.possession), newBallOn)
  }

  if (outcome.type === 'sack' || outcome.type === 'run' || outcome.type === 'pass') {
    const newBallOn = clampField(next.ballOn + outcome.yards * dir)

    // Safety: offense tackled behind their own goal line.
    if ((next.possession === 'home' && newBallOn <= 0) || (next.possession === 'away' && newBallOn >= FIELD_LENGTH_YARDS)) {
      next = {
        ...next,
        score: { ...next.score, [otherSide(next.possession)]: next.score[otherSide(next.possession)] + 2 },
        lastPlaySummary: 'SAFETY!',
      }
      return startNewDrive(next, otherSide(next.possession), next.possession === 'home' ? 20 : 80)
    }

    const gainedYards = Math.abs(newBallOn - next.ballOn)
    const distance = next.distance - gainedYards
    next = {
      ...next,
      ballOn: newBallOn,
      lastPlaySummary: describeOutcome(outcome),
    }

    if (distance <= 0) {
      return { ...next, down: 1, distance: 10 }
    }

    if (next.down >= 4) {
      // Turnover on downs.
      return startNewDrive({ ...next, lastPlaySummary: `${next.lastPlaySummary} — turnover on downs` }, otherSide(next.possession), newBallOn)
    }

    return { ...next, down: (next.down + 1) as GameState['down'], distance }
  }

  // incomplete pass / penalty: no yardage change.
  next = { ...next, lastPlaySummary: describeOutcome(outcome) }
  if (next.down >= 4) {
    return startNewDrive({ ...next, lastPlaySummary: `${next.lastPlaySummary} — turnover on downs` }, otherSide(next.possession), next.ballOn)
  }
  return { ...next, down: (next.down + 1) as GameState['down'] }
}

function clampField(yard: number): number {
  return Math.max(0, Math.min(FIELD_LENGTH_YARDS, yard))
}

export function applyPunt(state: GameState, rng: Rng): GameState {
  const dir = offenseDirection(state.possession)
  const puntDistance = randInt(rng, 32, 48)
  const newBallOn = clampField(state.ballOn + puntDistance * dir)
  let next = advanceClock(state, randInt(rng, 12, 20))
  if (next.gameOver) return next
  return startNewDrive({ ...next, lastPlaySummary: 'Punt' }, otherSide(next.possession), newBallOn)
}

/** Standard-ish yardage-to-make-probability curve for a kick from `opponentGoalDistance` yards out. */
export function resolveFieldGoal(rng: Rng, opponentGoalDistance: number): boolean {
  const kickDistance = opponentGoalDistance + 17 // + snap depth + end zone depth
  const successProb = clamp(0.98 - kickDistance * 0.011, 0.15, 0.98)
  return rng() < successProb
}

export function applyFieldGoalAttempt(state: GameState, made: boolean, rng: Rng): GameState {
  let next = advanceClock(state, randInt(rng, 5, 10))
  if (next.gameOver) return next
  if (made) {
    next = {
      ...next,
      score: { ...next.score, [next.possession]: next.score[next.possession] + 3 },
      lastPlaySummary: 'FIELD GOAL IS GOOD!',
    }
    return startNewDrive(next, otherSide(next.possession), next.possession === 'home' ? 25 : 75)
  }
  return startNewDrive({ ...next, lastPlaySummary: 'Field goal attempt is NO GOOD.' }, otherSide(next.possession), next.ballOn)
}

export function describeOutcome(outcome: PlayOutcome): string {
  switch (outcome.type) {
    case 'run':
      return `Run for ${outcome.yards} yard${outcome.yards === 1 ? '' : 's'}`
    case 'pass':
      return `Pass complete for ${outcome.yards} yard${outcome.yards === 1 ? '' : 's'}`
    case 'incomplete':
      return 'Incomplete pass'
    case 'sack':
      return `Sacked for ${Math.abs(outcome.yards)} yard loss`
    case 'penalty':
      return 'Penalty'
    case 'touchdown':
      return `TOUCHDOWN! ${outcome.yards} yard score`
    case 'interception':
      return 'INTERCEPTED!'
    case 'fumble':
      return 'FUMBLE, recovered by defense!'
  }
}
