import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLES } from '@/lib/constants'
import { getHomePathForRole } from '@/lib/permissions'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import RoleRoute from '@/routes/RoleRoute'
import HomeRedirect from '@/routes/HomeRedirect'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import OrganizationsPage from '@/pages/organizations/OrganizationsPage'
import OnboardingStep1Page from '@/pages/onboarding/OnboardingStep1Page'
import OnboardingStep2Page from '@/pages/onboarding/OnboardingStep2Page'
import OnboardingStep3Page from '@/pages/onboarding/OnboardingStep3Page'
import OnboardingStep4Page from '@/pages/onboarding/OnboardingStep4Page'
import ClientsPage from '@/pages/clients/ClientsPage'
import ClientDetailPage from '@/pages/clients/ClientDetailPage'
import WalletsPage from '@/pages/wallets/WalletsPage'
import WalletManagementPage from '@/pages/wallets/WalletManagementPage'
import WalletPage from '@/pages/wallet/WalletPage'
import FundingPage from '@/pages/funding/FundingPage'
import RequestFundingPage from '@/pages/request-funding/RequestFundingPage'
import RevenuePage from '@/pages/revenue/RevenuePage'
import DepositRatesPage from '@/pages/deposit-rates/DepositRatesPage'
import CommissionSettingsPage from '@/pages/commission-settings/CommissionSettingsPage'
import TransactionsPage from '@/pages/transactions/TransactionsPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import RetailersPage from '@/pages/retailers/RetailersPage'
import ProfilePage from '@/pages/profile/ProfilePage'
import UnauthorizedPage from '@/pages/UnauthorizedPage'

function PublicOnly({ children }) {
  const { user, isAuthenticated, ready } = useAuth()
  if (!ready) return null
  if (isAuthenticated) {
    return <Navigate to={getHomePathForRole(user?.role)} replace />
  }
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
          <Route path="/" element={<HomeRedirect />} />
          <Route
            element={
              <RoleRoute roles={[ROLES.ADMIN]} path="/dashboard" />
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route element={<RoleRoute roles={[ROLES.ADMIN]} path="/organizations" />}>
            <Route path="/organizations" element={<OrganizationsPage />} />
          </Route>

          <Route
            element={
              <RoleRoute
                roles={[ROLES.ADMIN]}
                path="/franchise-setup/clients"
              />
            }
          >
            <Route
              path="/franchise-setup/onboarding/step-1"
              element={<OnboardingStep1Page />}
            />
            <Route
              path="/franchise-setup/onboarding/step-2"
              element={<OnboardingStep2Page />}
            />
            <Route
              path="/franchise-setup/onboarding/step-3"
              element={<OnboardingStep3Page />}
            />
            <Route
              path="/franchise-setup/onboarding/step-4"
              element={<OnboardingStep4Page />}
            />
          </Route>

          <Route
            element={
              <RoleRoute roles={[ROLES.ADMIN]} path="/franchise-setup/clients" />
            }
          >
            <Route path="/franchise-setup/clients" element={<ClientsPage />} />
            <Route
              path="/franchise-setup/clients/:clientId"
              element={<ClientDetailPage />}
            />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.ADMIN]} path="/wallets" />}>
            <Route path="/wallets" element={<WalletsPage />} />
          </Route>

          <Route
            element={
              <RoleRoute
                roles={[ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE]}
                path="/wallet-management"
              />
            }
          >
            <Route
              path="/wallet-management"
              element={<WalletManagementPage />}
            />
          </Route>

          <Route
            element={
              <RoleRoute roles={[ROLES.RETAILER]} path="/wallet" />
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

          <Route
            path="/revenue-sharing"
            element={<Navigate to="/commission-settings" replace />}
          />

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

          <Route
            element={
              <RoleRoute
                roles={[ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER]}
                path="/revenue"
              />
            }
          >
            <Route path="/revenue" element={<RevenuePage />} />
          </Route>

          <Route
            element={
              <RoleRoute
                roles={[ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE]}
                path="/deposit-rates"
              />
            }
          >
            <Route path="/deposit-rates" element={<DepositRatesPage />} />
          </Route>

          <Route
            element={
              <RoleRoute
                roles={[ROLES.ADMIN, ROLES.SUBFRANCHISEE]}
                path="/commission-settings"
              />
            }
          >
            <Route
              path="/commission-settings"
              element={<CommissionSettingsPage />}
            />
          </Route>

          <Route
            element={
              <RoleRoute
                roles={[ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER]}
                path="/reports"
              />
            }
          >
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<RoleRoute roles={[ROLES.FRANCHISEE]} path="/retailers" />}>
            <Route path="/retailers" element={<RetailersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
