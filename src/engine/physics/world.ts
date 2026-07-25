import Matter from 'matter-js'

/** All physics/formation math happens in yards, in a play-local frame where the LOS is y=0
 *  and the offense always advances toward +y. The renderer maps this into absolute field space. */
export const FIELD_WIDTH_YD = 53.3
export const PLAYER_RADIUS_YD = 0.55
export const BALL_RADIUS_YD = 0.15

export function createPhysicsWorld() {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } })
  return engine
}

export function createPlayerBody(x: number, y: number): Matter.Body {
  return Matter.Bodies.circle(x, y, PLAYER_RADIUS_YD, {
    friction: 0,
    frictionAir: 0.02,
    restitution: 0.1,
    inertia: Infinity, // no spin — keeps collisions from sending players tumbling
  })
}

/** Converts speed/acceleration ratings (0-99) into yards/sec and yards/sec^2. */
export function maxSpeedFor(speedRating: number): number {
  return 4.2 + (speedRating / 99) * 5.2 // ~4.2 - 9.4 yd/s
}
export function maxAccelFor(accelRating: number): number {
  return 6 + (accelRating / 99) * 10 // ~6 - 16 yd/s^2
}
