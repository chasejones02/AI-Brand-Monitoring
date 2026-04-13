import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: () => void
}

/* ── TextScramble (adapted from 21st.dev raining-letters pattern) ── */
class TextScramble {
  el: HTMLElement
  chars: string
  queue: Array<{ from: string; to: string; start: number; end: number; char?: string }>
  frame: number
  frameRequest: number
  resolve: () => void

  constructor(el: HTMLElement) {
    this.el = el
    this.chars = '!<>-_\\/[]{}—=+*^?#@$&'
    this.queue = []
    this.frame = 0
    this.frameRequest = 0
    this.resolve = () => {}
    this.update = this.update.bind(this)
  }

  setText(newText: string) {
    const oldText = this.el.innerText
    const length = Math.max(oldText.length, newText.length)
    const promise = new Promise<void>((resolve) => (this.resolve = resolve))
    this.queue = []

    for (let i = 0; i < length; i++) {
      const from = oldText[i] || ''
      const to = newText[i] || ''
      const start = Math.floor(Math.random() * 40)
      const end = start + Math.floor(Math.random() * 40)
      this.queue.push({ from, to, start, end })
    }

    cancelAnimationFrame(this.frameRequest)
    this.frame = 0
    this.update()
    return promise
  }

  update() {
    let output = ''
    let complete = 0

    for (let i = 0, n = this.queue.length; i < n; i++) {
      let { from, to, start, end, char } = this.queue[i]
      if (this.frame >= end) {
        complete++
        output += to
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          char = this.chars[Math.floor(Math.random() * this.chars.length)]
          this.queue[i].char = char
        }
        output += `<span class="glitch-dud">${char}</span>`
      } else {
        output += from
      }
    }

    this.el.innerHTML = output
    if (complete === this.queue.length) {
      this.resolve()
    } else {
      this.frameRequest = requestAnimationFrame(this.update)
      this.frame++
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameRequest)
  }
}

/**
 * Intro animation (~6s total):
 *  1. SVG PATH DRAW  — "VISAION" letters draw in with stroke animation  (4.2s)
 *  2. BRIEF HOLD     — completed outline holds                          (0.4s)
 *  3. GLITCH SCRAMBLE — letters scramble/glitch via TextScramble         (~1.2s)
 *  4. FADE OUT        — overlay dissolves into the page                  (0.5s)
 */
export function EyeballIntro({ onComplete }: Props) {
  const overlayRef   = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const scrambleRef  = useRef<HTMLDivElement>(null)
  const scramblerRef = useRef<TextScramble | null>(null)
  const cbRef        = useRef(onComplete)
  cbRef.current      = onComplete

  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    const overlay    = overlayRef.current
    const svgEl      = svgRef.current
    const scrambleEl = scrambleRef.current
    if (!overlay || !svgEl || !scrambleEl) return

    const T_DRAW = 3000
    const T_HOLD = 150
    const T_FADE = 400

    const timers: ReturnType<typeof setTimeout>[] = []

    // After drawing + hold, switch from SVG to HTML text and run glitch
    timers.push(setTimeout(() => {
      // Hide SVG, show the HTML scramble text
      svgEl.style.display = 'none'
      scrambleEl.style.display = 'flex'

      // Init scrambler and run the sequence
      const scrambler = new TextScramble(scrambleEl.querySelector('.scramble-text') as HTMLElement)
      scramblerRef.current = scrambler

      // Scramble through a couple passes then dissolve to empty
      scrambler.setText('V!S#I@N').then(() => {
        setTimeout(() => {
          scrambler.setText('      ').then(() => {
            // Fade out overlay
            overlay.style.transition = `opacity ${T_FADE}ms ease-out`
            overlay.style.opacity = '0'

            setTimeout(() => {
              setIsDone(true)
              cbRef.current()
            }, T_FADE)
          })
        }, 200)
      })
    }, T_DRAW + T_HOLD))

    return () => {
      timers.forEach(clearTimeout)
      scramblerRef.current?.destroy()
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
      {/* Phase 1: SVG path drawing */}
      <svg
        ref={svgRef}
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

      {/* Phase 2: Glitch scramble (hidden until SVG drawing completes) */}
      <div
        ref={scrambleRef}
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          inset: 0,
        }}
      >
        <span
          className="scramble-text"
          style={{
            fontSize:      'clamp(70px, 11vw, 160px)',
            fontWeight:    700,
            color:         'transparent',
            WebkitTextStroke: '2px #c98f0a',
            letterSpacing: '0.25em',
            fontFamily:    'Outfit, sans-serif',
            textTransform: 'uppercase',
            paintOrder:    'stroke fill',
          }}
        >
          VISAION
        </span>
      </div>

      {/* Glitch character styling */}
      <style>{`
        .glitch-dud {
          color: transparent;
          -webkit-text-stroke: 2px #f5c842;
          opacity: 0.7;
        }
      `}</style>
    </div>
  )
}
