import { useRef, useState, useCallback } from 'react'

interface TiltCardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  maxTilt?: number
}

export function TiltCard({
  children,
  className,
  style,
  maxTilt = 8,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const rotateY = ((e.clientX - cx) / (rect.width / 2)) * maxTilt
      const rotateX = ((cy - e.clientY) / (rect.height / 2)) * maxTilt
      setTilt({ x: rotateX, y: rotateY })
    },
    [maxTilt],
  )

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: 'preserve-3d' as const,
        willChange: 'transform',
        transition:
          'transform 0.4s cubic-bezier(.22, 1, .36, 1), border-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      {children}
    </div>
  )
}
