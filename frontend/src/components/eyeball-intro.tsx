import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: () => void
}

/**
 * Intro animation (~4s total):
 *  1. SVG PATH DRAW — "VISAION" letters draw in with stroke animation  (2.8s)
 *  2. FILL REVEAL   — letters fill with color after drawing completes  (0.6s)
 *  3. FADE OUT       — overlay dissolves into the page                 (0.6s)
 */
export function EyeballIntro({ onComplete }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const cbRef      = useRef(onComplete)
  cbRef.current    = onComplete

  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const T_DRAW = 4200
    const T_FILL = 600
    const T_FADE = 600

    // After drawing completes, trigger fill reveal
    const fillTimer = setTimeout(() => {
      const textEl = overlay.querySelector('.intro-svg-text') as SVGTextElement | null
      if (textEl) {
        textEl.style.transition = `fill ${T_FILL}ms ease-out, filter ${T_FILL}ms ease-out`
        textEl.style.fill = '#ffffff'
        textEl.style.filter = 'drop-shadow(0 0 30px rgba(201,143,10,0.5)) drop-shadow(0 0 60px rgba(201,143,10,0.2))'
      }
    }, T_DRAW)

    // After fill, fade out the overlay
    const fadeTimer = setTimeout(() => {
      if (overlay) {
        overlay.style.transition = `opacity ${T_FADE}ms ease-out`
        overlay.style.opacity = '0'
      }
    }, T_DRAW + T_FILL)

    // After fade, remove and call onComplete
    const doneTimer = setTimeout(() => {
      setIsDone(true)
      cbRef.current()
    }, T_DRAW + T_FILL + T_FADE)

    return () => {
      clearTimeout(fillTimer)
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
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
      <svg
        width="1200"
        height="300"
        viewBox="0 0 900 200"
        style={{ maxWidth: '90vw' }}
      >
        <defs>
          <linearGradient id="introPathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c98f0a" />
            <stop offset="50%" stopColor="#f5c842" />
            <stop offset="100%" stopColor="#c98f0a" />
          </linearGradient>
        </defs>

        <text
          className="intro-svg-text"
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#080b10"
          stroke="url(#introPathGradient)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          fontSize="120"
          fontWeight="700"
          fontFamily="Outfit, sans-serif"
          letterSpacing="0.25em"
          paintOrder="stroke"
          strokeDasharray="1200"
          strokeDashoffset="1200"
          style={{ textTransform: 'uppercase' } as React.CSSProperties}
        >
          Visaion
          <animate
            attributeName="stroke-dashoffset"
            values="1200;0"
            dur="4.2s"
            repeatCount="1"
            fill="freeze"
            calcMode="spline"
            keySplines="0.25 0.1 0.25 1"
          />
          <animate
            attributeName="stroke-width"
            values="1.5;2.5;2"
            dur="4.2s"
            repeatCount="1"
            fill="freeze"
            calcMode="spline"
            keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
          />
        </text>
      </svg>
    </div>
  )
}
