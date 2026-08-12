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
  CircleDollarSign,
  Banknote,
} from 'lucide-react'
import { ROLES } from './constants'

/**
 * Navigation items per role.
 * `roles` lists who can access each route.
 * `disabledRoles` keeps the item visible but non-navigable for those roles.
 */
export const NAV_ITEMS = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: [ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER],
    disabledRoles: [ROLES.SUBFRANCHISEE],
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
    icon: Building2,
    roles: [ROLES.SUBFRANCHISEE],
    disabled: true,
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
    roles: [ROLES.FRANCHISEE, ROLES.RETAILER],
  },
  {
    title: 'Token Credits',
    path: '/funding',
    icon: ArrowLeftRight,
    roles: [ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE],
  },
  {
    title: 'Token Credits',
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
    title: 'Revenue',
    path: '/revenue',
    icon: Banknote,
    roles: [ROLES.SUBFRANCHISEE],
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
    roles: [ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER],
  },
]

function isNavItemDisabled(item, role) {
  if (item.disabled) return true
  if (Array.isArray(item.disabledRoles) && item.disabledRoles.includes(role)) {
    return true
  }
  return false
}

export function getNavItemsForRole(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
    ...item,
    disabled: isNavItemDisabled(item, role),
  }))
}

export function getHomePathForRole(role) {
  const items = getNavItemsForRole(role).filter((item) => !item.disabled)
  if (items.length > 0) return items[0].path
  return '/profile'
}

export function canAccessRoute(role, path) {
  if (!role) return false

  // Profile is available to all authenticated users
  if (path === '/profile') {
    return true
  }

  const item = NAV_ITEMS.find((nav) => nav.path === path)
  if (!item) return false
  if (!item.roles.includes(role)) return false
  if (isNavItemDisabled(item, role)) return false
  return true
}

export function getAllowedPaths(role) {
  return getNavItemsForRole(role)
    .filter((item) => !item.disabled)
    .map((item) => item.path)
}
