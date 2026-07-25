import type { DefensePlay } from './types'

export const DEFENSE_PLAYBOOK: DefensePlay[] = [
  { id: 'stack', name: 'Stacked Box', type: 'stacked_box', description: 'Extra defender in the box to stop the run.' },
  { id: 'base', name: 'Base 4-3', type: 'balanced', description: 'Standard run/pass-balanced front.' },
  { id: 'shell', name: 'Two-Deep Shell', type: 'pass_shell', description: 'Drop 7-8 into coverage, protect against the deep ball.' },
  { id: 'blitz', name: 'All-Out Blitz', type: 'blitz', description: 'Send extra rushers, high risk / high reward.' },
  { id: 'press', name: 'Man Press', type: 'man_press', description: 'Press coverage on receivers, aggressive man-to-man.' },
]
