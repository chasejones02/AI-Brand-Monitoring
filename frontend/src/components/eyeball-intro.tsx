import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: () => void
}

const LETTERS = 'VISAION'.split('')

/**
 * Intro animation (~5.3s total):
 *  1. TEXT IN   — "VISAION" fades in on dark bg              (900ms)
 *  2. HOLD      — text rests                                  (500ms)
 *  3. RIPPLE    — subtle orange water shimmer sweeps across;  (1200ms)
 *                 each letter sways in a traveling sine wave
 *  4. DISPERSE  — letters slowly dissolve into amber dust     (1800ms)
 *  5. DISSOLVE  — dark overlay fades into the landing page    (900ms)
 */
export function EyeballIntro({ onComplete }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const textRef    = useRef<HTMLDivElement>(null)
  const cbRef      = useRef(onComplete)
  cbRef.current    = onComplete

  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    const canvas  = canvasRef.current
    const overlay = overlayRef.current
    const textEl  = textRef.current
    if (!canvas || !overlay || !textEl) return

    const ctx = canvas.getContext('2d')!
    const W   = window.innerWidth
    const H   = window.innerHeight
    canvas.width  = W
    canvas.height = H
    const cx = W / 2
    const cy = H / 2

    // ── Phase timing (ms) ────────────────────────────────────────
    const T_IN      = 900
    const T_HOLD    = 500
    const T_RIPPLE  = 1200
    const T_DISPERSE = 1800
    const T_DISSOLVE = 900

    const p1 = T_IN
    const p2 = p1 + T_HOLD
    const p3 = p2 + T_RIPPLE
    const p4 = p3 + T_DISPERSE
    const p5 = p4 + T_DISSOLVE

    // ── Easing ───────────────────────────────────────────────────
    function eio(t: number) { return t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2 }

    // ── Letter span refs ─────────────────────────────────────────
    const letterSpans = Array.from(
      textEl.querySelectorAll('[data-letter]')
    ) as HTMLElement[]

    // ── Particle system ──────────────────────────────────────────
    type Particle = {
      origX:     number
      origY:     number
      vx:        number
      vy:        number
      triggerMs: number
      size:      number
    }

    let particles: Particle[] = []
    let particlesReady = false

    const fontSize = Math.min(Math.max(W * 0.08, 52), 100)

    // Sample each character's pixels individually so we can stagger
    // dispersion character-by-character from left to right.
    document.fonts.ready.then(() => {
      try {
        // Compute char x-centers to match DOM flex layout with gap: 0.25em
        const probe = document.createElement('canvas')
        const pCtx  = probe.getContext('2d')!
        pCtx.font   = `700 ${fontSize}px Outfit, sans-serif`

        const gap    = fontSize * 0.25   // matches gap: 0.25em on flex container
        const totalW = LETTERS.reduce((s, c) => s + pCtx.measureText(c).width, 0)
                       + gap * (LETTERS.length - 1)

        const charCenters: number[] = []
        let drawX = cx - totalW / 2
        for (const ch of LETTERS) {
          const cw = pCtx.measureText(ch).width
          charCenters.push(drawX + cw / 2)
          drawX += cw + gap
        }

        for (let ci = 0; ci < LETTERS.length; ci++) {
          const off  = document.createElement('canvas')
          off.width  = W
          off.height = H
          const oCtx = off.getContext('2d')!
          oCtx.font          = `700 ${fontSize}px Outfit, sans-serif`
          oCtx.textAlign     = 'center'
          oCtx.textBaseline  = 'middle'
          oCtx.fillStyle     = '#ffffff'
          oCtx.fillText(LETTERS[ci], charCenters[ci], cy)

          const { data } = oCtx.getImageData(0, 0, W, H)

          for (let px = 0; px < W; px += 2) {
            for (let py = 0; py < H; py += 2) {
              if (data[(py * W + px) * 4 + 3] < 80) continue

              const relX  = px - charCenters[ci]
              const relY  = py - cy
              const angle = Math.atan2(relY, relX)
              const jitter = (Math.random() - 0.5) * 0.9
              const speed  = 12 + Math.random() * 45

              particles.push({
                origX:     px,
                origY:     py,
                vx:        Math.cos(angle + jitter) * speed * 0.45,
                vy:        Math.sin(angle + jitter) * speed - 10 - Math.random() * 22,
                // Left-to-right stagger: each character triggers ~65ms after the previous
                triggerMs: ci * 65 + Math.random() * 280,
                size:      0.7 + Math.random() * 1.4,
              })
            }
          }
        }

        particlesReady = true
      } catch (_) {
        // Font unavailable — particles won't render; text fades normally
      }
    })

    // ── Water shimmer renderer ────────────────────────────────────
    // progress 0→1: soft orange light band sweeps left → right
    function drawWaterShimmer(progress: number) {
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'

      // Multiple overlapping wave fronts with decreasing width + opacity
      const waves = [
        { off: 0,    w: 0.40, a: 0.10 },
        { off: 0.13, w: 0.26, a: 0.06 },
        { off: 0.25, w: 0.17, a: 0.032 },
        { off: 0.35, w: 0.11, a: 0.016 },
      ]

      for (const { off, w, a } of waves) {
        const wp = progress - off
        if (wp <= 0 || wp > 1.1) continue

        // Center x of this wave band
        const waveX = wp * W * 1.25 - W * 0.125
        const halfW = W * w

        // Soft fade-in/out at leading and trailing edges
        const edge  = Math.min(1, wp * 3) * Math.min(1, (1.1 - wp) * 3)
        const alpha = a * edge

        const grad = ctx.createLinearGradient(waveX - halfW, 0, waveX + halfW, 0)
        grad.addColorStop(0,    `rgba(240,165,0,0)`)
        grad.addColorStop(0.2,  `rgba(225,130,0,${alpha * 0.35})`)
        grad.addColorStop(0.5,  `rgba(255,200,80,${alpha})`)
        grad.addColorStop(0.8,  `rgba(225,130,0,${alpha * 0.35})`)
        grad.addColorStop(1,    `rgba(240,165,0,0)`)

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }

      ctx.restore()
    }

    // ── Letter sway ──────────────────────────────────────────────
    // Traveling sine wave across the word — each letter slightly
    // behind the previous, building and dying with the ripple.
    function applyLetterSway(progress: number) {
      // Envelope: ramps up then back to zero so text is still at end of phase
      const envelope = Math.sin(progress * Math.PI)

      letterSpans.forEach((span, i) => {
        const phase = progress * Math.PI * 5 - i * 0.48
        const dy    = envelope * Math.sin(phase) * 6.5
        const dx    = envelope * Math.sin(phase * 0.6) * 1.8
        span.style.transform = `translate(${dx}px,${dy}px)`
      })
    }

    function resetSway() {
      letterSpans.forEach(s => { s.style.transform = '' })
    }

    // ── Particle renderer ─────────────────────────────────────────
    function drawParticles(disperseMs: number, overallAlpha: number) {
      if (!particlesReady) return

      ctx.save()
      // Additive blend on the dark bg gives particles a soft amber glow
      ctx.globalCompositeOperation = 'screen'

      for (const p of particles) {
        const movingMs = disperseMs - p.triggerMs
        let x: number, y: number, alpha: number

        if (movingMs <= 0) {
          // Waiting — hold at original text position
          x     = p.origX
          y     = p.origY
          alpha = 1
        } else {
          // Exponential-drag motion: gracefully decelerating drift
          const t = movingMs / 1000
          const k = 1.0
          const s = (1 - Math.exp(-k * t)) / k
          x     = p.origX + p.vx * s
          y     = p.origY + p.vy * s
          alpha = Math.max(0, 1 - t / 2.8)
        }

        const finalAlpha = alpha * overallAlpha
        if (finalAlpha < 0.01) continue

        // white → amber → orange as particle moves
        const moveT = Math.min(1, Math.max(0, movingMs / 500))
        const g     = Math.round(255 - moveT * 90)
        const b     = Math.round(255 * Math.max(0, 1 - moveT * 2.5))

        ctx.globalAlpha = finalAlpha
        ctx.fillStyle   = `rgb(255,${g},${b})`
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    // ── Main loop ─────────────────────────────────────────────────
    let startTime = -1
    let rafId: number

    function tick(now: number) {
      if (startTime < 0) startTime = now
      const elapsed = now - startTime

      ctx.clearRect(0, 0, W, H)

      if (elapsed < p1) {
        // ── TEXT FADE IN ──────────────────────────────────────────
        textEl.style.opacity = String(eio(elapsed / T_IN))
        resetSway()

      } else if (elapsed < p2) {
        // ── HOLD ──────────────────────────────────────────────────
        textEl.style.opacity = '1'
        resetSway()

      } else if (elapsed < p3) {
        // ── WATER RIPPLE + LETTER SWAY ────────────────────────────
        const progress = (elapsed - p2) / T_RIPPLE
        textEl.style.opacity = '1'
        drawWaterShimmer(progress)
        applyLetterSway(progress)

      } else if (elapsed < p4) {
        // ── SLOW PARTICLE DISPERSION ──────────────────────────────
        textEl.style.opacity = '0'
        resetSway()
        drawParticles(elapsed - p3, 1)

      } else if (elapsed < p5) {
        // ── DISSOLVE INTO LANDING PAGE ────────────────────────────
        const de = elapsed - p4
        textEl.style.opacity = '0'
        drawParticles(T_DISPERSE + de, 1)
        overlay.style.opacity = String(Math.max(0, 1 - eio(de / T_DISSOLVE)))

      } else {
        // ── DONE ─────────────────────────────────────────────────
        overlay.style.opacity = '0'
        setIsDone(true)
        cbRef.current()
        return
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  if (isDone) return null

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#080b10', overflow: 'hidden',
      }}
    >
      {/* Particle + shimmer canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      />

      {/* DOM text — individual letter spans so each can sway independently */}
      <div
        ref={textRef}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          // gap matches the 0.25em letter-spacing used in canvas pixel sampling
          fontSize: 'clamp(52px, 8vw, 100px)',
          gap: '0.25em',
          opacity: 0, pointerEvents: 'none',
        }}
      >
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            data-letter
            style={{
              fontWeight:    700,
              color:         '#ffffff',
              fontFamily:    'Outfit, sans-serif',
              textTransform: 'uppercase',
              textShadow:    '0 0 50px rgba(240,165,0,0.22)',
              display:       'inline-block',
              willChange:    'transform',
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  )
}
