import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { StatusBadge } from '@/components/ui-kit/StatusBadge'
import { useTranslation } from '@smart-cv/i18n'
import { getAllUsers, useGetAllCandidates, useGetAllJobs, useGetAllUsers, RecruiterApi, useGetAdminJobs, type UserModels, useGetAdminPaymentOrders, type OrderResponse } from '@smart-cv/api'
import { useState } from 'react'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

const USER_GROWTH_MONTH = [
  { m: '01/06', users: 3100 },
  { m: '05/06', users: 3150 },
  { m: '10/06', users: 3220 },
  { m: '15/06', users: 3290 },
  { m: '20/06', users: 3350 },
  { m: '25/06', users: 3390 },
  { m: '30/06', users: 3420 },
]

const USER_GROWTH_YEAR = [
  { m: 'T1', users: 2200 },
  { m: 'T2', users: 2480 },
  { m: 'T3', users: 2670 },
  { m: 'T4', users: 2890 },
  { m: 'T5', users: 3150 },
  { m: 'T6', users: 3420 },
  { m: 'T7', users: 3500 },
  { m: 'T8', users: 3650 },
  { m: 'T9', users: 3800 },
  { m: 'T10', users: 3950 },
  { m: 'T11', users: 4100 },
  { m: 'T12', users: 4300 },
]

function buildMonthlyRevenue(orders: OrderResponse[]) {
  const today = startOfDay(new Date())
  const windowStart = addDays(today, -29)
  const stepStarts = [0, 5, 10, 15, 20, 25].map((offset) => addDays(windowStart, offset))
  return stepStarts.map((start, index) => {
    const end = index === stepStarts.length - 1 ? addDays(today, 1) : stepStarts[index + 1]
    const paidInPeriod = orders.filter((o) => {
      if (o.status !== 'PAID' || !o.createdAt) return false
      const t = new Date(o.createdAt).getTime()
      return t >= start.getTime() && t < end.getTime()
    })
    const revAmount = paidInPeriod.reduce((sum, o) => sum + o.amount, 0)
    return {
      m: formatDayLabel(start),
      rev: revAmount / 1_000_000,
    }
  })
}

function buildYearlyRevenue(orders: OrderResponse[]) {
  const today = new Date()
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthStarts = Array.from({ length: 12 }, (_value, index) => addMonths(currentMonth, index - 11))
  return monthStarts.map((start, index) => {
    const end = index === monthStarts.length - 1 ? addMonths(currentMonth, 1) : monthStarts[index + 1]
    const paidInPeriod = orders.filter((o) => {
      if (o.status !== 'PAID' || !o.createdAt) return false
      const t = new Date(o.createdAt).getTime()
      return t >= start.getTime() && t < end.getTime()
    })
    const revAmount = paidInPeriod.reduce((sum, o) => sum + o.amount, 0)
    return {
      m: formatMonthLabel(start),
      rev: revAmount / 1_000_000,
    }
  })
}

type GrowthPoint = {
  m: string
  users: number
  newUsers: number
}

const USER_GROWTH_PAGE_SIZE = 200

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function formatMonthLabel(date: Date) {
  return `${date.getMonth() + 1}`.padStart(2, '0') + `/${date.getFullYear().toString().slice(-2)}`
}

function formatDayLabel(date: Date) {
  return `${date.getDate()}`.padStart(2, '0') + `/${date.getMonth() + 1}`.padStart(2, '0')
}

function countUsersInRange(users: UserModels.UserResponse[], start: Date, end: Date) {
  const startMs = start.getTime()
  const endMs = end.getTime()

  return users.reduce((count, user) => {
    if (!user.createdAt) return count
    const createdAt = new Date(user.createdAt).getTime()
    return createdAt >= startMs && createdAt < endMs ? count + 1 : count
  }, 0)
}

function countUsersUntil(users: UserModels.UserResponse[], end: Date) {
  const endMs = end.getTime()

  return users.reduce((count, user) => {
    if (!user.createdAt) return count
    return new Date(user.createdAt).getTime() < endMs ? count + 1 : count
  }, 0)
}

function buildMonthlyGrowth(users: UserModels.UserResponse[]) {
  const today = startOfDay(new Date())
  const windowStart = addDays(today, -29)
  const stepStarts = [0, 5, 10, 15, 20, 25].map((offset) => addDays(windowStart, offset))
  const chartPoints = stepStarts.map((start, index) => {
    const end = index === stepStarts.length - 1 ? addDays(today, 1) : stepStarts[index + 1]
    return {
      m: formatDayLabel(start),
      users: countUsersUntil(users, end),
      newUsers: countUsersInRange(users, start, end),
    }
  })

  return chartPoints
}

function buildYearlyGrowth(users: UserModels.UserResponse[]) {
  const today = new Date()
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthStarts = Array.from({ length: 12 }, (_value, index) => addMonths(currentMonth, index - 11))

  return monthStarts.map((start, index) => {
    const end = index === monthStarts.length - 1 ? addMonths(currentMonth, 1) : monthStarts[index + 1]
    return {
      m: formatMonthLabel(start),
      users: countUsersUntil(users, end),
      newUsers: countUsersInRange(users, start, end),
    }
  })
}

