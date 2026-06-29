/**
 * Auth page — Glassmorphism login over animated shader background.
 * Flow: Sign in / Sign up → card flips → business details → dashboard
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'
import { createBusiness } from '../lib/api'
import { Nav } from '../components/nav'
import { LoginForm } from '../components/ui/login-form'
import { CrystalCursor } from '../components/crystal-cursor'

export default function AuthPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isRecovery = useRef(false)
  // Captured at first render, before supabase-js clears the URL hash, so we can
  // detect an expired/invalid reset link (which arrives as an error in the hash
  // rather than a PASSWORD_RECOVERY event).
  const initialHash = useRef(window.location.hash)
  const initialIsOnline = searchParams.get('is_online') === 'true'
  const initialBusiness = {
    name: searchParams.get('name') ?? '',
    location: searchParams.get('location') ?? '',
    description: searchParams.get('description') ?? '',
    isOnline: initialIsOnline,
  }
  // Online businesses carry no location, so it's only part of the intent
  // when the business isn't online.
  const hasBusinessIntent = Boolean(
    initialBusiness.name.trim() &&
    initialBusiness.description.trim() &&
    (initialBusiness.location.trim() || initialIsOnline)
  )

  const [flipped, setFlipped] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session && !isRecovery.current && !flipped) {
      if (hasBusinessIntent) {
        setFlipped(true)
        return
      }
      navigate('/dashboard', { replace: true })
    }
  }, [session, navigate, flipped, hasBusinessIntent])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Ref updates synchronously so the redirect guard above sees it before
        // its effect runs; the state drives the new-password form render.
        isRecovery.current = true
        setRecovery(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // An expired or already-used reset link sends the user back here with an
    // error in the URL hash instead of a recovery session. Surface a clear
    // message so they request a fresh link rather than facing a bare form.
    const raw = initialHash.current.replace(/^#/, '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    if (!params.get('error') && !params.get('error_code')) return

    const code = params.get('error_code')
    const desc = params.get('error_description')
    if (code === 'otp_expired' || code === 'access_denied') {
      setError('This password reset link has expired or was already used. Request a new one below.')
    } else {
      setError(desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'This link is invalid. Request a new one below.')
    }
    // Strip the error from the URL so a refresh doesn't re-trigger it.
    window.history.replaceState(null, '', window.location.pathname)
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

  async function handleSetNewPassword(newPassword: string) {
    setError('')
    setSuccessMessage('')
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      // Recovery is complete — drop the recovery guard so the redirect effect
      // takes the now-authenticated user to their dashboard.
      isRecovery.current = false
      setRecovery(false)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    // Preserve the business intent across the OAuth round-trip, including the
    // online flag (which replaces the missing location for online businesses).
    const businessParams = new URLSearchParams({
      name: initialBusiness.name,
      location: initialBusiness.location,
      description: initialBusiness.description,
      ...(initialIsOnline ? { is_online: 'true' } : {}),
    })
    const redirectTo = hasBusinessIntent
      ? `${window.location.origin}/auth?${businessParams.toString()}`
      : `${window.location.origin}/dashboard`

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
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

      // Email confirmation is disabled in Supabase, so signUp returns a session
      // immediately and we go straight to the business step. Guard the rare
      // case where a session isn't returned so the user isn't left stranded.
      if (!data.session) {
        setError('Account created — please sign in to continue.')
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

  async function handleBusinessSubmit(data: { name: string; location: string; description: string; isOnline: boolean }) {
    try {
      if (data.description.trim().length < 10) {
        setError('Add a short description of what your business does.')
        return
      }
      const { business_id, default_set_id, tier, queries } = await createBusiness({
        name: data.name,
        description: data.description,
        generate_queries: true,
        query_count: 5,
        ...(data.isOnline ? { is_online: true } : { location: data.location }),
      })
      navigate(`/preview/${business_id}`, {
        state: { queries, tier, defaultSetId: default_set_id },
      })
    } catch {
      navigate('/dashboard')
    }
  }

  // Already signed in — show a spinner while the redirect fires so the
  // login form never flashes in front of a logged-in user.
  if (session && !isRecovery.current && !flipped && !hasBusinessIntent) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          border: '2px solid #1e2b3a',
          borderTopColor: '#c98f0a',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
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
          recovery={recovery}
          onSetNewPassword={handleSetNewPassword}
          flipped={flipped}
          initialBusiness={initialBusiness}
          error={error}
          successMessage={successMessage}
          loading={loading}
          onClearError={handleClearError}
        />
      </div>
    </div>
  )
}
