import type { DefensePlay, OffensePlay } from '../engine/playbook/types'

const OFFENSE_KEY = 'coach-sim:custom-offense-plays'
const DEFENSE_KEY = 'coach-sim:custom-defense-plays'

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function save<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // Storage unavailable (private browsing, quota) — custom plays just won't persist this session.
  }
}

export function loadCustomOffensePlays(): OffensePlay[] {
  return load<OffensePlay>(OFFENSE_KEY)
}
export function saveCustomOffensePlays(plays: OffensePlay[]): void {
  save(OFFENSE_KEY, plays)
}
export function loadCustomDefensePlays(): DefensePlay[] {
  return load<DefensePlay>(DEFENSE_KEY)
}
export function saveCustomDefensePlays(plays: DefensePlay[]): void {
  save(DEFENSE_KEY, plays)
}
