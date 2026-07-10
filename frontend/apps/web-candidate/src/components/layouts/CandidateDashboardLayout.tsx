import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  ChevronDown,
  ClipboardCheck,
  FileText,
  FileUp,
  Heart,
  LogOut,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  CreditCard,
} from 'lucide-react'
import * as React from 'react'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, NotificationPopover, cn } from '@smart-cv/ui'
import type { NotificationItem, NotificationFilter } from '@smart-cv/ui'
import { i18n, useTranslation } from '@smart-cv/i18n'
import { usePreferencesStore } from '../../store/usePreferencesStore'
import { useAuthStore } from '../../store/useAuthStore'
import {
  useNotificationsList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '@smart-cv/api'

interface NavItem {
  key: string
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

export function CandidateDashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [collapsed, setCollapsed] = React.useState(false)
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    profile: true,
    activity: true,
    other: true,
  })

  const { email, fullName, avatarUrl, signOut } = useAuthStore()
  const displayName = fullName ?? email?.split('@')[0] ?? 'Account'
  const theme = usePreferencesStore((s) => s.theme)
  const language = usePreferencesStore((s) => s.language)
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme)
  const toggleLanguage = usePreferencesStore((s) => s.toggleLanguage)

  const [filter, setFilter] = React.useState<NotificationFilter>('all')
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set())

  const { data: notifData } = useNotificationsList({ page: 1, pageSize: 30 })
  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()
  const deleteMutation = useDeleteNotification()

  const notifications: NotificationItem[] = React.useMemo(() => {
    const items = notifData?.data?.items ?? []
    return items
      .filter((item) => !dismissed.has(item.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        message: item.body,
        createdAt: item.createdAt,
        read: item.isRead,
        tone: 'info' as const,
        url: item.data?.url,
      }))
  }, [notifData, dismissed])

  const unreadCount = notifData?.data?.unreadCount ?? 0

  const navGroups: NavGroup[] = [
    {
      key: 'profile',
      label: t('candidate_sidebar_group_profile'),
      items: [
        { key: 'profile', label: t('account_my_profile'), to: '/profile', icon: UserRound },
        { key: 'cv', label: t('account_my_cv'), to: '/cv', icon: FileUp },
      ],
    },
    {
      key: 'activity',
      label: t('candidate_sidebar_group_activity'),
      items: [
        { key: 'applications', label: t('account_applied_jobs'), to: '/applications', icon: FileText },
        { key: 'wishlists', label: t('account_wishlists'), to: '/wishlists', icon: Heart },
        { key: 'job-suggestions', label: t('account_job_suggestions'), to: '/job-suggestions', icon: Sparkles },
        { key: 'assessments', label: t('account_assessments'), to: '/assessments', icon: ClipboardCheck },
      ],
    },
    {
      key: 'other',
      label: t('candidate_sidebar_group_other'),
      items: [
        { key: 'settings', label: t('account_settings'), to: '/settings', icon: Settings },
        { key: 'billing', label: 'Gói & Thanh toán', to: '/billing', icon: CreditCard },
      ],
    },
  ]

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`)

  const handleSignOut = () => {
    signOut()
    navigate({ to: '/signin' })
  }

  const handleToggleLanguage = () => {
    toggleLanguage()
    i18n.changeLanguage(language === 'EN' ? 'vi' : 'en')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'bg-sidebar border-sidebar-border sticky top-0 flex h-screen flex-col border-r transition-all',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className="border-sidebar-border flex h-16 items-center gap-2 border-b px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Sparkles className="size-4" />
            </div>
            {!collapsed && <span className="font-bold tracking-tight">SmartCV</span>}
          </Link>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-4">
          {navGroups.map((group) => {
            const groupHasActive = group.items.some((item) => isActive(item.to))
            const expanded = collapsed ? false : (openGroups[group.key] ?? groupHasActive)

            return (
              <div key={group.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                  className={cn(
                    'text-muted-foreground hover:bg-sidebar-accent flex w-full items-center rounded-lg px-2 py-1.5 text-xs font-semibold tracking-wide uppercase',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  {!collapsed && <span className="truncate">{group.label}</span>}
                  {!collapsed && <ChevronDown className={cn('ml-auto size-3.5 transition-transform', expanded && 'rotate-180')} />}
                  {collapsed && <div className={cn('size-1.5 rounded-full', groupHasActive ? 'bg-primary' : 'bg-muted-foreground/40')} />}
                </button>

                {expanded && group.items.map((item) => <SidebarLink key={item.key} item={item} active={isActive(item.to)} collapsed={collapsed} />)}
              </div>
            )
          })}
        </nav>

        <div className="border-sidebar-border sticky bottom-0 border-t bg-sidebar p-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="border-border text-muted-foreground hover:bg-accent w-full rounded-lg border px-3 py-2 text-xs"
          >
            {collapsed ? '→' : `← ${t('candidate_sidebar_collapse')}`}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card border-border sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 lg:px-5">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              placeholder={t('candidate_search_placeholder')}
              className="border-input bg-background focus:ring-ring/40 h-9 w-full rounded-lg border py-0 pr-3 pl-9 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={handleToggleLanguage}
              className="border-border bg-muted/60 relative flex h-9 w-[84px] cursor-pointer items-center rounded-lg border p-1 text-xs"
            >
              <span className={`absolute top-1 h-7 w-9 rounded-md bg-primary transition-transform duration-200 ${language === 'EN' ? 'translate-x-0' : 'translate-x-[38px]'}`} />
              <span className={`relative z-10 w-9 text-center transition-colors duration-200 ${language === 'EN' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>EN</span>
              <span className={`relative z-10 w-9 text-center transition-colors duration-200 ${language === 'VI' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>VI</span>
            </button>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="border-border bg-muted/60 text-muted-foreground h-9 w-9 transition-transform duration-300 active:scale-95"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-12" /> : <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" />}
            </Button>

            <NotificationPopover
              notifications={notifications}
              unreadCount={unreadCount}
              filter={filter}
              onFilterChange={setFilter}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onMarkAllRead={() => markAllReadMutation.mutate()}
              onClearAll={() => setDismissed(new Set((notifData?.data?.items ?? []).map((i) => i.id)))}
              onClickNotification={(id, url) => {
                markReadMutation.mutate(id)
                if (url) window.location.href = url
              }}
              locale={language === 'VI' ? 'vi-VN' : 'en-US'}
              triggerClassName="hover:bg-accent text-foreground"
              labels={{
                title: t('account_notifications'),
                all: t('notifications_filter_all'),
                unread: t('notifications_filter_unread'),
                read: t('notifications_filter_read'),
                markRead: t('notifications_mark_read'),
                delete: t('notifications_delete'),
                markAllRead: t('notifications_mark_all_read'),
                clearAll: t('notifications_clear_all'),
                empty: t('notifications_empty'),
                noUnread: t('notifications_no_unread'),
                unreadCount: t('notifications_unread_count', { count: unreadCount }),
                openNotifications: t('notifications_popup_aria'),
              }}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full bg-primary/20 border border-primary/30 px-3 py-1.5 cursor-pointer hover:bg-primary/25 transition-colors">
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-primary">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground">{displayName}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>{t('account_my_profile')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 size-4" /> {t('account_sign_out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors',
        active
          ? 'border-primary/20 bg-primary/10 text-primary font-semibold'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}
