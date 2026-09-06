import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  BookOpen,
  FileSpreadsheet,
  LogOut,
  Menu,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  ADMIN_USER_GUIDE_HREF,
  COMPUTATIONS_XLSX_HREF,
  ROLE_LABELS,
  ROLES,
  USER_GUIDE_HREF,
} from '@/lib/constants'
import { SidebarNav } from '@/components/shared/SidebarNav'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export default function AppLayout() {
  const { user, organization, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 transition-all duration-200 lg:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <SidebarNav
          role={user?.role}
          collapsed={collapsed}
          showCollapse
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-sidebar-accent bg-sidebar p-0 text-sidebar-foreground"
          closeClassName="text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav
            role={user?.role}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <div className="text-xs text-muted-foreground">Organization</div>
              <div className="text-sm font-medium text-foreground">
                {organization?.name || 'Unknown Organization'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <Badge variant="secondary">{ROLE_LABELS[user?.role] || user?.role}</Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <UserRound className="h-4 w-4" />
                  <span className="hidden max-w-[140px] truncate sm:inline">
                    {user?.name}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="truncate font-medium">{user?.name}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <UserRound className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={USER_GUIDE_HREF}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4" />
                    User Guide
                  </a>
                </DropdownMenuItem>
                {user?.role === ROLES.ADMIN ? (
                  <DropdownMenuItem asChild>
                    <a
                      href={ADMIN_USER_GUIDE_HREF}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer"
                    >
                      <BookOpen className="h-4 w-4" />
                      Admin User Guide
                    </a>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <a
                    href={COMPUTATIONS_XLSX_HREF}
                    download="esari-computations.xlsx"
                    className="cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Download computations (Excel)
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet key={user?.id || 'guest'} />
        </main>
      </div>
    </div>
  )
}
