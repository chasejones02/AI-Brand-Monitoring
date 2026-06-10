import { useEffect, useRef, useCallback } from 'react'

/*  Gold-tinted crystal lines + shatter shards that follow the cursor.
    Renders on a transparent fixed canvas so page content shows through.
    Parent controls visibility via the `active` prop (tied to scroll). */

interface CrystalCursorProps {
  active: boolean
}

/* ── Particle helpers (plain objects, no classes inside render) ── */

interface CrystalLine {
  x: number
  y: number
  angle: number
  radius: number
  targetRadius: number
  life: number
  lineWidth: number
  turnAngle: number
}

interface Shard {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
}

function createCrystal(x: number, y: number): CrystalLine {
  return {
    x,
    y,
    angle: Math.random() * Math.PI * 2,
    radius: 0,
    targetRadius: Math.random() * 60 + 15,
    life: 120,
    lineWidth: Math.random() * 1.2 + 0.4,
    turnAngle: (Math.random() - 0.5) * 0.12,
  }
}

function createShard(x: number, y: number): Shard {
  const angle = Math.random() * Math.PI * 2
  const speed = Math.random() * 4 + 1.5
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 80,
    size: Math.random() * 2.5 + 0.8,
  }
}

export function CrystalCursor({ active }: CrystalCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameId = useRef<number>(0)
  const mouse = useRef({ x: -9999, y: -9999 })
  const crystals = useRef<CrystalLine[]>([])
  const shards = useRef<Shard[]>([])
  const isActive = useRef(false)

  useEffect(() => {
    isActive.current = active
  }, [active])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouse.current.x = e.clientX
    mouse.current.y = e.clientY
  }, [])

  const handleClick = useCallback((e: MouseEvent) => {
    if (!isActive.current) return
    for (let i = 0; i < 35; i++) {
      shards.current.push(createShard(e.clientX, e.clientY))
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (isActive.current && Math.random() > 0.65) {
        crystals.current.push(
          createCrystal(
            mouse.current.x + (Math.random() - 0.5) * 40,
            mouse.current.y + (Math.random() - 0.5) * 40,
          ),
        )
      }

      /* ── Draw crystals ── */
      for (let i = crystals.current.length - 1; i >= 0; i--) {
        const c = crystals.current[i]
        c.life -= 1
        if (c.life <= 0) { crystals.current.splice(i, 1); continue }
        if (c.radius < c.targetRadius) c.radius += 0.5
        c.angle += c.turnAngle

        const alpha = c.life / 120
        ctx.strokeStyle = `rgba(201, 143, 10, ${alpha * 0.55})`
        ctx.lineWidth = c.lineWidth
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(
          c.x + Math.cos(c.angle) * c.radius,
          c.y + Math.sin(c.angle) * c.radius,
        )
        ctx.stroke()
      }

      /* ── Draw shards ── */
      for (let i = shards.current.length - 1; i >= 0; i--) {
        const s = shards.current[i]
        s.life -= 1
        if (s.life <= 0) { shards.current.splice(i, 1); continue }
        s.x += s.vx
        s.y += s.vy

        const alpha = s.life / 80
        ctx.fillStyle = `rgba(240, 190, 50, ${alpha * 0.7})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }

      frameId.current = requestAnimationFrame(animate)
    }

    animate()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(frameId.current)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('resize', resize)
    }
  }, [handleMouseMove, handleClick])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: active ? 1 : 0,
        transition: 'opacity 400ms ease',
      }}
    />
  )
}
