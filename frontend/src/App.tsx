import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sentry } from './lib/sentry'
import { AuthProvider, useAuth } from './contexts/auth-context'
import { LandingPage } from './pages/landing'
import AuthPage from './pages/auth'
import DashboardPage from './pages/dashboard'
import SuccessPage from './pages/success'
import PricingPage from './pages/pricing'
import AnalyzePage from './pages/analyze'
import AccountPage from './pages/account'
import PreviewPage from './pages/preview'
import { PrivacyPage, TermsPage } from './pages/legal'
import { EyeballIntro } from './components/eyeball-intro'

function ErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '440px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '40px', lineHeight: 1.1, marginBottom: '16px' }}>
          Something went wrong.
        </div>
        <div style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
          We've been notified and will look into it. Try reloading — if it keeps happening, drop us a line.
        </div>
        <button
          onClick={() => { resetError(); window.location.reload() }}
          style={{
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            padding: '10px 20px',
            fontFamily: 'inherit',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return (
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
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/analyze" element={<AnalyzePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/preview/:businessId"
        element={
          <ProtectedRoute>
            <PreviewPage />
          </ProtectedRoute>
        }
      />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const [introShown, setIntroShown] = useState(false)

  function handleIntroComplete() {
    setIntroShown(true)
  }

  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
      <BrowserRouter>
        <AuthProvider>
          {!introShown && <EyeballIntro onComplete={handleIntroComplete} />}
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  )
}
