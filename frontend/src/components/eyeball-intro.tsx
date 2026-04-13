import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: () => void
}

/**
 * Intro animation (~2.9s total):
 *  1. FADE IN  — letters appear with glow already present    (900ms)
 *  2. HOLD     — subtle glow pulsation                       (1200ms)
 *  3. FADE OUT — letters + overlay dissolve into the page    (800ms)
 */
export function EyeballIntro({ onComplete }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const textRef    = useRef<HTMLDivElement>(null)
  const cbRef      = useRef(onComplete)
  cbRef.current    = onComplete

  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    const overlay = overlayRef.current
    const textEl  = textRef.current
    if (!overlay || !textEl) return

    const T_IN   = 900
    const T_HOLD = 1200
    const T_FADE = 800

    const p1 = T_IN
    const p2 = p1 + T_HOLD
    const p3 = p2 + T_FADE

    function eio(t: number) { return t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2 }

    // Glow is constant — shadow is always the same base intensity.
    // Only the outer layer pulses very subtly.
    function setGlow(opacity: number, elapsed: number) {
      const pulse = 1 + Math.sin(elapsed / 700) * 0.06   // ±6% on outer layer only
      textEl.style.textShadow = [
        `0 0 18px rgba(255,255,255,${0.7  * opacity})`,
        `0 0 55px rgba(255,255,255,${0.22 * opacity * pulse})`,
      ].join(',')
    }

    let startTime = -1
    let rafId: number

    function tick(now: number) {
      if (startTime < 0) startTime = now
      const elapsed = now - startTime

      if (elapsed < p1) {
        // ── FADE IN ───────────────────────────────────────────────
        const t = eio(elapsed / T_IN)
        textEl.style.opacity = String(t)
        setGlow(t, elapsed)

      } else if (elapsed < p2) {
        // ── HOLD (subtle pulse) ───────────────────────────────────
        textEl.style.opacity = '1'
        setGlow(1, elapsed)

      } else if (elapsed < p3) {
        // ── FADE OUT ──────────────────────────────────────────────
        const t = 1 - eio((elapsed - p2) / T_FADE)
        textEl.style.opacity  = String(t)
        overlay.style.opacity = String(t)
        setGlow(t, elapsed)

      } else {
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
        position: 'fixed', inset: 0, zIndex: 10000,
        background: '#080b10', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div ref={textRef} style={{ opacity: 0, pointerEvents: 'none' }}>
        <span style={{
          fontSize:      'clamp(52px, 8vw, 100px)',
          fontWeight:    700,
          color:         '#ffffff',
          letterSpacing: '0.25em',
          fontFamily:    'Outfit, sans-serif',
          textTransform: 'uppercase',
        }}>
          Visaion
        </span>
      </div>
    </div>
  )
}
