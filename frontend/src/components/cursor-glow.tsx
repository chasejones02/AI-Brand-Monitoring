/**
 * CursorGlow — fixed, viewport-wide orange halo that tracks the pointer.
 * Same spirit as the GlowCard spotlight, applied to the whole landing page.
 * pointer-events: none so it never swallows clicks or hover.
 */

import { useEffect, useRef } from 'react'

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect reduced-motion users — skip tracking, leave element hidden.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let raf = 0
    let x = -9999
    let y = -9999

    const apply = () => {
      raf = 0
      el.style.setProperty('--cg-x', `${x}px`)
      el.style.setProperty('--cg-y', `${y}px`)
      el.style.opacity = '1'
    }

    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }

    const onLeave = () => {
      el.style.opacity = '0'
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return <div ref={ref} className="cursor-glow" aria-hidden />
}
