import { createFileRoute } from '@tanstack/react-router'
import { StatusBadge } from '@/components/ui-kit/StatusBadge'
import { useTranslation } from '@smart-cv/i18n'
import { useGetAdminPaymentOrders } from '@smart-cv/api'
import type { OrderResponse } from '@smart-cv/api'
import * as React from 'react'
import { Button } from '@smart-cv/ui'
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { getGetAdminPaymentOrdersQueryKey } from '@smart-cv/api'

export const Route = createFileRoute('/admin/payments')({ component: PaymentsPage })

function PaymentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(0)
  const size = 5

  // Fetch all payment orders (up to 5000) for client-side filtering/cascade options
  const { data: paymentsData, isLoading } = useGetAdminPaymentOrders(0, 5000)
  const allOrders = React.useMemo(() => paymentsData?.data?.content ?? [], [paymentsData?.data?.content])

  // Filter States
  const [selectedMonth, setSelectedMonth] = React.useState('')
  const [selectedRole, setSelectedRole] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState('')
  const [selectedType, setSelectedType] = React.useState('')

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes} ${day}/${month}/${year}`
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'Paid'
      case 'PENDING':
        return 'Pending'
      case 'CANCELLED':
      case 'FAILED':
        return 'Failed'
      default:
        return status
    }
  }

  // Filter matching helpers
  const matchesMonth = (o: OrderResponse, m: string) => !m || o.createdAt.startsWith(m)
  const matchesRole = (o: OrderResponse, r: string) => !r || o.userRole === r
  const matchesStatus = (o: OrderResponse, s: string) => !s || o.status === s
  const matchesType = (o: OrderResponse, t: string) => !t || (o.paymentType || 'Gói sử dụng') === t

  // Extract available options dynamically based on all *other* selected filters (Cascading Filters)
  const availableRoles = React.useMemo(() => {
    const filtered = allOrders.filter(
      (o) => matchesMonth(o, selectedMonth) && matchesStatus(o, selectedStatus) && matchesType(o, selectedType)
    )
    return Array.from(new Set(filtered.map((o) => o.userRole)))
  }, [allOrders, selectedMonth, selectedStatus, selectedType])

  const availableStatuses = React.useMemo(() => {
    const filtered = allOrders.filter(
      (o) => matchesMonth(o, selectedMonth) && matchesRole(o, selectedRole) && matchesType(o, selectedType)
    )
    return Array.from(new Set(filtered.map((o) => o.status)))
  }, [allOrders, selectedMonth, selectedRole, selectedType])

  const availableTypes = React.useMemo(() => {
    const filtered = allOrders.filter(
      (o) => matchesMonth(o, selectedMonth) && matchesRole(o, selectedRole) && matchesStatus(o, selectedStatus)
    )
    return Array.from(new Set(filtered.map((o) => o.paymentType || 'Gói sử dụng')))
  }, [allOrders, selectedMonth, selectedRole, selectedStatus])

  // Get final filtered list of orders
  const filteredOrders = React.useMemo(() => {
    return allOrders.filter(
      (o) =>
        matchesMonth(o, selectedMonth) &&
        matchesRole(o, selectedRole) &&
        matchesStatus(o, selectedStatus) &&
        matchesType(o, selectedType)
    )
  }, [allOrders, selectedMonth, selectedRole, selectedStatus, selectedType])

  // Paginated subset of filtered orders
  const totalPages = Math.ceil(filteredOrders.length / size)
  const paginatedOrders = React.useMemo(() => {
    return filteredOrders.slice(page * size, (page + 1) * size)
  }, [filteredOrders, page, size])

  // Select dropdown class name for custom arrow and padding-right to prevent clipping
  const selectClassName = "h-9 rounded-md border border-input bg-background pl-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[right_0.65rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat w-[220px]"

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin_payments_title')}</h1>
      </div>

      {/* Filter Options Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-card border border-border rounded-xl p-4 shadow-sm">
        {/* Month Filter */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Tháng giao dịch</span>
          <input
            type="month"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-[160px]"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value)
              setPage(0)
            }}
          />
        </div>

        {/* Role Filter */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Vai trò</span>
          <select
            className={selectClassName}
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Tất cả vai trò</option>
            {availableRoles.includes('CANDIDATE') && (
              <option value="CANDIDATE">Ứng viên (Candidate)</option>
            )}
            {availableRoles.includes('RECRUITER') && (
              <option value="RECRUITER">Doanh nghiệp (Recruiter)</option>
            )}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Trạng thái</span>
          <select
            className={selectClassName}
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {availableStatuses.map((st) => (
              <option key={st} value={st}>
                {st === 'PAID' ? 'Paid' : st === 'PENDING' ? 'Pending' : 'Failed'}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Type Filter */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Loại thanh toán</span>
          <select
            className={selectClassName}
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Tất cả loại thanh toán</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Filter Button */}
        {(selectedMonth || selectedRole || selectedStatus || selectedType) && (
          <div className="self-end pb-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => {
                setSelectedMonth('')
                setSelectedRole('')
                setSelectedStatus('')
                setSelectedType('')
                setPage(0)
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        )}

        <div className="ml-auto self-end pb-0.5">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs"
            onClick={() => queryClient.invalidateQueries({ queryKey: getGetAdminPaymentOrdersQueryKey(0, 5000) })}
          >
            <RefreshCw className="size-3" /> Làm mới
          </Button>
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Đang tải lịch sử giao dịch...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Chưa có giao dịch nào khớp với bộ lọc.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left border-b border-border">
                <tr>
                  <th className="p-3">Người dùng / Đối tượng</th>
                  <th className="p-3">{t('admin_col_package')}</th>
                  <th className="p-3">{t('admin_col_amount')}</th>
                  <th className="p-3">{t('admin_col_transaction_date')}</th>
                  <th className="p-3">Loại thanh toán</th>
                  <th className="p-3">{t('admin_col_status')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((o) => (
                  <tr key={o.orderId} className="border-t border-border hover:bg-muted/10 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-foreground">
                        {o.userRole === 'RECRUITER' ? 'Doanh nghiệp (Recruiter)' : 'Ứng viên (Candidate)'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">ID: {o.userId}</div>
                    </td>
                    <td className="p-3 font-semibold">{o.packageName}</td>
                    <td className="p-3 font-bold text-foreground">{formatPrice(o.amount)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td>
                    <td className="p-3 text-xs font-semibold text-foreground">
                      {o.paymentType ?? 'Gói sử dụng'}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={getStatusLabel(o.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/20">
                <div className="text-xs text-muted-foreground">
                  Trang {page + 1} / {totalPages} (Tổng số: {filteredOrders.length} giao dịch)
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Trước
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
