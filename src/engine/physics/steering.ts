export interface Vec2 {
  x: number
  y: number
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}
export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s }
}
export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y)
}
export function normalize(a: Vec2): Vec2 {
  const len = length(a)
  return len < 1e-6 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len }
}
export function distance(a: Vec2, b: Vec2): number {
  return length(sub(a, b))
}

/** Desired velocity to reach `target` at up to `maxSpeed`, slowing within `slowRadius`. */
export function arrive(position: Vec2, target: Vec2, maxSpeed: number, slowRadius = 3): Vec2 {
  const offset = sub(target, position)
  const dist = length(offset)
  if (dist < 0.05) return { x: 0, y: 0 }
  const speed = dist < slowRadius ? maxSpeed * (dist / slowRadius) : maxSpeed
  return scale(normalize(offset), speed)
}

/** Desired velocity to intercept a moving target, leading by its current velocity. */
export function pursue(position: Vec2, targetPos: Vec2, targetVel: Vec2, maxSpeed: number, leadTime = 0.4): Vec2 {
  const predicted = add(targetPos, scale(targetVel, leadTime))
  return arrive(position, predicted, maxSpeed, 1.5)
}

/** Moves `velocity` toward `desired` limited by `maxAccel` over timestep `dt`. */
export function steerToward(velocity: Vec2, desired: Vec2, maxAccel: number, dt: number): Vec2 {
  const delta = sub(desired, velocity)
  const deltaLen = length(delta)
  const maxDelta = maxAccel * dt
  if (deltaLen <= maxDelta || deltaLen < 1e-6) return desired
  return add(velocity, scale(delta, maxDelta / deltaLen))
}
