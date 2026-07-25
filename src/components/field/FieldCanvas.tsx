import { useEffect, useRef } from 'react'
import type { Team } from '../../domain/team'
import type { PlayFrame } from '../../engine/physics/playDirector'
import { CANVAS_HEIGHT, CANVAS_WIDTH, LOCAL_Y_MAX, LOCAL_Y_MIN, toCanvas } from './fieldProjection'

const FRAME_DT = 1 / 30

interface FieldCanvasProps {
  frames: PlayFrame[]
  offenseTeam: Team
  defenseTeam: Team
  playing: boolean
  onComplete: () => void
}

export function FieldCanvas({ frames, offenseTeam, defenseTeam, playing, onComplete }: FieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const completedRef = useRef(false)

  const playerLookup = useRef(new Map<string, { number: number; side: 'offense' | 'defense' }>())
  useEffect(() => {
    const map = new Map<string, { number: number; side: 'offense' | 'defense' }>()
    for (const p of offenseTeam.roster) map.set(p.id, { number: p.number, side: 'offense' })
    for (const p of defenseTeam.roster) map.set(p.id, { number: p.number, side: 'defense' })
    playerLookup.current = map
  }, [offenseTeam, defenseTeam])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function drawField() {
      if (!ctx) return
      ctx.fillStyle = '#1b6b3a'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      for (let yard = Math.ceil(LOCAL_Y_MIN / 5) * 5; yard <= LOCAL_Y_MAX; yard += 5) {
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
    }

    function drawFrame(frame: PlayFrame) {
      if (!ctx) return
      drawField()
      for (const [id, pos] of Object.entries(frame.players)) {
        const info = playerLookup.current.get(id)
        if (!info) continue
        const [cx, cy] = toCanvas(pos.x, pos.y)
        const isCarrier = frame.ballHolderId === id
        ctx.beginPath()
        ctx.arc(cx, cy, isCarrier ? 6.5 : 5.5, 0, Math.PI * 2)
        ctx.fillStyle = info.side === 'offense' ? '#3b82f6' : '#ef4444'
        ctx.fill()
        if (isCarrier) {
          ctx.strokeStyle = '#facc15'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        ctx.fillStyle = 'white'
        ctx.font = '7px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(info.number), cx, cy + 2.5)
      }
      const [bx, by] = toCanvas(frame.ball.x, frame.ball.y)
      ctx.beginPath()
      ctx.ellipse(bx, by, 3, 2, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#92400e'
      ctx.fill()
    }

    if (frames.length === 0) {
      drawField()
      return
    }

    if (!playing) {
      drawFrame(frames[frames.length - 1])
      return
    }

    completedRef.current = false
    const startTime = performance.now()
    function step(now: number) {
      const elapsedSec = (now - startTime) / 1000
      const index = Math.min(frames.length - 1, Math.round(elapsedSec / FRAME_DT))
      drawFrame(frames[index])
      if (index >= frames.length - 1) {
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
        return
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [frames, playing, onComplete])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="rounded-md border border-white/10 bg-emerald-900"
    />
  )
}
