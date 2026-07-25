import { create } from 'zustand'
import { generateTeam } from '../data/rosterGenerator'
import { TEAM_NAMES } from '../data/names'
import {
  applyFieldGoalAttempt,
  applyPlayOutcome,
  applyPunt,
  createInitialGameState,
  resolveFieldGoal,
  toPlaySituation,
  type GameState,
  type Side,
} from '../domain/gameState'
import type { Team } from '../domain/team'
import { pickAiDefensePlay, pickAiFourthDownDecision, pickAiOffensePlay } from '../engine/ai/playCaller'
import { buildOffenseActors } from '../engine/physics/formations'
import { simulatePlay, type PlayFrame } from '../engine/physics/playDirector'
import type { DefensePlay, OffensePlay } from '../engine/playbook/types'
import { resolvePlay } from '../engine/outcome/resolvePlay'
import type { PlayOutcome } from '../engine/outcome/types'
import { mulberry32, randInt, type Rng } from '../engine/rng'
import {
  loadCustomDefensePlays,
  loadCustomOffensePlays,
  saveCustomDefensePlays,
  saveCustomOffensePlays,
} from './customPlaysStorage'

export type GamePhase = 'pre_snap' | 'animating' | 'result' | 'final'

interface GameStoreState {
  homeTeam: Team
  awayTeam: Team
  userSide: Side
  gameState: GameState
  phase: GamePhase
  frames: PlayFrame[]
  lastOutcome: PlayOutcome | null
  lastOffensePlay: OffensePlay | null
  lastDefensePlay: DefensePlay | null
  customOffensePlays: OffensePlay[]
  customDefensePlays: DefensePlay[]
  callUserPlay: (play: OffensePlay | DefensePlay) => void
  callPunt: () => void
  callFieldGoal: () => void
  finishAnimation: () => void
  continueToNextPlay: () => void
  resetGame: () => void
  saveCustomOffensePlay: (play: OffensePlay) => void
  saveCustomDefensePlay: (play: DefensePlay) => void
}

let rng: Rng = mulberry32(Date.now() & 0xffffffff)

function freshTeams(): { home: Team; away: Team } {
  const shuffled = [...TEAM_NAMES].sort(() => rng() - 0.5)
  const [homeInfo, awayInfo] = shuffled
  // The user always starts on 'home' with a deliberately weak roster — winning has
  // to come from scheme (custom-drawn plays), not from having better players.
  return {
    home: generateTeam(rng, 'home', homeInfo.name, homeInfo.abbreviation, randInt(rng, 25, 42)),
    away: generateTeam(rng, 'away', awayInfo.name, awayInfo.abbreviation, randInt(rng, 55, 78)),
  }
}

function initialSnapshot() {
  const { home, away } = freshTeams()
  return {
    homeTeam: home,
    awayTeam: away,
    userSide: 'home' as Side,
    gameState: createInitialGameState('home'),
    phase: 'pre_snap' as GamePhase,
    frames: [] as PlayFrame[],
    lastOutcome: null as PlayOutcome | null,
    lastOffensePlay: null as OffensePlay | null,
    lastDefensePlay: null as DefensePlay | null,
  }
}

/**
 * When it's the AI's offense on 4th down and it decides to punt or kick
 * rather than go for it, there's no defensive play for the user to call —
 * resolve it immediately so the pre-snap screen never asks for input that
 * doesn't apply.
 */
function autoResolveAiSpecialTeams(state: GameState, userSide: Side): GameState {
  if (state.gameOver || state.down !== 4 || state.possession === userSide) return state
  const situation = toPlaySituation(state)
  const decision = pickAiFourthDownDecision(situation)
  if (decision === 'go') return state
  if (decision === 'punt') return applyPunt(state, rng)
  const made = resolveFieldGoal(rng, situation.opponentGoalDistance)
  return applyFieldGoalAttempt(state, made, rng)
}

/** Resolves a custom pass play's drawn target slot (e.g. 'WR:1') to the actual roster player id. */
function resolvePreferredTargetId(offenseTeam: Team, offensePlay: OffensePlay): string | undefined {
  if (offensePlay.custom?.kind !== 'pass' || !offensePlay.custom.targetSlot) return undefined
  const actor = buildOffenseActors(offenseTeam).find((a) => a.slotKey === offensePlay.custom!.targetSlot)
  return actor?.id
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...initialSnapshot(),
  customOffensePlays: loadCustomOffensePlays(),
  customDefensePlays: loadCustomDefensePlays(),

  callUserPlay: (play) => {
    const { gameState, userSide, homeTeam, awayTeam } = get()
    const situation = toPlaySituation(gameState)
    const teamFor = (side: Side): Team => (side === 'home' ? homeTeam : awayTeam)
    const otherOf = (side: Side): Side => (side === 'home' ? 'away' : 'home')

    const userIsOnOffense = gameState.possession === userSide
    const offensePlay = userIsOnOffense ? (play as OffensePlay) : pickAiOffensePlay(rng, situation)
    const defensePlay = userIsOnOffense ? pickAiDefensePlay(rng, situation) : (play as DefensePlay)

    const offenseTeam = teamFor(gameState.possession)
    const defenseTeam = teamFor(otherOf(gameState.possession))

    const preferredTargetId = resolvePreferredTargetId(offenseTeam, offensePlay)
    const outcome = resolvePlay(rng, offenseTeam, defenseTeam, offensePlay, defensePlay, situation, { preferredTargetId })
    const frames = simulatePlay({ outcome, offensePlay, defensePlay, offense: offenseTeam, defense: defenseTeam, rng })

    set({ phase: 'animating', frames, lastOutcome: outcome, lastOffensePlay: offensePlay, lastDefensePlay: defensePlay })
  },

  callPunt: () => {
    const { gameState, userSide } = get()
    const next = autoResolveAiSpecialTeams(applyPunt(gameState, rng), userSide)
    set({ gameState: next, phase: next.gameOver ? 'final' : 'pre_snap', frames: [], lastOutcome: null })
  },

  callFieldGoal: () => {
    const { gameState, userSide } = get()
    const situation = toPlaySituation(gameState)
    const made = resolveFieldGoal(rng, situation.opponentGoalDistance)
    const next = autoResolveAiSpecialTeams(applyFieldGoalAttempt(gameState, made, rng), userSide)
    set({ gameState: next, phase: next.gameOver ? 'final' : 'pre_snap', frames: [], lastOutcome: null })
  },

  finishAnimation: () => set({ phase: 'result' }),

  continueToNextPlay: () => {
    const { gameState, lastOutcome, userSide } = get()
    if (!lastOutcome) return
    const next = autoResolveAiSpecialTeams(applyPlayOutcome(gameState, lastOutcome), userSide)
    set({ gameState: next, phase: next.gameOver ? 'final' : 'pre_snap', frames: [], lastOutcome: null })
  },

  resetGame: () => {
    rng = mulberry32(Date.now() & 0xffffffff)
    set(initialSnapshot())
  },

  saveCustomOffensePlay: (play) => {
    const updated = [...get().customOffensePlays, play]
    saveCustomOffensePlays(updated)
    set({ customOffensePlays: updated })
  },

  saveCustomDefensePlay: (play) => {
    const updated = [...get().customDefensePlays, play]
    saveCustomDefensePlays(updated)
    set({ customDefensePlays: updated })
  },
}))
