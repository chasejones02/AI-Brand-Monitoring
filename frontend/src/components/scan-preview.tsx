/**
 * ScanPreview — Animated scan status widget inside the form card.
 * Cycles through 4 phases on a 2.2s interval to simulate live scanning.
 */

import { useState, useEffect } from 'react'

interface ScanPhaseRow {
  dot: string
  text: string
  cls: string
}

// Each phase shows a different stage of the scan cycle
const phases: ScanPhaseRow[][] = [
  [
    { dot: 'active', text: 'mentioned · rank #2', cls: 'found' },
    { dot: 'scanning', text: 'scanning...', cls: 'scanning' },
    { dot: 'pending', text: 'queued', cls: 'pending' },
    { dot: 'pending', text: 'queued', cls: 'pending' },
  ],
  [
    { dot: 'active', text: 'mentioned · rank #2', cls: 'found' },
    { dot: 'active', text: 'found · rank #1', cls: 'found' },
    { dot: 'scanning', text: 'scanning...', cls: 'scanning' },
    { dot: 'pending', text: 'queued', cls: 'pending' },
  ],
  [
    { dot: 'active', text: 'mentioned · rank #2', cls: 'found' },
    { dot: 'active', text: 'found · rank #1', cls: 'found' },
    { dot: 'active', text: 'mentioned · top 5', cls: 'found' },
    { dot: 'scanning', text: 'scanning...', cls: 'scanning' },
  ],
  [
    { dot: 'active', text: 'mentioned · rank #2', cls: 'found' },
    { dot: 'active', text: 'found · rank #1', cls: 'found' },
    { dot: 'active', text: 'mentioned · top 5', cls: 'found' },
    { dot: 'active', text: 'not found', cls: 'pending' },
  ],
]

const platforms = ['ChatGPT', 'Claude', 'Perplexity', 'Gemini']

export function ScanPreview() {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setPhaseIndex(prev => (prev + 1) % phases.length)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  const current = phases[phaseIndex]

  return (
    <div className="scan-preview">
      <div className="scan-preview-label">Live scan preview</div>
      {platforms.map((platform, i) => (
        <div className="scan-row" key={platform}>
          <div className="scan-platform">
            <div className={`scan-dot ${current[i].dot}`}></div>
            {platform}
          </div>
          <span className={`scan-status ${current[i].cls}`}>
            {current[i].text}
          </span>
        </div>
      ))}
    </div>
  )
}
