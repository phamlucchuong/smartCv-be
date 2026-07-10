import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Brain, ChevronDown, CreditCard, FileWarning, KeyRound, LayoutDashboard, LogOut, Menu, Moon, Package, ScrollText, Search, Settings, ShieldCheck, Sparkles, Sun, Users, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { Button, NotificationPopover, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@smart-cv/ui'
import type { NotificationItem, NotificationFilter } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { useNotificationsList, useMarkNotificationRead, useMarkAllNotificationsRead } from '@smart-cv/api'

export function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem('smartcv_theme') as 'light' | 'dark' | null) ?? 'light'
  })
  const { i18n, t } = useTranslation()
  const language: 'EN' | 'VI' = i18n.language?.toUpperCase() === 'VI' ? 'VI' : 'EN'
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    access: true,
    operations: true,
    platform: true,
  })
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const { data: notifData } = useNotificationsList({ pageSize: 20 })
  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()

  const notifications: NotificationItem[] = (notifData?.data?.items ?? [])
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

  const markAsRead = (id: string) => markReadMutation.mutate(id)
  const markAllAsRead = () => markAllReadMutation.mutate()
  const deleteNotification = (id: string) => setDismissed((prev) => new Set(prev).add(id))
  const clearAll = () => setDismissed(new Set((notifData?.data?.items ?? []).map((i) => i.id)))

  const unreadCount = notifData?.data?.unreadCount ?? notifications.filter((n) => !n.read).length

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggleLanguage = () => {
    const nextLanguage = language === 'EN' ? 'VI' : 'EN'
    localStorage.setItem('smartcv_lang', nextLanguage.toLowerCase())
    i18n.changeLanguage(nextLanguage.toLowerCase())
  }



  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('smartcv_theme', next)
      return next
    })
  }

  const navGroups = useMemo(() => ([
    {
      key: 'overview',
      label: t('admin_sidebar_group_overview'),
      items: [{ to: '/admin', label: t('admin_nav_overview'), icon: LayoutDashboard }],
    },
    {
      key: 'access',
      label: t('admin_sidebar_group_access'),
      items: [
        { to: '/admin/users', label: t('admin_nav_users'), icon: Users },
        { to: '/admin/rbac', label: t('admin_nav_rbac'), icon: KeyRound },
        { to: '/admin/employer-verification', label: t('admin_nav_employer_verification'), icon: ShieldCheck },
      ],
    },
    {
      key: 'operations',
      label: t('admin_sidebar_group_operations'),
      items: [
        { to: '/admin/job-moderation', label: t('admin_nav_job_moderation'), icon: FileWarning },
        { to: '/admin/assessments', label: 'Kiểm duyệt bài test', icon: ScrollText },
        { to: '/admin/packages', label: t('admin_nav_packages'), icon: Package },
        { to: '/admin/payments', label: t('admin_nav_payments'), icon: CreditCard },
      ],
    },
    {
      key: 'platform',
      label: t('admin_sidebar_group_platform'),
      items: [
        { to: '/admin/ai-config', label: t('admin_nav_ai_config'), icon: Brain },
        { to: '/admin/settings', label: t('admin_nav_system_settings'), icon: Settings },
        { to: '/admin/audit-logs', label: t('admin_nav_audit_logs'), icon: ScrollText },
      ],
    },
  ]), [t])

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={cn('sticky top-0 h-screen border-r border-sidebar-border bg-sidebar transition-all flex flex-col', collapsed ? 'w-16' : 'w-64')}>
        <div className="h-16 border-b border-sidebar-border px-4 flex items-center">
          <Link to="/admin" className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Sparkles className="size-4" /></div>
            {!collapsed && <span className="font-bold">SmartCV Admin</span>}
          </Link>
        </div>
        <nav className="p-2 space-y-2 flex-1 overflow-y-auto">
          {navGroups.map((group) => {
            const groupHasActive = group.items.some((item) => pathname === item.to || (item.to !== '/admin' && pathname.startsWith(item.to)))
            if (group.items.length === 1) {
              const item = group.items[0]
              const active = pathname === item.to || (item.to !== '/admin' && pathname.startsWith(item.to))
              return (
                <Link key={group.key} to={item.to} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm border border-transparent', active ? 'bg-primary/10 text-primary border-primary/20 font-semibold' : 'text-sidebar-foreground hover:bg-sidebar-accent', collapsed && 'justify-center px-0')}>
                  <item.icon className="size-4" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            }
            const expanded = collapsed ? false : (openGroups[group.key] ?? groupHasActive)
            return (
              <div key={group.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                  className={cn(
                    'flex w-full items-center rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-sidebar-accent',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  {!collapsed && <span className="truncate">{group.label}</span>}
                  {!collapsed && <ChevronDown className={cn('ml-auto size-3.5 transition-transform', expanded && 'rotate-180')} />}
                  {collapsed && <div className={cn('size-1.5 rounded-full', groupHasActive ? 'bg-primary' : 'bg-muted-foreground/40')} />}
                </button>
                {expanded && group.items.map((item) => {
                  const active = pathname === item.to || (item.to !== '/admin' && pathname.startsWith(item.to))
                  return (
                    <Link key={item.to} to={item.to} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm border border-transparent', active ? 'bg-primary/10 text-primary border-primary/20 font-semibold' : 'text-sidebar-foreground hover:bg-sidebar-accent')}>
                      <item.icon className="size-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <button onClick={() => setCollapsed((v) => !v)} className="m-2 w-[calc(100%-1rem)] rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
          {collapsed ? <Menu className="size-4 mx-auto" /> : t('admin_sidebar_collapse')}
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-card px-5 flex items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input placeholder={t('admin_search_placeholder')} className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="border-border bg-muted/60 relative flex h-9 w-[84px] cursor-pointer items-center rounded-lg border p-1 text-xs"
              title="Toggle language"
            >
              <span
                className={`absolute top-1 h-7 w-9 rounded-md bg-primary transition-transform duration-200 ${language === 'EN' ? 'translate-x-0' : 'translate-x-[38px]'}`}
              />
              <span className={`relative z-10 w-9 text-center transition-colors duration-200 ${language === 'EN' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>EN</span>
              <span className={`relative z-10 w-9 text-center transition-colors duration-200 ${language === 'VI' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>VI</span>
            </button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="border-border bg-muted/60 text-muted-foreground h-9 w-9 transition-transform duration-300 active:scale-95"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-12" /> : <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" />}
            </Button>
            <NotificationPopover
              notifications={notifications}
              unreadCount={unreadCount}
              filter={filter}
              onFilterChange={setFilter}
              onMarkRead={markAsRead}
              onDelete={deleteNotification}
              onMarkAllRead={markAllAsRead}
              onClearAll={clearAll}
              onClickNotification={(id, url) => {
                markAsRead(id)
                if (url) window.location.href = url
              }}
              locale={language === 'VI' ? 'vi-VN' : 'en-US'}
              triggerClassName="text-foreground hover:bg-accent"
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
                    <UserRound className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{user?.email?.split('@')[0] ?? 'Admin'}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    clearAuth()
                    navigate({ to: '/signin' })
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" /> {t('account_sign_out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
