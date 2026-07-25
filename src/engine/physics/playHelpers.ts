import type { Actor } from './formations'
import { pairBlockers } from './formations'
import { pursue as pursueSteer, type Vec2 } from './steering'
import { maxAccelFor, maxSpeedFor } from './world'

export type TargetFn = (tSec: number, positions: Map<string, Vec2>, velocities: Map<string, Vec2>) => Vec2

export function actorMaxSpeed(actor: Actor): number {
  return maxSpeedFor(actor.player.ratings.speed)
}
export function actorMaxAccel(actor: Actor): number {
  return maxAccelFor(actor.player.ratings.acceleration)
}

export function olineOf(offense: Actor[]): Actor[] {
  return offense.filter((a) => a.position === 'LT' || a.position === 'LG' || a.position === 'C' || a.position === 'RG' || a.position === 'RT')
}
export function frontSevenOf(defense: Actor[]): Actor[] {
  return defense.filter((a) => a.position === 'DE' || a.position === 'DT' || a.position === 'LB')
}
export function secondaryOf(defense: Actor[]): Actor[] {
  return defense.filter((a) => a.position === 'CB' || a.position === 'S')
}

/** Pairs blockers to the nearest front-seven defenders and sets the blockers' (offense-side) targets. */
export function applyBlockingTargets(targets: Map<string, TargetFn>, blockers: Actor[], frontSeven: Actor[]): void {
  const pairs = pairBlockers(blockers, frontSeven)
  for (const blocker of blockers) {
    const defenderId = pairs.get(blocker.id)
    if (defenderId) targets.set(blocker.id, (_t, positions) => positions.get(defenderId) ?? blocker.start)
  }
}

/** Front-seven defenders rush the passer (blocked ones get physically impeded by applyBlockingTargets). */
export function applyPassRushTargets(targets: Map<string, TargetFn>, frontSeven: Actor[], qb: Actor, fallback: Vec2): void {
  for (const rusher of frontSeven) {
    targets.set(rusher.id, (_t, positions) => positions.get(qb.id) ?? fallback)
  }
}

/** All defenders pursue the ball carrier (blocked ones get physically impeded by applyBlockingTargets). */
export function applyRunPursuitTargets(targets: Map<string, TargetFn>, defenders: Actor[], carrier: Actor, fallback: Vec2): void {
  for (const defender of defenders) {
    if (targets.has(defender.id)) continue
    targets.set(defender.id, (_t, positions, velocities) =>
      pursueSteer(defender.start, positions.get(carrier.id) ?? fallback, velocities.get(carrier.id) ?? { x: 0, y: 0 }, actorMaxSpeed(defender)),
    )
  }
}

/** Cosmetic default routes for offensive skill players who weren't otherwise assigned a target. */
export function applyDefaultSkillPlayerTargets(targets: Map<string, TargetFn>, offense: Actor[], depth = 6): void {
  for (const actor of offense) {
    if (targets.has(actor.id)) continue
    if (actor.position === 'WR' || actor.position === 'TE') {
      targets.set(actor.id, () => ({ x: actor.start.x * 0.75, y: actor.start.y + depth }))
    } else if (actor.position === 'RB') {
      targets.set(actor.id, () => ({ x: actor.start.x, y: actor.start.y + 2 }))
    }
  }
}

/** One secondary defender tracks `coverTarget` live; the rest hold a shallow zone drop. */
export function applyDefaultSecondaryTargets(
  targets: Map<string, TargetFn>,
  secondary: Actor[],
  coverTarget: Actor | undefined,
  coverDefenderId: string | undefined,
): void {
  for (const dbActor of secondary) {
    if (targets.has(dbActor.id)) continue
    if (coverDefenderId && dbActor.id === coverDefenderId && coverTarget) {
      targets.set(dbActor.id, (_t, positions) => positions.get(coverTarget.id) ?? dbActor.start)
    } else {
      targets.set(dbActor.id, () => ({ x: dbActor.start.x, y: dbActor.start.y + 2 }))
    }
  }
}

export function routeDepthFallback(actor: Actor): Vec2 {
  return { x: actor.start.x, y: actor.start.y + 8 }
}
