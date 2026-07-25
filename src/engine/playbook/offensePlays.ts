import type { OffensePlay } from './types'

export const OFFENSE_PLAYBOOK: OffensePlay[] = [
  { id: 'iso', name: 'Iso Dive', type: 'run_inside', formation: 'I-Form', description: 'RB follows FB/OL push up the middle.' },
  { id: 'stretch', name: 'Outside Stretch', type: 'run_outside', formation: 'Singleback', description: 'RB stretches the edge, one-cut upfield.' },
  { id: 'slants', name: 'Slants & Flats', type: 'pass_short', formation: 'Shotgun', description: 'Quick-hitting short routes, high completion rate.' },
  { id: 'crossers', name: 'Mesh Crossers', type: 'pass_medium', formation: 'Shotgun', description: 'Receivers cross the middle at 10-15 yards.' },
  { id: 'shot', name: 'Deep Shot', type: 'pass_deep', formation: 'Pistol', description: 'Go route down the sideline, boom-or-bust.' },
  { id: 'boot', name: 'Play-Action Boot', type: 'play_action', formation: 'I-Form', description: 'Fake the handoff, QB rolls out to throw.' },
]
