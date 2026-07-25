import type { CustomDefenseData, CustomOffenseData, DefensePlayType, DrawnRoute, OffensePlayType } from './types'

function maxAbsX(route: DrawnRoute | undefined): number {
  if (!route || route.points.length === 0) return 0
  return Math.max(...route.points.map((p) => Math.abs(p.x)))
}

function maxDepth(route: DrawnRoute | undefined): number {
  if (!route || route.points.length === 0) return 0
  return Math.max(...route.points.map((p) => p.y))
}

/** Classifies a drawn offensive play into the same enum the ratings engine already understands. */
export function classifyCustomOffenseType(data: CustomOffenseData): OffensePlayType {
  if (data.kind === 'run') {
    const carrier = data.routes.find((r) => r.slotKey === (data.ballCarrierSlot ?? 'RB:0')) ?? data.routes[0]
    return maxAbsX(carrier) <= 6 ? 'run_inside' : 'run_outside'
  }
  const target = data.routes.find((r) => r.slotKey === data.targetSlot) ?? data.routes[0]
  const depth = maxDepth(target)
  if (depth < 9) return 'pass_short'
  if (depth <= 16) return 'pass_medium'
  return 'pass_deep'
}

const isFrontLineman = (slotKey: string) => slotKey.startsWith('DE:') || slotKey.startsWith('DT:')

/** Classifies a drawn defensive scheme into the same enum the ratings engine already understands. */
export function classifyCustomDefenseType(data: CustomDefenseData): DefensePlayType {
  const extraRushers = data.assignments.filter((a) => a.kind === 'rush' && !isFrontLineman(a.slotKey))
  if (extraRushers.length >= 1) return 'blitz'

  const covers = data.assignments.filter((a) => a.kind === 'cover')
  if (covers.length >= 2) return 'man_press'

  const zones = data.assignments.filter((a) => a.kind === 'zone')
  if (zones.length > 0) {
    const avgDepth = zones.reduce((sum, z) => sum + maxDepth(z), 0) / zones.length
    if (avgDepth >= 9) return 'pass_shell'
    if (avgDepth <= 3) return 'stacked_box'
  }

  return 'balanced'
}
