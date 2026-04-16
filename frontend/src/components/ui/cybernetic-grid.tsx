import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * CyberneticGrid — Interactive WebGL grid background.
 * Dense dark-grey base grid with sparser orange accent grid.
 * Mouse warps the grid and emits a soft orange glow.
 * Sits full-viewport behind page content (pointer-events: none).
 */
export function CyberneticGrid() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(dpr)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const clock = new THREE.Clock()

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec2 iMouse;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        vec2 uv    = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
        vec2 mouse = (iMouse - 0.5 * iResolution.xy) / iResolution.y;

        float t         = iTime * 0.16;
        float mouseDist = length(uv - mouse);

        // gentle warp around cursor — tight, localized
        float warp = sin(mouseDist * 24.0 - t * 3.0) * 0.022;
        warp *= smoothstep(0.18, 0.0, mouseDist);
        uv += warp;

        // brand palette
        // amber = #f0a500 (primary accent)  deepAmber = #c98f0a (shadow)
        vec3 amber     = vec3(0.941, 0.647, 0.000);
        vec3 deepAmber = vec3(0.788, 0.561, 0.039);
        vec3 warmGrey  = vec3(0.235, 0.220, 0.205);

        // base grid — dense, warm dark grey, very subtle
        float gridFreq = 50.0;
        vec2 gridUv = abs(fract(uv * gridFreq) - 0.5);
        float line  = pow(1.0 - min(gridUv.x, gridUv.y), 60.0);
        vec3 color = warmGrey * line * 0.60;

        // small amber dots at grid intersections — quiet cybernetic texture
        vec2 cell = fract(uv * gridFreq) - 0.5;
        float node = smoothstep(0.12, 0.0, length(cell));
        vec2 cellId = floor(uv * gridFreq);
        float pick = step(0.86, random(cellId));
        color += deepAmber * node * pick * 0.75;

        // cursor region: warm the grid to amber only near the mouse
        float near = smoothstep(0.16, 0.0, mouseDist);
        color += amber * line * near * 0.80;

        // soft amber glow around cursor
        float glow = smoothstep(0.09, 0.0, mouseDist);
        color += vec3(1.0, 0.72, 0.18) * glow * 0.40;

        // subtle film grain
        color += (random(uv + t * 0.1) - 0.5) * 0.025;

        gl_FragColor = vec4(color, 1.0);
      }
    `

    const uniforms = {
      iTime:       { value: 0 },
      iResolution: { value: new THREE.Vector2() },
      iMouse:      { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
    }

    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // gl_FragCoord is in device pixels, so iResolution and iMouse must be too.
    // Multiply CSS pixels by DPR so cursor math aligns on hi-DPI displays.
    const onResize = () => {
      const width  = container.clientWidth || window.innerWidth
      const height = container.clientHeight || window.innerHeight
      renderer.setSize(width, height)
      uniforms.iResolution.value.set(width * dpr, height * dpr)
    }
    window.addEventListener('resize', onResize)
    onResize()

    const onMouseMove = (e: MouseEvent) => {
      const height = container.clientHeight || window.innerHeight
      uniforms.iMouse.value.set(e.clientX * dpr, (height - e.clientY) * dpr)
    }
    window.addEventListener('mousemove', onMouseMove)

    renderer.setAnimationLoop(() => {
      uniforms.iTime.value = clock.getElapsedTime()
      renderer.render(scene, camera)
    })

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.setAnimationLoop(null)
      const canvas = renderer.domElement
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
      material.dispose()
      geometry.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        background: '#080b10',
      }}
    />
  )
}

export default CyberneticGrid
