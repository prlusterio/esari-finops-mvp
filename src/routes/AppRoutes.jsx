import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLES } from '@/lib/constants'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import RoleRoute from '@/routes/RoleRoute'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import OrganizationsPage from '@/pages/organizations/OrganizationsPage'
import WalletsPage from '@/pages/wallets/WalletsPage'
import WalletPage from '@/pages/wallet/WalletPage'
import FundingPage from '@/pages/funding/FundingPage'
import RequestFundingPage from '@/pages/request-funding/RequestFundingPage'
import RevenueSharingPage from '@/pages/revenue-sharing/RevenueSharingPage'
import TransactionsPage from '@/pages/transactions/TransactionsPage'
import SettlementsPage from '@/pages/settlements/SettlementsPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import FranchiseesPage from '@/pages/franchisees/FranchiseesPage'
import RetailersPage from '@/pages/retailers/RetailersPage'
import ProfilePage from '@/pages/profile/ProfilePage'
import UnauthorizedPage from '@/pages/UnauthorizedPage'

function PublicOnly({ children }) {
  const { isAuthenticated, ready } = useAuth()
  if (!ready) return null
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        element={
          <PublicOnly>
            <AuthLayout />
          </PublicOnly>
        }
      >
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route element={<RoleRoute roles={[ROLES.ADMIN]} path="/organizations" />}>
            <Route path="/organizations" element={<OrganizationsPage />} />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.ADMIN]} path="/wallets" />}>
            <Route path="/wallets" element={<WalletsPage />} />
          </Route>

          <Route
            element={
              <RoleRoute
                roles={[ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER]}
                path="/wallet"
              />
            }
          >
            <Route path="/wallet" element={<WalletPage />} />
          </Route>

          <Route
            element={
              <RoleRoute
                roles={[ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE]}
                path="/funding"
              />
            }
          >
            <Route path="/funding" element={<FundingPage />} />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.RETAILER]} path="/request-funding" />}>
            <Route path="/request-funding" element={<RequestFundingPage />} />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.ADMIN]} path="/revenue-sharing" />}>
            <Route path="/revenue-sharing" element={<RevenueSharingPage />} />
          </Route>

          <Route
            element={
              <RoleRoute
                roles={[ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER]}
                path="/transactions"
              />
            }
          >
            <Route path="/transactions" element={<TransactionsPage />} />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.ADMIN]} path="/settlements" />}>
            <Route path="/settlements" element={<SettlementsPage />} />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.ADMIN]} path="/reports" />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.SUBFRANCHISEE]} path="/franchisees" />}>
            <Route path="/franchisees" element={<FranchiseesPage />} />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.FRANCHISEE]} path="/retailers" />}>
            <Route path="/retailers" element={<RetailersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
