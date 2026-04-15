/**
 * Auth page — Glassmorphism login over animated shader background.
 * Flow: Sign in / Sign up → card flips → business details → dashboard
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'
import { createBusiness } from '../lib/api'
import { Nav } from '../components/nav'
import { LoginForm } from '../components/ui/login-form'
import { AnimatedShaderBackground } from '../components/ui/animated-shader-background'

export default function AuthPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const isRecovery = useRef(false)

  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session && !isRecovery.current && !flipped) {
      navigate('/dashboard', { replace: true })
    }
  }, [session, navigate, flipped])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecovery.current = true
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSignIn(email: string, password: string) {
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(email: string, password: string, fullName: string) {
    setError('')
    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (signUpError) throw signUpError

      if (!data.session) {
        setError('Check your email for a confirmation link, then come back and sign in.')
        setLoading(false)
        return
      }

      setFlipped(true)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleBusinessSubmit(data: { name: string; location: string; description: string }) {
    try {
      const queries = [
        `best ${data.name} in ${data.location}`,
        `${data.name} ${data.location} reviews`,
        `${data.name} recommendations`,
      ]
      await createBusiness({
        name: data.name,
        industry: data.description || undefined,
        queries,
      })
      navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: '#07090d' }}>
      {/* Orange aurora shader — fixed, full viewport, non-interactive */}
      <AnimatedShaderBackground />

      {/* Vignette + readability layer */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'radial-gradient(120% 80% at 50% 40%, rgba(7,9,13,0) 0%, rgba(7,9,13,0.45) 60%, rgba(7,9,13,0.85) 100%)',
        }}
      />

      <Nav />

      {/* Centered form */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '6rem 2rem 3rem',
        }}
      >
        <LoginForm
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          onBusinessSubmit={handleBusinessSubmit}
          flipped={flipped}
          error={error}
          loading={loading}
        />
      </div>
    </div>
  )
}
