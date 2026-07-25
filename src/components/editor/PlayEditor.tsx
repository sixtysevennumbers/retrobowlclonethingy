import { useEffect, useRef, useState } from 'react'
import { classifyCustomDefenseType, classifyCustomOffenseType } from '../../engine/playbook/customPlay'
import type { CustomDefenseData, CustomOffenseData, DefenseAssignment, DefensePlay, DrawnRoute, OffensePlay } from '../../engine/playbook/types'
import { getDefenseSlotPositions, OFFENSE_SLOTS, type SlotPosition } from '../../engine/physics/formations'
import { distance, type Vec2 } from '../../engine/physics/steering'
import { CANVAS_HEIGHT, CANVAS_WIDTH, fromCanvas, toCanvas } from '../field/fieldProjection'

type EditorMode = 'offense' | 'defense'

interface PlayEditorProps {
  mode: EditorMode
  onSave: (play: OffensePlay | DefensePlay) => void
  onCancel: () => void
}

const DRAWABLE_OFFENSE_POSITIONS = new Set(['RB', 'WR', 'TE'])
const HIT_RADIUS_PX = 14
const MIN_POINT_SPACING_YD = 1.2
const MAX_ROUTE_POINTS = 14
const COVER_RADIUS_YD = 3
const RUSH_DEPTH_YD = 0.5

const ROUTE_COLORS = ['#facc15', '#22d3ee', '#f472b6', '#a3e635', '#fb923c', '#c084fc', '#f87171', '#60a5fa', '#34d399', '#fcd34d', '#818cf8']

function slotLabel(slot: SlotPosition): string {
  const multi = ['WR', 'CB', 'S', 'DE', 'DT', 'LB'].includes(slot.position)
  return multi ? `${slot.position}${slot.occurrence + 1}` : slot.position
}

function colorFor(slotKey: string, order: string[]): string {
  const idx = order.indexOf(slotKey)
  return ROUTE_COLORS[idx % ROUTE_COLORS.length]
}

function classifyDefenseAssignment(points: Vec2[], offenseGhosts: SlotPosition[]): { kind: DefenseAssignment['kind']; coverSlot?: string } {
  const last = points[points.length - 1]
  const nearestGhost = offenseGhosts.reduce<{ slot: SlotPosition; dist: number } | null>((closest, g) => {
    const d = distance(last, { x: g.x, y: g.y })
    if (!closest || d < closest.dist) return { slot: g, dist: d }
    return closest
  }, null)
  if (nearestGhost && nearestGhost.dist <= COVER_RADIUS_YD) return { kind: 'cover', coverSlot: nearestGhost.slot.slotKey }
  if (last.y <= RUSH_DEPTH_YD) return { kind: 'rush' }
  return { kind: 'zone' }
}

