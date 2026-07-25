import Matter from 'matter-js'
import type { Team } from '../../domain/team'
import type { DefensePlay, OffensePlay } from '../playbook/types'
import type { PlayOutcome } from '../outcome/types'
import type { Rng } from '../rng'
import { pick, randInt } from '../rng'
import { Actor, buildDefenseActors, buildOffenseActors } from './formations'
import { arrive, steerToward, type Vec2 } from './steering'
import { createPhysicsWorld, createPlayerBody, FIELD_WIDTH_YD } from './world'
import { setupCustomDefensePlay, setupCustomOffensePlay } from './customPlayDirector'
import {
  actorMaxAccel,
  actorMaxSpeed,
  applyBlockingTargets,
  applyDefaultSecondaryTargets,
  applyDefaultSkillPlayerTargets,
  applyPassRushTargets,
  applyRunPursuitTargets,
  frontSevenOf,
  olineOf,
  routeDepthFallback,
  secondaryOf,
  type TargetFn,
} from './playHelpers'

export interface PlayFrame {
  tSec: number
  players: Record<string, Vec2>
  ball: Vec2
  ballHolderId: string | null
  event?: string
}

export const DT = 1 / 30
const HALF_WIDTH = FIELD_WIDTH_YD / 2 - 0.6

function clampToField(v: Vec2): Vec2 {
  return { x: Math.max(-HALF_WIDTH, Math.min(HALF_WIDTH, v.x)), y: v.y }
}

/** Builds per-actor steering-target functions for a running play. */
function setupRunPlay(rng: Rng, offensePlay: OffensePlay, offense: Actor[], defense: Actor[], outcome: PlayOutcome): Map<string, TargetFn> {
  const targets = new Map<string, TargetFn>()
  const rb = offense.find((a) => a.position === 'RB')
  const qb = offense.find((a) => a.position === 'QB')
  const isOutside = offensePlay.type === 'run_outside'
  const dirSign = isOutside ? (rng() < 0.5 ? -1 : 1) : (randInt(rng, -1, 1) as -1 | 0 | 1)

  const finalTarget: Vec2 = {
    x: Math.max(-16, Math.min(16, dirSign * (isOutside ? 6 + Math.max(0, outcome.yards) * 0.35 : 1.5))),
    y: outcome.yards,
  }
  if (rb) targets.set(rb.id, () => finalTarget)
  if (qb) targets.set(qb.id, () => ({ x: qb.start.x, y: qb.start.y - 0.5 }))

  const frontSeven = frontSevenOf(defense)
  const blockablePool = offensePlay.type === 'run_inside' ? [...olineOf(offense), ...offense.filter((a) => a.position === 'TE')] : olineOf(offense)
  applyBlockingTargets(targets, blockablePool, frontSeven)
  applyDefaultSkillPlayerTargets(targets, offense, 8)

  if (rb) applyRunPursuitTargets(targets, defense, rb, finalTarget)

  return targets
}

/** Builds per-actor steering-target functions for a passing play (complete, incomplete, interception, sack). */
function setupPassPlay(rng: Rng, offensePlay: OffensePlay, offense: Actor[], defense: Actor[], outcome: PlayOutcome): Map<string, TargetFn> {
  const targets = new Map<string, TargetFn>()
  const qb = offense.find((a) => a.position === 'QB')!
  const dropback: Vec2 = { x: qb.start.x, y: qb.start.y - (offensePlay.type === 'pass_deep' ? 3.5 : 2) }
  targets.set(qb.id, (tSec) => (tSec < 1.8 ? dropback : { x: dropback.x + 1, y: dropback.y }))

  const target = offense.find((a) => a.id === outcome.targetReceiverId)
  const routeDepth = offensePlay.type === 'pass_deep' ? 24 : offensePlay.type === 'pass_medium' ? 12 : 6
  const catchEvent = outcome.breakdownEvents.find((e) => e.kind === 'catch')
  const catchAt = catchEvent?.atSec ?? 3
  const tackleEvent = outcome.breakdownEvents.find((e) => e.kind === 'tackle' || e.kind === 'out_of_bounds')
  const endAt = tackleEvent?.atSec ?? catchAt

  const isComplete = outcome.type === 'run' || outcome.type === 'pass' || outcome.type === 'touchdown'
  const yacTarget: Vec2 = target ? { x: target.start.x * 0.6, y: outcome.yards } : { x: 0, y: outcome.yards }

  for (const receiver of offense.filter((a) => a.position === 'WR' || a.position === 'TE')) {
    const routeEnd: Vec2 = { x: receiver.start.x * 0.75, y: receiver.start.y + routeDepth }
    if (target && receiver.id === target.id) {
      targets.set(receiver.id, (tSec) => {
        if (tSec < catchAt) return routeEnd
        if (isComplete && outcome.type !== 'interception') return yacTarget
        return routeEnd
      })
    } else {
      targets.set(receiver.id, () => routeEnd)
    }
  }

  applyDefaultSkillPlayerTargets(targets, offense)

  const frontSeven = frontSevenOf(defense)
  applyBlockingTargets(targets, olineOf(offense), frontSeven)
  applyPassRushTargets(targets, frontSeven, qb, dropback)

  const secondary = secondaryOf(defense)
  const coverDefender = defense.find((a) => a.id === outcome.primaryDefenderId) ?? pick(rng, secondary)
  applyDefaultSecondaryTargets(targets, secondary, target, coverDefender?.id)
  // Post-interception peel-back for the intercepting defender, overriding the generic cover target above.
  if (outcome.type === 'interception' && coverDefender) {
    targets.set(coverDefender.id, (tSec, positions) => {
      if (tSec < endAt) return (target && positions.get(target.id)) ?? routeDepthFallback(coverDefender)
      return { x: coverDefender.start.x, y: (positions.get(coverDefender.id)?.y ?? coverDefender.start.y) - 2 }
    })
  }

  return targets
}

