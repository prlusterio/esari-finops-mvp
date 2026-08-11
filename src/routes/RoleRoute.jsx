import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { canAccessRoute } from '@/lib/permissions'
import UnauthorizedPage from '@/pages/UnauthorizedPage'

/**
 * Role-based route guard. Pass either `roles` or rely on path permission map.
 */
export default function RoleRoute({ roles = [], path }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const allowedByRoles = roles.length === 0 || roles.includes(user.role)
  const allowedByPath = path ? canAccessRoute(user.role, path) : true

  if (!allowedByRoles || !allowedByPath) {
    return <UnauthorizedPage />
  }

  return <Outlet />
}
