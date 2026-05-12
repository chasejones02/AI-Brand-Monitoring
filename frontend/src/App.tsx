import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/auth-context'
import { LandingPage } from './pages/landing'
import AuthPage from './pages/auth'
import DashboardPage from './pages/dashboard'
import SuccessPage from './pages/success'
import PricingPage from './pages/pricing'
import AnalyzePage from './pages/analyze'
import AccountPage from './pages/account'
import { EyeballIntro } from './components/eyeball-intro'

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
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/pricing" element={<PricingPage />} />
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
    <BrowserRouter>
      <AuthProvider>
        {!introShown && <EyeballIntro onComplete={handleIntroComplete} />}
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
