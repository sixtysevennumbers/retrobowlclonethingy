/** Deterministic PRNG (mulberry32) so play outcomes and rosters are testable/seedable. */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

/** Normal-ish distribution via averaging uniforms (cheap central-limit approximation). */
export function randNormalish(rng: Rng, mean: number, spread: number): number {
  const sum = rng() + rng() + rng() - 1.5
  return mean + sum * (spread / 1.5)
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
