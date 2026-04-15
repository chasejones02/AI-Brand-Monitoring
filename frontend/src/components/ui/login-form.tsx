import { useEffect, useRef, useState } from 'react'
import { User, Lock, ArrowRight, Building2, MapPin, FileText } from 'lucide-react'

/* ─── WebGL Shader ─────────────────────────────────── */
const vertexSrc = `
  attribute vec4 a_position;
  void main() { gl_Position = a_position; }
`

const fragmentSrc = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 u_color;

void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / min(iResolution.x, iResolution.y);
    float t = iTime * 0.4;
    vec2 d = uv;
    for (float i = 1.0; i < 8.0; i++) {
        d.x += 0.5 / i * cos(i * 2.0 * d.y + t);
        d.y += 0.5 / i * cos(i * 2.0 * d.x + t);
    }
    float wave = abs(sin(d.x + d.y + t));
    float glow = smoothstep(0.9, 0.15, wave);
    gl_FragColor = vec4(u_color * glow, 1.0);
}
`

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.substring(1, 3), 16) / 255,
    parseInt(hex.substring(3, 5), 16) / 255,
    parseInt(hex.substring(5, 7), 16) / 255,
  ]
}

/* ─── Smokey Background ────────────────────────────── */
export function SmokeyBackground({ color = '#c98f0a' }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl')
    if (!gl) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) return null
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null }
      return s
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSrc)
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc)
    if (!vs || !fs) return

    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'iResolution')
    const uTime = gl.getUniformLocation(prog, 'iTime')
    const uColor = gl.getUniformLocation(prog, 'u_color')

    const [r, g, b] = hexToRgb(color)
    gl.uniform3f(uColor, r, g, b)
    const start = Date.now()

    let raf: number
    const render = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uTime, (Date.now() - start) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      raf = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(raf)
  }, [color])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />
      {/* Soft blur overlay for depth */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 0,
        }}
      />
    </>
  )
}

/* ─── Floating Label Input ─────────────────────────── */
function FloatingInput({
  icon: Icon,
  label,
  type = 'text',
  value,
  onChange,
  required = true,
  minLength,
}: {
  icon: typeof User
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  minLength?: number
}) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0

  return (
    <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: active ? '-2px' : '12px',
          fontSize: active ? '0.72rem' : '0.9rem',
          color: focused ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'all 0.25s ease',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Icon size={14} />
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        minLength={minLength}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${focused ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
          color: 'var(--text)',
          fontSize: '0.95rem',
          fontFamily: "'Outfit', sans-serif",
          padding: '12px 0 8px',
          outline: 'none',
          transition: 'border-color 0.25s',
        }}
      />
    </div>
  )
}

/* ─── Floating Label Textarea ──────────────────────── */
function FloatingTextarea({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof FileText
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0

  return (
    <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: active ? '-2px' : '12px',
          fontSize: active ? '0.72rem' : '0.9rem',
          color: focused ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'all 0.25s ease',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Icon size={14} />
        {label}
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={2}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${focused ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
          color: 'var(--text)',
          fontSize: '0.95rem',
          fontFamily: "'Outfit', sans-serif",
          padding: '12px 0 8px',
          outline: 'none',
          resize: 'none',
          transition: 'border-color 0.25s',
        }}
      />
    </div>
  )
}

/* ─── Glass Card ───────────────────────────────────── */
const glassCard: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  padding: '2.75rem 2.5rem',
  background:
    'linear-gradient(155deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 45%, rgba(13,17,23,0.55) 100%)',
  backdropFilter: 'blur(28px) saturate(140%)',
  WebkitBackdropFilter: 'blur(28px) saturate(140%)',
  borderRadius: '22px',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow:
    '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.18) inset, 0 0 120px rgba(201,143,10,0.08)',
  backfaceVisibility: 'hidden',
}

/* ─── Submit Button ────────────────────────────────── */
function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '0.85rem 1.5rem',
        background: 'var(--accent)',
        color: '#07090d',
        border: 'none',
        borderRadius: '10px',
        fontSize: '0.95rem',
        fontWeight: 700,
        fontFamily: "'Outfit', sans-serif",
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'all 0.25s',
        marginTop: '0.5rem',
      }}
    >
      {loading ? (
        <>
          <span
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(7,9,13,0.3)',
              borderTopColor: '#07090d',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
              display: 'inline-block',
            }}
          />
          {loadingLabel}
        </>
      ) : (
        <>
          {label}
          <ArrowRight size={18} />
        </>
      )}
    </button>
  )
}

/* ─── LoginForm (Flipping Card) ────────────────────── */
interface LoginFormProps {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string, fullName: string) => Promise<void>
  onBusinessSubmit: (data: { name: string; location: string; description: string }) => Promise<void>
  flipped: boolean
  error?: string
  loading?: boolean
}

export function LoginForm({ onSignIn, onSignUp, onBusinessSubmit, flipped, error, loading }: LoginFormProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [bizName, setBizName] = useState('')
  const [bizLocation, setBizLocation] = useState('')
  const [bizDesc, setBizDesc] = useState('')
  const [bizLoading, setBizLoading] = useState(false)

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'signup') onSignUp(email, password, fullName)
    else onSignIn(email, password)
  }

  const handleBusiness = async (e: React.FormEvent) => {
    e.preventDefault()
    setBizLoading(true)
    try { await onBusinessSubmit({ name: bizName, location: bizLocation, description: bizDesc }) }
    finally { setBizLoading(false) }
  }

  return (
    <div style={{ width: '100%', maxWidth: '420px', perspective: '1200px' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.7s ease-in-out',
        }}
      >
        {/* ── FRONT: Auth ── */}
        <div style={glassCard}>
          {/* Mode toggle */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '10px',
              padding: '3px',
              marginBottom: '2rem',
            }}
          >
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: '0.55rem 1rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: mode === m ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: mode === m ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: '0.875rem',
                  fontWeight: mode === m ? 600 : 400,
                  fontFamily: "'Outfit', sans-serif",
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--text)',
                fontFamily: "'Outfit', sans-serif",
                marginBottom: '0.3rem',
              }}
            >
              {mode === 'login' ? 'Welcome Back' : 'Get Started'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {mode === 'login' ? 'Sign in to your dashboard' : 'Create your account to begin'}
            </p>
          </div>

          <form onSubmit={handleAuth}>
            {mode === 'signup' && (
              <FloatingInput icon={User} label="Full Name" value={fullName} onChange={setFullName} />
            )}
            <FloatingInput icon={User} label="Email Address" type="email" value={email} onChange={setEmail} />
            <FloatingInput
              icon={Lock}
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              minLength={mode === 'signup' ? 8 : undefined}
            />

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.9rem',
                  color: 'var(--red)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            <SubmitButton
              loading={!!loading}
              label={mode === 'signup' ? 'Create Account' : 'Sign In'}
              loadingLabel={mode === 'signup' ? 'Creating account...' : 'Signing in...'}
            />
          </form>

          <p
            style={{
              marginTop: '1.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            By continuing you agree to our{' '}
            <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Terms</a> &{' '}
            <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Privacy</a>.
          </p>
        </div>

        {/* ── BACK: Business details ── */}
        <div
          style={{
            ...glassCard,
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'rotateY(180deg)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--text)',
                fontFamily: "'Outfit', sans-serif",
                marginBottom: '0.3rem',
              }}
            >
              Your Business
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              We'll track how AI platforms mention you
            </p>
          </div>

          <form onSubmit={handleBusiness}>
            <FloatingInput icon={Building2} label="Business Name" value={bizName} onChange={setBizName} />
            <FloatingInput icon={MapPin} label="Location (city, state)" value={bizLocation} onChange={setBizLocation} />
            <FloatingTextarea icon={FileText} label="Description (optional)" value={bizDesc} onChange={setBizDesc} />
            <SubmitButton loading={bizLoading} label="Continue to Dashboard" loadingLabel="Setting up..." />
          </form>
        </div>
      </div>
    </div>
  )
}
