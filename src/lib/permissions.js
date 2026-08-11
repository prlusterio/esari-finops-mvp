import {
  LayoutDashboard,
  Building2,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Receipt,
  Scale,
  FileBarChart,
  Store,
  Users,
  CircleDollarSign,
} from 'lucide-react'
import { ROLES } from './constants'

/**
 * Navigation items per role.
 * `roles` lists who can access each route.
 */
export const NAV_ITEMS = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: [ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER],
  },
  {
    title: 'Organizations',
    path: '/organizations',
    icon: Building2,
    roles: [ROLES.ADMIN],
  },
  {
    title: 'Franchisees',
    path: '/franchisees',
    icon: Users,
    roles: [ROLES.SUBFRANCHISEE],
  },
  {
    title: 'Retailers',
    path: '/retailers',
    icon: Store,
    roles: [ROLES.FRANCHISEE],
  },
  {
    title: 'Wallets',
    path: '/wallets',
    icon: Wallet,
    roles: [ROLES.ADMIN],
  },
  {
    title: 'Wallet',
    path: '/wallet',
    icon: Wallet,
    roles: [ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER],
  },
  {
    title: 'Funding Requests & Transfers',
    path: '/funding',
    icon: ArrowLeftRight,
    roles: [ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE],
  },
  {
    title: 'Request Funding',
    path: '/request-funding',
    icon: CircleDollarSign,
    roles: [ROLES.RETAILER],
  },
  {
    title: 'Revenue Sharing',
    path: '/revenue-sharing',
    icon: PieChart,
    roles: [ROLES.ADMIN],
  },
  {
    title: 'Transactions',
    path: '/transactions',
    icon: Receipt,
    roles: [ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER],
  },
  {
    title: 'Settlements',
    path: '/settlements',
    icon: Scale,
    roles: [ROLES.ADMIN],
  },
  {
    title: 'Reports',
    path: '/reports',
    icon: FileBarChart,
    roles: [ROLES.ADMIN],
  },
]

export function getNavItemsForRole(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function canAccessRoute(role, path) {
  if (!role) return false

  // Profile is available to all authenticated users
  if (path === '/profile' || path === '/dashboard') {
    return true
  }

  const item = NAV_ITEMS.find((nav) => nav.path === path)
  if (!item) return false
  return item.roles.includes(role)
}

export function getAllowedPaths(role) {
  return getNavItemsForRole(role).map((item) => item.path)
}