export function PlayEditor({ mode, onSave, onCancel }: PlayEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingSlot = useRef<string | null>(null)
  const lastPoint = useRef<Vec2 | null>(null)

  const [drawn, setDrawn] = useState<Record<string, Vec2[]>>({})
  const [kind, setKind] = useState<'run' | 'pass'>('pass')
  const [targetSlot, setTargetSlot] = useState<string | null>(null)
  const [name, setName] = useState('')

  const drawableSlots: SlotPosition[] = mode === 'offense' ? OFFENSE_SLOTS.filter((s) => DRAWABLE_OFFENSE_POSITIONS.has(s.position)) : getDefenseSlotPositions('balanced')
  const referenceSlots: SlotPosition[] = mode === 'offense' ? getDefenseSlotPositions('balanced') : OFFENSE_SLOTS
  const fixedOffenseSlots: SlotPosition[] = mode === 'offense' ? OFFENSE_SLOTS.filter((s) => !DRAWABLE_OFFENSE_POSITIONS.has(s.position)) : []

  const drawnOrder = Object.keys(drawn)

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Vec2 {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY
    return fromCanvas(px, py)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY

    let hit: SlotPosition | null = null
    let hitDist = Infinity
    for (const slot of drawableSlots) {
      const [sx, sy] = toCanvas(slot.x, slot.y)
      const d = Math.hypot(sx - px, sy - py)
      if (d < HIT_RADIUS_PX && d < hitDist) {
        hit = slot
        hitDist = d
      }
    }
    if (!hit) return

    canvasRef.current!.setPointerCapture(e.pointerId)
    draggingSlot.current = hit.slotKey
    const start = fromCanvas(px, py)
    lastPoint.current = start
    setDrawn((prev) => ({ ...prev, [hit!.slotKey]: [start] }))
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const slotKey = draggingSlot.current
    if (!slotKey) return
    const pt = canvasPoint(e)
    if (lastPoint.current && distance(pt, lastPoint.current) < MIN_POINT_SPACING_YD) return
    lastPoint.current = pt
    setDrawn((prev) => {
      const path = prev[slotKey] ?? []
      if (path.length >= MAX_ROUTE_POINTS) return prev
      return { ...prev, [slotKey]: [...path, pt] }
    })
  }

  function endDrag() {
    const slotKey = draggingSlot.current
    if (slotKey) {
      setDrawn((prev) => {
        const path = prev[slotKey]
        if (!path || path.length < 2) {
          const next = { ...prev }
          delete next[slotKey]
          return next
        }
        return prev
      })
    }
    draggingSlot.current = null
    lastPoint.current = null
  }

  function removeRoute(slotKey: string) {
    setDrawn((prev) => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })
    if (targetSlot === slotKey) setTargetSlot(null)
  }

  const canSaveOffense = kind === 'run' ? (drawn['RB:0']?.length ?? 0) >= 2 : !!targetSlot && (drawn[targetSlot]?.length ?? 0) >= 2
  const canSave = name.trim().length > 0 && (mode === 'defense' || canSaveOffense)

  function handleSave() {
    if (mode === 'offense') {
      const routes: DrawnRoute[] = Object.entries(drawn).map(([slotKey, points]) => ({ slotKey, points }))
      const data: CustomOffenseData = {
        kind,
        routes,
        ballCarrierSlot: kind === 'run' ? 'RB:0' : undefined,
        targetSlot: kind === 'pass' ? (targetSlot ?? undefined) : undefined,
      }
      const type = classifyCustomOffenseType(data)
      const play: OffensePlay = {
        id: `custom-off-${Date.now()}`,
        name: name.trim(),
        type,
        formation: 'Custom',
        description: kind === 'run' ? 'Hand-drawn run play' : `Hand-drawn pass, targeting ${slotLabel(drawableSlots.find((s) => s.slotKey === targetSlot)!)}`,
        custom: data,
      }
      onSave(play)
    } else {
      const assignments: DefenseAssignment[] = Object.entries(drawn).map(([slotKey, points]) => {
        const { kind: aKind, coverSlot } = classifyDefenseAssignment(points, referenceSlots)
        return { slotKey, kind: aKind, points, coverSlot }
      })
      const data: CustomDefenseData = { assignments }
      const type = classifyCustomDefenseType(data)
      const play: DefensePlay = {
        id: `custom-def-${Date.now()}`,
        name: name.trim(),
        type,
        description: 'Hand-drawn scheme',
        custom: data,
      }
      onSave(play)
    }
  }

  // --- rendering ---
  useEffect(() => {
    const ctx2d = canvasRef.current?.getContext('2d')
    if (!ctx2d) return
    drawEditor(ctx2d, { referenceSlots, drawableSlots, fixedOffenseSlots, drawn, drawnOrder, targetSlot, mode })
  })

  return (
    <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Draw a {mode === 'offense' ? 'Offensive' : 'Defensive'} Play
        </h3>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">
          Cancel
        </button>
      </div>

      {mode === 'offense' && (
        <div className="flex gap-2">
          <button
            onClick={() => setKind('run')}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-semibold ${kind === 'run' ? 'border-blue-400 bg-blue-900/60 text-blue-100' : 'border-white/15 bg-slate-800/60 text-slate-300'}`}
          >
            Run Play
          </button>
          <button
            onClick={() => setKind('pass')}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-semibold ${kind === 'pass' ? 'border-blue-400 bg-blue-900/60 text-blue-100' : 'border-white/15 bg-slate-800/60 text-slate-300'}`}
          >
            Pass Play
          </button>
        </div>
      )}

      <p className="text-xs text-slate-400">
        {mode === 'offense'
          ? kind === 'run'
            ? 'Drag from the RB to draw the running path.'
            : 'Drag from any eligible receiver to draw their route, then mark one as the target below.'
          : 'Drag from a defender: drop onto a receiver to cover them man-to-man, drag across the line of scrimmage to blitz, or drop anywhere else to set a zone.'}
      </p>

      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="touch-none rounded-md border border-white/10 bg-emerald-900"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        />
      </div>

      {drawnOrder.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {drawnOrder.map((slotKey) => {
            const slot = drawableSlots.find((s) => s.slotKey === slotKey)
            if (!slot) return null
            return (
              <div key={slotKey} className="flex items-center gap-2 text-xs">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(slotKey, drawnOrder) }} />
                <span className="flex-1 text-slate-300">{slotLabel(slot)}</span>
                {mode === 'offense' && kind === 'pass' && (
                  <button
                    onClick={() => setTargetSlot(slotKey)}
                    className={`rounded px-2 py-0.5 ${targetSlot === slotKey ? 'bg-yellow-500 text-slate-900 font-semibold' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >
                    {targetSlot === slotKey ? 'Target' : 'Set Target'}
                  </button>
                )}
                <button onClick={() => removeRoute(slotKey)} className="text-slate-500 hover:text-red-400">
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this play"
          className="flex-1 rounded-md border border-white/15 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          Save Play
        </button>
      </div>
    </div>
  )
}

function drawEditor(
  ctx: CanvasRenderingContext2D,
  opts: {
    referenceSlots: SlotPosition[]
    drawableSlots: SlotPosition[]
    fixedOffenseSlots: SlotPosition[]
    drawn: Record<string, Vec2[]>
    drawnOrder: string[]
    targetSlot: string | null
    mode: EditorMode
  },
) {
  const { referenceSlots, drawableSlots, fixedOffenseSlots, drawn, drawnOrder, targetSlot, mode } = opts

  ctx.fillStyle = '#1b6b3a'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1
  for (let yard = 0; yard <= 45; yard += 5) {
    const [, cy] = toCanvas(0, yard)
    ctx.beginPath()
    ctx.moveTo(0, cy)
    ctx.lineTo(CANVAS_WIDTH, cy)
    ctx.stroke()
  }
  const [, losY] = toCanvas(0, 0)
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, losY)
  ctx.lineTo(CANVAS_WIDTH, losY)
  ctx.stroke()

  // Reference ghosts (the other side's typical look, for spatial context / cover-target hit testing).
  for (const slot of referenceSlots) {
    const [cx, cy] = toCanvas(slot.x, slot.y)
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fill()
  }

  // Fixed (non-drawable) offense reference, e.g. QB/OL when drawing offense.
  for (const slot of fixedOffenseSlots) {
    const [cx, cy] = toCanvas(slot.x, slot.y)
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(59,130,246,0.5)'
    ctx.fill()
  }

  // Drawn routes.
  for (const slotKey of drawnOrder) {
    const points = drawn[slotKey]
    if (!points || points.length === 0) continue
    const color = colorFor(slotKey, drawnOrder)
    ctx.strokeStyle = color
    ctx.lineWidth = slotKey === targetSlot ? 3 : 2
    ctx.beginPath()
    points.forEach((p, i) => {
      const [cx, cy] = toCanvas(p.x, p.y)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    })
    ctx.stroke()
    const last = points[points.length - 1]
    const [lx, ly] = toCanvas(last.x, last.y)
    ctx.beginPath()
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  // Drawable slots (the side being edited).
  for (const slot of drawableSlots) {
    const [cx, cy] = toCanvas(slot.x, slot.y)
    const hasRoute = drawn[slot.slotKey]?.length > 0
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fillStyle = mode === 'offense' ? '#3b82f6' : '#ef4444'
    ctx.fill()
    if (hasRoute) {
      ctx.strokeStyle = slot.slotKey === targetSlot ? '#facc15' : 'white'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.fillStyle = 'white'
    ctx.font = 'bold 8px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(slotLabel(slot), cx, cy - 10)
  }
}
