/**
 * Auth page — Glassmorphism login over animated shader background.
 * Flow: Sign in / Sign up → card flips → business details → dashboard
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'
import { createBusiness, triggerScan } from '../lib/api'
import { Nav } from '../components/nav'
import { LoginForm } from '../components/ui/login-form'
import { CrystalCursor } from '../components/crystal-cursor'

export default function AuthPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const isRecovery = useRef(false)

  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
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

  function handleClearError() {
    setError('')
    setSuccessMessage('')
  }

  async function handleForgotPassword(email: string) {
    if (!email.trim()) {
      setError('Enter your email address first')
      return
    }
    setError('')
    setSuccessMessage('')
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth',
      })
      if (resetError) throw resetError
      setSuccessMessage('Check your email for a reset link')
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    })
    if (oauthError) {
      setError(oauthError.message ?? 'Google sign-in failed')
    }
  }

  async function handleSignIn(email: string, password: string) {
    setError('')
    setSuccessMessage('')
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
    setSuccessMessage('')
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
      const { business_id } = await createBusiness({
        name: data.name,
        location: data.location,
        description: data.description || undefined,
        generate_queries: true,
        query_count: 5,
      })
      const { scan_id } = await triggerScan(business_id)
      navigate(`/dashboard?scanId=${scan_id}`)
    } catch {
      navigate('/dashboard')
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Grid + crystal cursor background (matches landing page bottom) */}
      <div className="landing-clean-bg" aria-hidden />
      <CrystalCursor active />

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

      <Nav authPage />

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
          onForgotPassword={handleForgotPassword}
          onGoogleSignIn={handleGoogleSignIn}
          flipped={flipped}
          error={error}
          successMessage={successMessage}
          loading={loading}
          onClearError={handleClearError}
        />
      </div>
    </div>
  )
}
