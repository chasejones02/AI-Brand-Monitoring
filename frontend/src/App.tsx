import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/auth-context'
import { LandingPage } from './pages/landing'
import AuthPage from './pages/auth'
import DashboardPage from './pages/dashboard'
import SuccessPage from './pages/success'
import PricingPage from './pages/pricing'
import { EyeballIntro } from './components/eyeball-intro'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
