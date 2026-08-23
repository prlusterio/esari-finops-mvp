import { NavLink, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Store } from 'lucide-react'
import { ROLE_LABELS, ROLES } from '@/lib/constants'
import { getNavItemsForRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

function getPlatformSubtitle(role) {
  if (role === ROLES.ADMIN) return 'Admin'
  if (role === ROLES.RETAILER) return 'Retailer'
  if (role === ROLES.FRANCHISEE) return 'Franchisee Platform'
  if (role === ROLES.SUBFRANCHISEE) return 'Sub-Franchisee Platform'
  return ROLE_LABELS[role] || 'FinOps Platform'
}

export function SidebarNav({ role, collapsed = false, onNavigate, onToggleCollapse, showCollapse = false }) {
  const items = getNavItemsForRole(role)
  const platformSubtitle = getPlatformSubtitle(role)
  const { pathname } = useLocation()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-accent px-4',
          collapsed ? 'justify-center' : 'justify-between gap-2',
        )}
      >
        <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-wallet text-white">
            <Store className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold text-white">eSariSari</div>
              <div className="text-xs text-sidebar-foreground/70">
                {platformSubtitle}
              </div>
            </div>
          )}
        </div>
        {showCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-white lg:inline-flex"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon
          if (item.disabled) {
            return (
              <div
                key={item.path}
                title={`${item.title} (coming soon)`}
                aria-disabled="true"
                className={cn(
                  'flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/40',
                  collapsed && 'justify-center px-2',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </div>
            )
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              title={item.title}
              className={({ isActive }) => {
                const active = item.activePathPrefix
                  ? pathname.startsWith(item.activePathPrefix)
                  : isActive
                return cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  collapsed && 'justify-center px-2',
                  active
                    ? 'bg-sidebar-active text-white'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
                )
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
