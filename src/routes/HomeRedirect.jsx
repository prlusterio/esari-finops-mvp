import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getHomePathForRole } from '@/lib/permissions'

/**
 * Sends the signed-in user to their role's first available page.
 */
export default function HomeRedirect() {
  const { user, ready, isAuthenticated } = useAuth()

  if (!ready) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <Navigate to={getHomePathForRole(user?.role)} replace />
}