function setupSackPlay(offense: Actor[], defense: Actor[], outcome: PlayOutcome): Map<string, TargetFn> {
  const targets = new Map<string, TargetFn>()
  const qb = offense.find((a) => a.position === 'QB')!
  const sackSpot: Vec2 = { x: qb.start.x, y: qb.start.y + outcome.yards }
  targets.set(qb.id, () => sackSpot)

  const frontSeven = frontSevenOf(defense)
  applyBlockingTargets(targets, olineOf(offense), frontSeven)
  applyPassRushTargets(targets, frontSeven, qb, sackSpot)
  applyDefaultSkillPlayerTargets(targets, offense)
  for (const dbActor of secondaryOf(defense)) {
    targets.set(dbActor.id, () => ({ x: dbActor.start.x, y: dbActor.start.y + 1 }))
  }
  return targets
}

function ballHolder(outcome: PlayOutcome, tSec: number): { holderId: string; phase: 'held' | 'air' } {
  const events = outcome.breakdownEvents
  const throwEvt = events.find((e) => e.kind === 'throw')
  const catchEvt = events.find((e) => e.kind === 'catch')
  const handoffEvt = events.find((e) => e.kind === 'handoff')

  if (throwEvt) {
    if (tSec < throwEvt.atSec) return { holderId: 'QB', phase: 'held' }
    if (catchEvt && tSec < catchEvt.atSec) return { holderId: 'AIR', phase: 'air' }
    return { holderId: outcome.type === 'interception' ? 'DEFENDER' : 'TARGET', phase: 'held' }
  }
  if (handoffEvt) {
    return { holderId: tSec < handoffEvt.atSec ? 'QB' : 'RB', phase: 'held' }
  }
  return { holderId: 'QB', phase: 'held' }
}

export interface SimulatePlayArgs {
  outcome: PlayOutcome
  offensePlay: OffensePlay
  defensePlay: DefensePlay
  offense: Team
  defense: Team
  rng: Rng
}