async function fetchAllUsersForGrowth() {
  const firstPage = await getAllUsers({ page: 1, size: USER_GROWTH_PAGE_SIZE })
  const firstData = firstPage.data
  const totalPages = firstData?.totalPages ?? 1
  const firstItems = firstData?.items ?? []

  if (totalPages <= 1) return firstItems

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_value, index) => (
      getAllUsers({ page: index + 2, size: USER_GROWTH_PAGE_SIZE })
    )),
  )

  return [
    ...firstItems,
    ...remainingPages.flatMap((page) => page.data?.items ?? []),
  ]
}

function AdminDashboard() {
  const { t } = useTranslation()
  const [userGrowthTimeframe, setUserGrowthTimeframe] = useState<'month' | 'year'>('month')
  const [revenueTimeframe, setRevenueTimeframe] = useState<'month' | 'year'>('month')

  const adminOrdersQuery = useGetAdminPaymentOrders(0, 1000)
  const allOrders = adminOrdersQuery.data?.data?.content ?? []

  const revenueData = allOrders.length > 0
    ? revenueTimeframe === 'year'
      ? buildYearlyRevenue(allOrders)
      : buildMonthlyRevenue(allOrders)
    : []

  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const paidOrdersInMonth = allOrders.filter((o) => o.status === 'PAID' && o.createdAt?.startsWith(currentMonthStr))
  const totalMonthRevenue = paidOrdersInMonth.reduce((sum, o) => sum + o.amount, 0)
  const monthlyRevenueFormatted = totalMonthRevenue > 0
    ? `${(totalMonthRevenue / 1_000_000).toFixed(1)}M₫`
    : '0₫'

  const usersQuery = useGetAllUsers({ page: 1, size: 1 })
  const userGrowthQuery = useQuery({
    queryKey: ['admin-user-growth'],
    queryFn: fetchAllUsersForGrowth,
    staleTime: 5 * 60 * 1000,
  })
  const candidatesQuery = useGetAllCandidates({ page: 1, size: 1 })
  const recruitersQuery = RecruiterApi.useGetAll({ page: 1, size: 1 })
  const pendingRecruitersQuery = RecruiterApi.useGetAll({ page: 1, size: 3, status: 'PENDING' })
  const jobsQuery = useGetAllJobs({ page: 1, size: 1 })
  const pendingJobsQuery = useGetAdminJobs({ page: 1, size: 1, moderationStatus: 'PENDING' })

  const totalUsers = usersQuery.data?.data?.total ?? 0
  const totalCandidates = candidatesQuery.data?.data?.total ?? 0
  const totalRecruiters = recruitersQuery.data?.data?.total ?? 0
  const totalJobs = jobsQuery.data?.data?.total ?? 0
  const pendingRecruiters = pendingRecruitersQuery.data?.data?.items ?? []
  const pendingJobs = pendingJobsQuery.data?.data?.total ?? 0
  const growthUsers = userGrowthQuery.data ?? []
  const userGrowthData = growthUsers.length > 0
    ? userGrowthTimeframe === 'year'
      ? buildYearlyGrowth(growthUsers)
      : buildMonthlyGrowth(growthUsers)
    : userGrowthTimeframe === 'year'
      ? USER_GROWTH_YEAR.map((item) => ({ ...item, newUsers: 0 }))
      : USER_GROWTH_MONTH.map((item) => ({ ...item, newUsers: 0 }))
  const firstGrowthPoint = userGrowthData[0]
  const lastGrowthPoint = userGrowthData[userGrowthData.length - 1]
  const totalNewUsersInPeriod = userGrowthData.reduce((sum, item) => sum + item.newUsers, 0)
  const absoluteGrowth = lastGrowthPoint && firstGrowthPoint
    ? lastGrowthPoint.users - firstGrowthPoint.users
    : 0
  const percentGrowth = firstGrowthPoint?.users
    ? (absoluteGrowth / firstGrowthPoint.users) * 100
    : 0

  const recentTransactions = [...allOrders]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 5)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
  }

  const isUsersLoading = usersQuery.isLoading
  const isCandidatesLoading = candidatesQuery.isLoading
  const isRecruitersLoading = recruitersQuery.isLoading
  const isJobsLoading = jobsQuery.isLoading
  const isPendingJobsLoading = pendingJobsQuery.isLoading
  const isUserGrowthLoading = userGrowthQuery.isLoading
  const isAdminOrdersLoading = adminOrdersQuery.isLoading

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin_dashboard_title')}</h1>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('admin_kpi_active_users'), value: isUsersLoading ? '...' : totalUsers.toLocaleString('vi-VN'), change: 'API', trend: 'up', timeframe: t('admin_kpi_vs_last_month') },
          { label: t('admin_kpi_new_candidates'), value: isCandidatesLoading ? '...' : totalCandidates.toLocaleString('vi-VN'), change: 'API', trend: 'up', timeframe: t('admin_kpi_vs_last_week') },
          { label: t('admin_kpi_new_employers'), value: isRecruitersLoading ? '...' : totalRecruiters.toLocaleString('vi-VN'), change: 'API', trend: 'up', timeframe: t('admin_kpi_vs_last_week') },
          { label: t('admin_kpi_jobs_today'), value: isJobsLoading ? '...' : totalJobs.toLocaleString('vi-VN'), change: 'API', trend: 'up', timeframe: t('admin_kpi_vs_yesterday') },
          { label: t('admin_kpi_monthly_revenue'), value: isAdminOrdersLoading ? '...' : monthlyRevenueFormatted, change: 'API', trend: 'up', timeframe: t('admin_kpi_vs_last_month') },
          { label: t('admin_kpi_ai_queue'), value: isPendingJobsLoading ? '...' : `${pendingJobs} jobs`, change: 'API', trend: 'down', timeframe: t('admin_kpi_vs_last_hour') },
        ].map((item) => (
          <div key={item.label} className="card-surface p-4 flex flex-col justify-between">
            <div>
              <div className="text-2xl font-bold">{item.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium">
              <span className={item.trend === 'up' ? 'text-success' : 'text-destructive'}>
                {item.change}
              </span>
              <span className="text-muted-foreground">{item.timeframe}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="font-semibold">{t('admin_chart_user_growth')}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t('admin_chart_growth_total_users', {
                    value: lastGrowthPoint?.users.toLocaleString('vi-VN') ?? '0',
                  })}
                </span>
                <span className={absoluteGrowth >= 0 ? 'text-success' : 'text-destructive'}>
                  {t('admin_chart_growth_delta', {
                    value: absoluteGrowth >= 0 ? `+${absoluteGrowth.toLocaleString('vi-VN')}` : absoluteGrowth.toLocaleString('vi-VN'),
                    percentage: `${absoluteGrowth >= 0 ? '+' : ''}${percentGrowth.toFixed(1)}%`,
                  })}
                </span>
                <span>{t('admin_chart_growth_new_users', { value: totalNewUsersInPeriod.toLocaleString('vi-VN') })}</span>
              </div>
            </div>
            <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border">
              {(['month', 'year'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setUserGrowthTimeframe(mode)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all font-medium cursor-pointer ${
                    userGrowthTimeframe === mode
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(`admin_chart_tf_${mode}`)}
                </button>
              ))}
            </div>
          </div>
          {userGrowthQuery.isError ? (
            <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {t('admin_chart_growth_error')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={userGrowthData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="userGrowthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => Number(value).toLocaleString('vi-VN')} />
                <Tooltip
                  cursor={{ stroke: 'var(--color-primary)', strokeDasharray: '4 4' }}
                  formatter={(value: number, name: string, item: { payload?: GrowthPoint }) => {
                    if (name === 'users') {
                      return [value.toLocaleString('vi-VN'), t('admin_chart_growth_tooltip_total')]
                    }

                    return [item.payload?.newUsers?.toLocaleString('vi-VN') ?? '0', t('admin_chart_growth_tooltip_new')]
                  }}
                  labelFormatter={(label) => `${t('admin_chart_growth_period')}: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fill="url(#userGrowthFill)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isUserGrowthLoading
                ? t('admin_chart_growth_loading')
                : t('admin_chart_growth_source_live')}
            </span>
            <span>{t(`admin_chart_tf_${userGrowthTimeframe}`)}</span>
          </div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t('admin_chart_revenue')}</h2>
            <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border">
              {(['month', 'year'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRevenueTimeframe(mode)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all font-medium cursor-pointer ${
                    revenueTimeframe === mode
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(`admin_chart_tf_${mode}`)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueData}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="m" />
              <YAxis />
              <Tooltip />
              <Line dataKey="rev" stroke="var(--color-primary)" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t('admin_pending_employers')}</h3>
            <Link to="/admin/employer-verification" className="text-xs text-primary hover:underline font-medium">
              {t('admin_view_all')}
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            {pendingRecruitersQuery.isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : pendingRecruiters.length > 0 ? (
              pendingRecruiters.map((recruiter) => (
                <div key={recruiter.id} className="flex items-center justify-between">
                  <span>{recruiter.companyName ?? recruiter.fullName ?? '—'}</span>
                  <StatusBadge status={recruiter.status ?? 'PENDING'} />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Không có hồ sơ chờ duyệt.</p>
            )}
          </div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t('admin_recent_transactions')}</h3>
            <Link to="/admin/payments" className="text-xs text-primary hover:underline font-medium">
              {t('admin_view_all')}
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            {isAdminOrdersLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : recentTransactions.length > 0 ? (
              recentTransactions.map((tx) => (
                <div key={tx.orderId} className="flex items-center justify-between">
                  <span>{tx.packageName} • {formatPrice(tx.amount)}</span>
                  <StatusBadge status={tx.status} />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Không có giao dịch nào.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
