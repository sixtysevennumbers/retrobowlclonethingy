import { describe, expect, it } from 'vitest'
import { classifyCustomDefenseType, classifyCustomOffenseType } from './customPlay'
import type { CustomDefenseData, CustomOffenseData } from './types'

describe('classifyCustomOffenseType', () => {
  it('classifies a shallow slant as pass_short', () => {
    const data: CustomOffenseData = {
      kind: 'pass',
      targetSlot: 'WR:0',
      routes: [{ slotKey: 'WR:0', points: [{ x: -22, y: 0 }, { x: -10, y: 3 }, { x: -8, y: 5 }] }],
    }
    expect(classifyCustomOffenseType(data)).toBe('pass_short')
  })

  it('classifies a deep go route as pass_deep', () => {
    const data: CustomOffenseData = {
      kind: 'pass',
      targetSlot: 'WR:0',
      routes: [{ slotKey: 'WR:0', points: [{ x: -22, y: 0 }, { x: -20, y: 25 }] }],
    }
    expect(classifyCustomOffenseType(data)).toBe('pass_deep')
  })

  it('classifies a run that stays tight to the formation as run_inside', () => {
    const data: CustomOffenseData = {
      kind: 'run',
      routes: [{ slotKey: 'RB:0', points: [{ x: -3, y: -4.5 }, { x: 0, y: 3 }, { x: 1, y: 7 }] }],
    }
    expect(classifyCustomOffenseType(data)).toBe('run_inside')
  })

  it('classifies a run that drifts wide as run_outside', () => {
    const data: CustomOffenseData = {
      kind: 'run',
      routes: [{ slotKey: 'RB:0', points: [{ x: -3, y: -4.5 }, { x: -10, y: 2 }, { x: -14, y: 6 }] }],
    }
    expect(classifyCustomOffenseType(data)).toBe('run_outside')
  })
})

describe('classifyCustomDefenseType', () => {
  it('classifies an extra linebacker rush as blitz', () => {
    const data: CustomDefenseData = {
      assignments: [{ slotKey: 'LB:1', kind: 'rush', points: [{ x: 0, y: 5 }, { x: 0, y: -1 }] }],
    }
    expect(classifyCustomDefenseType(data)).toBe('blitz')
  })

  it('does not classify default DL rush assignments as blitz', () => {
    const data: CustomDefenseData = {
      assignments: [{ slotKey: 'DE:0', kind: 'rush', points: [{ x: -6, y: 1.2 }, { x: -2, y: -1 }] }],
    }
    expect(classifyCustomDefenseType(data)).toBe('balanced')
  })

  it('classifies two man-coverage assignments as man_press', () => {
    const data: CustomDefenseData = {
      assignments: [
        { slotKey: 'CB:0', kind: 'cover', points: [], coverSlot: 'WR:0' },
        { slotKey: 'CB:1', kind: 'cover', points: [], coverSlot: 'WR:2' },
      ],
    }
    expect(classifyCustomDefenseType(data)).toBe('man_press')
  })

  it('classifies deep zone drops as pass_shell', () => {
    const data: CustomDefenseData = {
      assignments: [
        { slotKey: 'S:0', kind: 'zone', points: [{ x: -8, y: 11 }, { x: -8, y: 16 }] },
        { slotKey: 'S:1', kind: 'zone', points: [{ x: 8, y: 11 }, { x: 8, y: 16 }] },
      ],
    }
    expect(classifyCustomDefenseType(data)).toBe('pass_shell')
  })

  it('classifies shallow zone drops as stacked_box', () => {
    const data: CustomDefenseData = {
      assignments: [{ slotKey: 'LB:1', kind: 'zone', points: [{ x: 0, y: 2 }] }],
    }
    expect(classifyCustomDefenseType(data)).toBe('stacked_box')
  })
})