export function simulatePlay({ outcome, offensePlay, defensePlay, offense, defense, rng }: SimulatePlayArgs): PlayFrame[] {
  const offenseActors = buildOffenseActors(offense)
  const defenseActors = buildDefenseActors(defense, defensePlay.type)
  const allActors = [...offenseActors, ...defenseActors]

  const engine = createPhysicsWorld()
  const bodies = new Map<string, Matter.Body>()
  for (const actor of allActors) {
    const body = createPlayerBody(actor.start.x, actor.start.y)
    bodies.set(actor.id, body)
    Matter.Composite.add(engine.world, body)
  }

  const isRun = offensePlay.type === 'run_inside' || offensePlay.type === 'run_outside'
  const targets = offensePlay.custom
    ? setupCustomOffensePlay(offensePlay, offenseActors, defenseActors, outcome)
    : outcome.type === 'sack'
      ? setupSackPlay(offenseActors, defenseActors, outcome)
      : isRun
        ? setupRunPlay(rng, offensePlay, offenseActors, defenseActors, outcome)
        : setupPassPlay(rng, offensePlay, offenseActors, defenseActors, outcome)

  if (defensePlay.custom) {
    setupCustomDefensePlay(defensePlay, offenseActors, defenseActors, outcome, targets)
  }

  const lastEvent = outcome.breakdownEvents[outcome.breakdownEvents.length - 1]
  const durationSec = Math.max(1.5, lastEvent?.atSec ?? 3)

  const qb = offenseActors.find((a) => a.position === 'QB')!
  const rb = offenseActors.find((a) => a.position === 'RB')
  const target = offenseActors.find((a) => a.id === outcome.targetReceiverId)
  const defenderActor = defenseActors.find((a) => a.id === outcome.primaryDefenderId)

  const frames: PlayFrame[] = []
  let tSec = 0
  while (tSec <= durationSec) {
    const positions = new Map<string, Vec2>()
    const velocities = new Map<string, Vec2>()
    for (const actor of allActors) {
      const body = bodies.get(actor.id)!
      positions.set(actor.id, { x: body.position.x, y: body.position.y })
      velocities.set(actor.id, { x: body.velocity.x, y: body.velocity.y })
    }

    for (const actor of allActors) {
      const body = bodies.get(actor.id)!
      const targetFn = targets.get(actor.id)
      const desiredTarget = targetFn ? targetFn(tSec, positions, velocities) : actor.start
      const desiredVel = arrive({ x: body.position.x, y: body.position.y }, desiredTarget, actorMaxSpeed(actor))
      const nextVel = steerToward({ x: body.velocity.x, y: body.velocity.y }, desiredVel, actorMaxAccel(actor), DT)
      Matter.Body.setVelocity(body, nextVel)
    }

    Matter.Engine.update(engine, DT * 1000)

    for (const body of bodies.values()) {
      const clamped = clampToField({ x: body.position.x, y: body.position.y })
      Matter.Body.setPosition(body, clamped)
    }

    const holder = ballHolder(outcome, tSec)
    let ballPos: Vec2
    let ballHolderId: string | null
    const qbPos = { x: bodies.get(qb.id)!.position.x, y: bodies.get(qb.id)!.position.y }
    if (holder.holderId === 'QB') {
      ballPos = qbPos
      ballHolderId = qb.id
    } else if (holder.holderId === 'RB' && rb) {
      ballPos = { x: bodies.get(rb.id)!.position.x, y: bodies.get(rb.id)!.position.y }
      ballHolderId = rb.id
    } else if (holder.holderId === 'AIR') {
      const throwEvt = outcome.breakdownEvents.find((e) => e.kind === 'throw')!
      const catchEvt = outcome.breakdownEvents.find((e) => e.kind === 'catch')!
      const progress = Math.max(0, Math.min(1, (tSec - throwEvt.atSec) / Math.max(0.1, catchEvt.atSec - throwEvt.atSec)))
      const landingActor = target ?? defenderActor
      const landingPos = landingActor ? { x: bodies.get(landingActor.id)!.position.x, y: bodies.get(landingActor.id)!.position.y } : qbPos
      ballPos = { x: qbPos.x + (landingPos.x - qbPos.x) * progress, y: qbPos.y + (landingPos.y - qbPos.y) * progress }
      ballHolderId = null
    } else if (holder.holderId === 'TARGET' && target) {
      ballPos = { x: bodies.get(target.id)!.position.x, y: bodies.get(target.id)!.position.y }
      ballHolderId = target.id
    } else if (holder.holderId === 'DEFENDER' && defenderActor) {
      ballPos = { x: bodies.get(defenderActor.id)!.position.x, y: bodies.get(defenderActor.id)!.position.y }
      ballHolderId = defenderActor.id
    } else {
      ballPos = qbPos
      ballHolderId = qb.id
    }

    const eventNow = outcome.breakdownEvents.find((e) => Math.abs(e.atSec - tSec) < DT / 2)
    const players: Record<string, Vec2> = {}
    for (const [id, pos] of positions) players[id] = pos

    frames.push({ tSec, players, ball: ballPos, ballHolderId, event: eventNow?.kind })
    tSec += DT
  }

  // Snap the final resting spot of the ball/carrier to exactly match the resolved outcome,
  // blending in over the last few frames so it doesn't visibly teleport.
  snapFinalPosition(frames, outcome, isRun, rb, target)

  return frames
}

function snapFinalPosition(
  frames: PlayFrame[],
  outcome: PlayOutcome,
  isRun: boolean,
  rb: Actor | undefined,
  target: Actor | undefined,
): void {
  if (frames.length === 0) return
  const carrierId = isRun ? rb?.id : outcome.type === 'interception' ? undefined : target?.id
  if (!carrierId) return
  const exact: Vec2 = { x: frames[frames.length - 1].players[carrierId]?.x ?? 0, y: outcome.yards }
  const blendFrames = Math.min(9, frames.length)
  for (let i = 0; i < blendFrames; i++) {
    const frame = frames[frames.length - blendFrames + i]
    const t = (i + 1) / blendFrames
    const current = frame.players[carrierId]
    if (!current) continue
    frame.players[carrierId] = { x: current.x + (exact.x - current.x) * t, y: current.y + (exact.y - current.y) * t }
    if (frame.ballHolderId === carrierId) frame.ball = frame.players[carrierId]
  }
}
