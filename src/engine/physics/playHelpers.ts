import type { Actor } from './formations'
import { pairBlockers } from './formations'
import { add, length, scale, sub, type Vec2 } from './steering'
import { maxAccelFor, maxSpeedFor, PLAYER_RADIUS_YD } from './world'

/** How far ahead (in seconds) pursuit targets lead a moving ball carrier. */
const PURSUIT_LEAD_TIME_SEC = 0.4

/** Just outside two players' combined collision radius. `arrive()`'s own stopping threshold is a
 *  small fraction of a yard, so if we ever target another body's *exact* center, we're asking that
 *  body to fully overlap it — the collision solver then fights that forever (bodies never actually
 *  reach 0 distance, so `arrive()` never eases off), which is what caused the instability/backward
 *  drift. Aiming at a standoff point just outside contact lets `arrive()` settle at a stable "engaged"
 *  distance instead. */
const STANDOFF_DIST_YD = PLAYER_RADIUS_YD * 2 + 0.15

export function standoffTarget(selfPos: Vec2, otherPos: Vec2): Vec2 {
  const offset = sub(selfPos, otherPos)
  const dist = length(offset)
  if (dist < 1e-6) return { x: otherPos.x + STANDOFF_DIST_YD, y: otherPos.y }
  return add(otherPos, scale(offset, STANDOFF_DIST_YD / dist))
}

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
    if (!defenderId) continue
    targets.set(blocker.id, (_t, positions) => {
      const defenderPos = positions.get(defenderId) ?? blocker.start
      const selfPos = positions.get(blocker.id) ?? blocker.start
      return standoffTarget(selfPos, defenderPos)
    })
  }
}

/** Front-seven defenders rush the passer (blocked ones get physically impeded by applyBlockingTargets). */
export function applyPassRushTargets(targets: Map<string, TargetFn>, frontSeven: Actor[], qb: Actor, fallback: Vec2): void {
  for (const rusher of frontSeven) {
    targets.set(rusher.id, (_t, positions) => {
      const qbPos = positions.get(qb.id) ?? fallback
      const selfPos = positions.get(rusher.id) ?? qbPos
      return standoffTarget(selfPos, qbPos)
    })
  }
}

/** How many yards downfield the ball carrier must reach before secondary defenders join the chase —
 *  otherwise all 11 defenders beeline for the same point from snap and pile up on top of each other. */
const SECONDARY_RUN_SUPPORT_DEPTH_YD = 5

/** Defenders pursue the ball carrier (blocked ones get physically impeded by applyBlockingTargets).
 *  Secondary defenders hold a run-support depth until the play actually breaks past the front seven,
 *  instead of also converging on the exact same point from the snap — real defenses stagger like this,
 *  and it avoids a many-body pileup that a simple physics solver can't resolve stably.
 *  Returns a lead-predicted target *position* — the sim loop's own `arrive()` call turns that into a
 *  properly speed-capped velocity, so this must not pre-compute a velocity itself. */
export function applyRunPursuitTargets(targets: Map<string, TargetFn>, defenders: Actor[], carrier: Actor, fallback: Vec2): void {
  for (const defender of defenders) {
    if (targets.has(defender.id)) continue
    const isSecondary = defender.position === 'CB' || defender.position === 'S'
    targets.set(defender.id, (_t, positions, velocities) => {
      const carrierPos = positions.get(carrier.id) ?? fallback
      if (isSecondary && carrierPos.y < SECONDARY_RUN_SUPPORT_DEPTH_YD) {
        return { x: defender.start.x, y: defender.start.y - 3 }
      }
      const carrierVel = velocities.get(carrier.id) ?? { x: 0, y: 0 }
      const predicted = add(carrierPos, scale(carrierVel, PURSUIT_LEAD_TIME_SEC))
      const selfPos = positions.get(defender.id) ?? defender.start
      return standoffTarget(selfPos, predicted)
    })
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
      targets.set(dbActor.id, (_t, positions) => {
        const targetPos = positions.get(coverTarget.id) ?? dbActor.start
        const selfPos = positions.get(dbActor.id) ?? dbActor.start
        return standoffTarget(selfPos, targetPos)
      })
    } else {
      targets.set(dbActor.id, () => ({ x: dbActor.start.x, y: dbActor.start.y + 2 }))
    }
  }
}

export function routeDepthFallback(actor: Actor): Vec2 {
  return { x: actor.start.x, y: actor.start.y + 8 }
}
