import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Store } from 'lucide-react'
import { getNavItemsForRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function SidebarNav({ role, collapsed = false, onNavigate, onToggleCollapse, showCollapse = false }) {
  const items = getNavItemsForRole(role)

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
              <div className="text-xs text-sidebar-foreground/70">FinOps Platform</div>
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
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              title={item.title}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-sidebar-active text-white'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
                )
              }
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
