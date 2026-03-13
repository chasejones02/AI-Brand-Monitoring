/**
 * useScrollReveal — Fade + rise animation as elements enter viewport.
 *
 * Replicates the vanilla JS IntersectionObserver from main.js.
 * Call once from the landing page after mount.
 */

import { useEffect } from 'react'

const revealGroups = [
  { sel: '.ticker-wrap', stagger: 0 },
  { sel: '.section-label', stagger: 0 },
  { sel: '.section h2', stagger: 0.08 },
  { sel: '.section-sub', stagger: 0.14 },
  { sel: '.steps-grid', stagger: 0 },
  { sel: '.step', stagger: 0.12 },
  { sel: '.report-preview', stagger: 0 },
  { sel: '.report-point', stagger: 0.1 },
  { sel: '.pricing-card', stagger: 0.1 },
  { sel: '.cta-section h2', stagger: 0 },
  { sel: '.cta-section > .container > p', stagger: 0.08 },
  { sel: '.cta-form', stagger: 0.14 },
]

export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -36px 0px' }
    )

    revealGroups.forEach(({ sel, stagger }) => {
      document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
        // Skip hero elements — they use CSS load animations
        if (el.closest('.hero')) return
        const delay = i * stagger
        el.style.opacity = '0'
        el.style.transform = 'translateY(22px)'
        el.style.transition = `opacity 0.65s cubic-bezier(.22,1,.36,1) ${delay}s, transform 0.65s cubic-bezier(.22,1,.36,1) ${delay}s`
        observer.observe(el)
      })
    })

    return () => observer.disconnect()
  }, [])
}
