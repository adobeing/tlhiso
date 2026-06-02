// Route guards, layered from least to most restrictive:
//   PrivateRoute      → must be signed in
//   ActiveUserRoute   → + Firestore profile.isActive === true
//   IndustryRoute     → + profile.industry matches this dashboard
//   SuperAdminRoute   → email is the super-admin (or isAdmin custom claim)
//
// Each waits for AuthContext.loading to settle before deciding, so we never
// bounce a valid user mid-load.
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { dashboardPathFor } from '../utils/industries'
import Spinner from '../components/shared/Spinner'

export function PrivateRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Checking your session…" />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}

export function ActiveUserRoute() {
  const { isAuthenticated, isActive, isSuperAdmin, loading } = useAuth()
  if (loading) return <Spinner label="Checking your account…" />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Super admin bypasses the activation gate.
  if (!isActive && !isSuperAdmin) {
    return <Navigate to="/pending-activation" replace />
  }
  return <Outlet />
}

export function IndustryRoute({ industry }) {
  const { isAuthenticated, isActive, industry: userIndustry, isSuperAdmin, loading } = useAuth()
  if (loading) return <Spinner label="Loading your workspace…" />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isActive && !isSuperAdmin) return <Navigate to="/pending-activation" replace />
  // Wrong vertical → redirect to the user's own dashboard rather than 404.
  if (!isSuperAdmin && userIndustry && userIndustry !== industry) {
    return <Navigate to={dashboardPathFor(userIndustry)} replace />
  }
  return <Outlet />
}

export function SuperAdminRoute() {
  const { isAuthenticated, isSuperAdmin, loading } = useAuth()
  if (loading) return <Spinner label="Verifying admin access…" />
  if (!isAuthenticated || !isSuperAdmin) return <Navigate to="/login" replace />
  return <Outlet />
}
