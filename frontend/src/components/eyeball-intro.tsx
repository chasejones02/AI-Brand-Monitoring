import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: () => void
}

/**
 * Intro animation (~5.6s total):
 *  1. DRAW        — "Visaion" strokes in via SVG stroke-dashoffset   (3.0s)
 *  2. SETTLE      — completed outline holds, stroke warms            (0.45s)
 *  3. CROSS-FADE  — "Visaion" drifts up & out, "See your brand"
 *                   rises in from below with a blur-to-zero fade     (0.9s)
 *  4. HOLD        — "See your brand" sits centered                   (0.85s)
 *  5. DISSOLVE    — overlay fades into the landing page              (0.55s)
 */
export function EyeballIntro({ onComplete }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const visaionRef = useRef<HTMLDivElement>(null)
  const tagRef     = useRef<HTMLDivElement>(null)
  const cbRef      = useRef(onComplete)
  cbRef.current    = onComplete

  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    const overlay = overlayRef.current
    const visaion = visaionRef.current
    const tag     = tagRef.current
    if (!overlay || !visaion || !tag) return

    const T_DRAW     = 2800
    const T_SETTLE   = 10
    const T_CROSS    = 900
    const T_HOLD_TAG = 1000
    const T_FADE     = 550

    const timers: ReturnType<typeof setTimeout>[] = []

    // After draw + settle, begin the cross-fade
    timers.push(setTimeout(() => {
      visaion.style.opacity   = '0'
      visaion.style.transform = 'translateY(-10px) scale(1.015)'
      visaion.style.filter    = 'blur(6px)'

      tag.style.opacity   = '1'
      tag.style.transform = 'translateY(0) scale(1)'
      tag.style.filter    = 'blur(0)'
    }, T_DRAW + T_SETTLE))

    // Hold the tagline, then fade the overlay away
    timers.push(setTimeout(() => {
      overlay.style.opacity = '0'
    }, T_DRAW + T_SETTLE + T_CROSS + T_HOLD_TAG))

    // Unmount once fade completes
    timers.push(setTimeout(() => {
      setIsDone(true)
      cbRef.current()
    }, T_DRAW + T_SETTLE + T_CROSS + T_HOLD_TAG + T_FADE))

    return () => timers.forEach(clearTimeout)
  }, [])

  if (isDone) return null

  const strokeStyle: React.CSSProperties = {
    textTransform: 'uppercase',
  }

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: '#080b10', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 550ms cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: 1,
      }}
    >
      {/* Soft radial vignette for depth */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(245,200,66,0.05), transparent 60%)',
        }}
      />

      {/* Layer 1 — "Visaion" (stroke draws in) */}
      <div
        ref={visaionRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 1,
          transform: 'translateY(0) scale(1)',
          filter: 'blur(0)',
          transition:
            'opacity 900ms cubic-bezier(0.4, 0, 0.2, 1), ' +
            'transform 900ms cubic-bezier(0.4, 0, 0.2, 1), ' +
            'filter 900ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'opacity, transform, filter',
        }}
      >
        <svg width="1200" height="300" viewBox="0 0 900 200" style={{ maxWidth: '90vw' }}>
          <defs>
            <linearGradient id="introPathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c98f0a" />
              <stop offset="50%" stopColor="#f5c842" />
              <stop offset="100%" stopColor="#c98f0a" />
            </linearGradient>
          </defs>
          <text
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
            style={strokeStyle}
          >
            Visaion
            <animate
              attributeName="stroke-dashoffset"
              values="1200;0"
              dur="3.0s"
              repeatCount="1"
              fill="freeze"
              calcMode="spline"
              keySplines="0.25 0.1 0.25 1"
            />
            <animate
              attributeName="stroke-width"
              values="1.5;2.5;2"
              dur="3.0s"
              repeatCount="1"
              fill="freeze"
              calcMode="spline"
              keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
            />
          </text>
        </svg>
      </div>

      {/* Layer 2 — "See your brand" (fades in from below) */}
      <div
        ref={tagRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transform: 'translateY(14px) scale(0.985)',
          filter: 'blur(8px)',
          transition:
            'opacity 900ms cubic-bezier(0.2, 0.7, 0.2, 1), ' +
            'transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1), ' +
            'filter 900ms cubic-bezier(0.2, 0.7, 0.2, 1)',
          willChange: 'opacity, transform, filter',
        }}
      >
        <svg width="1200" height="300" viewBox="0 0 1400 200" style={{ maxWidth: '92vw' }}>
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#080b10"
            stroke="url(#introPathGradient)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            fontSize="110"
            fontWeight="700"
            fontFamily="Outfit, sans-serif"
            letterSpacing="0.22em"
            paintOrder="stroke"
            style={strokeStyle}
          >
            See your brand
          </text>
        </svg>
      </div>
    </div>
  )
}
