import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { WALLET_BALANCE_STATUS } from '@/lib/wallets'
import {
  buildNotifications,
  NOTIFICATION_KIND,
} from '@/lib/notifications'
import {
  getFundingRequests,
  getNotificationReads,
  getOrganizations,
  getWallets,
  markNotificationsRead,
} from '@/services/storage'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function notificationDotClass(item) {
  if (item.kind === NOTIFICATION_KIND.CREDIT_REQUEST) {
    return 'bg-blue-500'
  }
  if (item.status === WALLET_BALANCE_STATUS.ZERO) {
    return 'bg-red-500'
  }
  return 'bg-amber-500'
}

export function NotificationBell() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const navigate = useNavigate()

  const notifications = useMemo(() => {
    return buildNotifications({
      organizations: getOrganizations(),
      wallets: getWallets(),
      fundingRequests: getFundingRequests(),
      recipientOrganizationId: user?.organizationId,
      recipientRole: user?.role,
      reads: getNotificationReads(),
    })
  }, [user?.organizationId, user?.role, dataVersion])

  const unreadCount = notifications.filter((item) => !item.read).length

  const markRead = (ids) => {
    markNotificationsRead(user?.organizationId, ids)
    bumpDataVersion()
  }

  const handleOpen = (item) => {
    markRead([item.id])
    if (item.href) navigate(item.href)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 ? (
            <DropdownMenuItem
              className="h-auto min-h-0 w-auto justify-end px-0 py-0 text-xs font-medium text-blue-600 hover:bg-transparent focus:bg-transparent focus:text-blue-700"
              onSelect={(event) => {
                event.preventDefault()
                markRead(
                  notifications
                    .filter((item) => !item.read)
                    .map((item) => item.id),
                )
              }}
            >
              Mark all as read
            </DropdownMenuItem>
          ) : null}
        </div>
        <p className="px-3 pb-2 text-[11px] text-muted-foreground">
          Pending Internet Credits requests from downlines, and low-balance
          alerts.
        </p>
        <DropdownMenuSeparator className="my-0" />
        {notifications.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            No notifications right now.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {notifications.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={cn(
                  'items-start gap-2.5 rounded-none px-3 py-2.5',
                  !item.read &&
                    (item.kind === NOTIFICATION_KIND.CREDIT_REQUEST
                      ? 'bg-blue-50/80'
                      : 'bg-amber-50/70'),
                )}
                onSelect={() => handleOpen(item)}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    notificationDotClass(item),
                    item.read && 'opacity-40',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm text-slate-900',
                      !item.read && 'font-semibold',
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {item.body}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
