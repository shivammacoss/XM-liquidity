/**
 * XMLiquidity — Protected Route
 * Redirects to /signin if not authenticated.
 * Checks auth state from Redux store (populated from server).
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'

export default function ProtectedRoute({ children, requiredRoles }) {
  const { isAuthenticated, user, isLoading } = useSelector((state) => state.auth)
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  // Role-based access — check server-verified role from Redux (fetched via /me)
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
