import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Button, Card, CardContent, Badge, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@smart-cv/ui'
import { CheckCircle2, ArrowRight, CreditCard, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  useGetServicePackages,
  type ServicePackageResponse,
  useGetPaymentOrders,
  type OrderResponse,
  useCreatePaymentOrder,
  useCancelPaymentOrder,
  useGetMe2,
  getGetMe2QueryKey,
  getGetPaymentOrdersQueryKey,
} from '@smart-cv/api'
import { useQueryClient } from '@tanstack/react-query'
import { useCandidatePreferences } from '../../store/candidatePreferences'
import { useAuthStore } from '../../store/useAuthStore'

export const Route = createFileRoute('/_account/billing')({
  component: BillingPage,
})

function BillingPage() {
  const { language: lang } = useCandidatePreferences()
  const { isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()

  const [page, setPage] = React.useState(0)
  const size = 5

  const { data: meData } = useGetMe2({
    query: { enabled: isAuthenticated },
  })
  const candidate = meData?.data

  const { data: packagesData, isLoading: packagesLoading } = useGetServicePackages()
  const packages = (packagesData?.data ?? []).filter((p) => p.category !== 'PLATFORM_FEE')

  // Fetch all payment orders (up to 1000) for client-side filtering/cascade options
  const { data: ordersData, isLoading: ordersLoading } = useGetPaymentOrders(0, 1000, {
    query: { enabled: isAuthenticated },
  })
  const allOrders = React.useMemo(() => ordersData?.data?.content ?? [], [ordersData?.data?.content])

  // Filter States
  const [selectedMonth, setSelectedMonth] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState('')
  const [freePackageDialogOpen, setFreePackageDialogOpen] = React.useState(false)
  const [pendingPackageId, setPendingPackageId] = React.useState<string | null>(null)

  const matchesMonth = (o: OrderResponse, m: string) => !m || o.createdAt.startsWith(m)
  const matchesStatus = (o: OrderResponse, s: string) => !s || o.status === s

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object' &&
      (error as { response?: { data?: unknown } }).response?.data &&
      typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
    ) {
      return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
    }
    return fallback
  }

  // Extract available options dynamically based on all *other* selected filters (Cascading Filters)
  const availableStatuses = React.useMemo(() => {
    const filtered = allOrders.filter((o) => matchesMonth(o, selectedMonth))
    return Array.from(new Set(filtered.map((o) => o.status)))
  }, [allOrders, selectedMonth])

  // Get final filtered list of orders
  const filteredOrders = React.useMemo(() => {
    return allOrders.filter((o) => matchesMonth(o, selectedMonth) && matchesStatus(o, selectedStatus))
  }, [allOrders, selectedMonth, selectedStatus])

  // Paginated subset of filtered orders
  const totalPages = Math.ceil(filteredOrders.length / size)
  const paginatedOrders = React.useMemo(() => {
    return filteredOrders.slice(page * size, (page + 1) * size)
  }, [filteredOrders, page, size])

  const createOrderMutation = useCreatePaymentOrder()
  const cancelOrderMutation = useCancelPaymentOrder()

  const handleBuyPackage = (packageId: string) => {
    if (packageId === 'free') {
      setPendingPackageId(packageId)
      setFreePackageDialogOpen(true)
      return
    }

    // Check if user is using a non-free package and it's still valid
    const isPremium = candidate?.activePackageId && candidate.activePackageId !== 'free'
    const isNotExpired = candidate?.packageExpiresAt && new Date(candidate.packageExpiresAt) > new Date()
    if (isPremium && isNotExpired) {
      toast.error(
        lang === 'VI'
          ? 'Vui lòng sử dụng gói hiện tại đến hết thời hạn đăng ký.'
          : 'Please use your current package until the end of the billing cycle.'
      )
      return
    }

    createOrderMutation.mutate(
      { packageId },
      {
        onSuccess: (res) => {
          if (res.data?.paymentUrl) {
            toast.success(lang === 'VI' ? 'Đang chuyển hướng đến trang thanh toán...' : 'Redirecting to payment checkout...')
            window.location.href = res.data.paymentUrl
          } else {
            toast.error(lang === 'VI' ? 'Không thể tạo liên kết thanh toán.' : 'Failed to generate payment link.')
          }
        },
        onError: (err: unknown) => {
          toast.error(getErrorMessage(err, 'Failed to buy package'))
        },
      }
    )
  }

  const confirmFreePackage = () => {
    if (!pendingPackageId) {
      return
    }

    createOrderMutation.mutate(
      { packageId: pendingPackageId },
      {
        onSuccess: (res) => {
          setFreePackageDialogOpen(false)
          setPendingPackageId(null)
          queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetPaymentOrdersQueryKey(0, 1000) })
          if (res.data?.paymentUrl) {
            window.location.href = res.data.paymentUrl
            return
          }
          toast.success(lang === 'VI' ? 'Đã chuyển sang gói Free.' : 'Switched to the Free plan.')
        },
        onError: (err: unknown) => {
          setFreePackageDialogOpen(false)
          setPendingPackageId(null)
          toast.error(getErrorMessage(err, 'Failed to switch to Free plan'))
        },
      }
    )
  }

  const handleCancelOrder = (orderId: string) => {
    cancelOrderMutation.mutate(orderId, {
      onSuccess: () => {
        toast.success(lang === 'VI' ? 'Đã hủy đơn hàng thành công' : 'Order cancelled successfully')
        queryClient.invalidateQueries({ queryKey: getGetPaymentOrdersQueryKey(0, 1000) })
      },
      onError: (err: unknown) => {
        toast.error(getErrorMessage(err, 'Failed to cancel order'))
      },
    })
  }

  const activePackage: ServicePackageResponse = packages.find((p) => p.id === candidate?.activePackageId) || {
    name: 'Free',
    features: ['Hỗ trợ cơ bản', 'Phân tích CV cơ bản'],
  }

  const formatPrice = (price: number) => {
    if (price === 0) return lang === 'VI' ? 'Miễn phí' : 'Free'
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

  const formatAiCredits = (remaining?: number, total?: number, used?: number) => {
    if (total === undefined || total === null || total === -1) {
      return lang === 'VI' ? 'Không giới hạn' : 'Unlimited'
    }
    return `${Math.max(remaining ?? Math.max(total - (used ?? 0), 0), 0)}/${total}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="outline" className="bg-success-soft text-success border-success/20">Đã thanh toán</Badge>
      case 'PENDING':
        return <Badge variant="outline" className="bg-warning-soft text-warning border-warning/20">Chờ thanh toán</Badge>
      case 'CANCELLED':
        return <Badge variant="outline" className="bg-destructive-soft text-destructive border-destructive/20">Đã hủy</Badge>
      case 'FAILED':
        return <Badge variant="outline" className="bg-destructive-soft text-destructive border-destructive/20">Thất bại</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Select dropdown class name for custom arrow and padding-right
  const selectClassName = "h-8 rounded-md border border-input bg-background pl-2.5 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-primary appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[right_0.5rem_center] bg-[length:1rem_1rem] bg-no-repeat w-[150px]"

  return (
    <div className="space-y-8">
      <Dialog open={freePackageDialogOpen} onOpenChange={setFreePackageDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {lang === 'VI' ? 'Xác nhận đổi sang gói Free' : 'Confirm switching to Free'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'VI'
                ? 'Gói Free sẽ được áp dụng ngay sau khi xác nhận. Không cần thanh toán qua PayOS.'
                : 'The Free plan will be applied immediately after confirmation. No PayOS payment is required.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreePackageDialogOpen(false)}>
              {lang === 'VI' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button onClick={confirmFreePackage} disabled={createOrderMutation.isPending}>
              {lang === 'VI' ? 'Xác nhận' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Gói & Thanh toán</h1>
        <p className="text-muted-foreground mt-1">Quản lý gói dịch vụ AI, nâng cấp quyền lợi và xem lịch sử giao dịch.</p>
      </div>

      {/* 1. Current Package Status */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 shadow-md">
        <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="text-sm font-semibold text-primary uppercase tracking-wider">Gói hiện tại của bạn</div>
            <h2 className="text-4xl font-extrabold mt-1 text-foreground">{activePackage?.name}</h2>
            {activePackage?.durationDays ? (
              <p className="text-sm text-muted-foreground mt-2">
                {lang === 'VI' ? 'Thời hạn gói: ' : 'Duration: '}
                <strong className="text-foreground">{activePackage.durationDays} {lang === 'VI' ? 'ngày' : 'days'}</strong>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">{lang === 'VI' ? 'Bạn chưa kích hoạt gói trả phí' : 'You have not activated a paid plan'}</p>
            )}
            {
              activePackage?.name === 'Free' && (
                <div className="mt-6 flex gap-3">
                  <a href="#available-packages">
                    <Button className="gap-2">
                      {lang === 'VI' ? 'Nâng cấp gói' : 'Upgrade plan'} <ArrowRight className="size-4" />
                    </Button>
                  </a>
                </div>
              )
            }
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border/60 rounded-2xl p-4 text-center shadow-sm">
              <div className="text-3xl font-extrabold text-foreground">
                {activePackage.cvLimit === -1 || activePackage.cvLimit === null || activePackage.cvLimit === undefined
                  ? (lang === 'VI' ? 'Vô hạn' : 'Unlimited')
                  : activePackage.cvLimit}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Lượt tải lên CV</div>
            </div>
            <div className="bg-card border border-border/60 rounded-2xl p-4 text-center shadow-sm">
              <div className="text-3xl font-extrabold text-foreground">
                {formatAiCredits(candidate?.aiCreditsRemaining, candidate?.aiCreditsTotal, candidate?.aiCreditsUsed)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {lang === 'VI' ? 'AI credit còn lại / tổng gói' : 'AI credits left / total'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Available Pricing Grid */}
      <div id="available-packages" className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Các gói dịch vụ sẵn có</h2>
        {packagesLoading ? (
          <div className="text-center py-10 text-muted-foreground">Đang tải danh sách gói...</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {packages.map((p) => {
              const isCurrent = candidate?.activePackageId === p.id || (!candidate?.activePackageId && p.id === 'free')
              return (
                <Card
                  key={p.id}
                  className={`relative flex flex-col justify-between p-6 rounded-2xl transition-all duration-300 hover:shadow-lg ${p.featured ? 'border-2 border-primary shadow-md scale-105 md:scale-100 lg:scale-105' : 'border border-border'
                    }`}
                >
                  {p.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Phổ biến nhất
                    </span>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{p.name}</h3>
                    <div className="mt-4 flex items-baseline gap-1 text-foreground">
                      <span className="text-3xl font-extrabold tracking-tight">{formatPrice(p.price ?? 0)}</span>
                      {p.price !== 0 && <span className="text-sm font-semibold text-muted-foreground">/tháng</span>}
                    </div>
                    <ul className="mt-6 space-y-3.5">
                      <li className="flex gap-2.5 items-start text-sm text-muted-foreground">
                        <CheckCircle2 className="size-4.5 text-success shrink-0 mt-0.5" />
                        <span>
                          {lang === 'VI' ? 'Số lượt tải lên CV: ' : 'CV upload limit: '}
                          {p.cvLimit === -1 || p.cvLimit === null || p.cvLimit === undefined ? (lang === 'VI' ? 'Vô hạn' : 'Unlimited') : p.cvLimit}
                        </span>
                      </li>
                      <li className="flex gap-2.5 items-start text-sm text-muted-foreground">
                        <CheckCircle2 className="size-4.5 text-success shrink-0 mt-0.5" />
                        <span>
                          {lang === 'VI' ? 'Số AI Credits: ' : 'AI Credits: '}
                          {p.aiCredits === -1 || p.aiCredits === null || p.aiCredits === undefined ? (lang === 'VI' ? 'Vô hạn' : 'Unlimited') : `${p.aiCredits} /tháng`}
                        </span>
                      </li>
                      {p.features?.map((feat, idx) => (
                        <li key={idx} className="flex gap-2.5 items-start text-sm text-muted-foreground">
                          <CheckCircle2 className="size-4.5 text-success shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-8">
                    {isCurrent ? (
                      <Button className="w-full bg-muted text-muted-foreground border border-border/80" disabled>
                        Gói hiện tại
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-2"
                        variant={p.featured ? 'default' : 'outline'}
                        onClick={() => handleBuyPackage(p.id!)}
                        disabled={createOrderMutation.isPending}
                      >
                        <CreditCard className="size-4" />{' '}
                        {p.id === 'free'
                          ? lang === 'VI'
                            ? 'Dùng thử miễn phí'
                            : 'Try for free'
                          : lang === 'VI'
                            ? 'Mua ngay'
                            : 'Buy now'}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Transaction History */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Lịch sử giao dịch</h2>

          <div className="flex items-center gap-3">
            {/* Filters Bar */}
            {allOrders.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-0 bg-transparent border-0 shadow-none">
                <input
                  type="month"
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-[140px]"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value)
                    setPage(0)
                  }}
                />
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
                      {st === 'PAID' ? 'Đã thanh toán' : st === 'PENDING' ? 'Chờ thanh toán' : st === 'CANCELLED' ? 'Đã hủy' : 'Thất bại'}
                    </option>
                  ))}
                </select>
                {(selectedMonth || selectedStatus) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] text-destructive hover:bg-destructive/5 px-2"
                    onClick={() => {
                      setSelectedMonth('')
                      setSelectedStatus('')
                      setPage(0)
                    }}
                  >
                    Xóa lọc
                  </Button>
                )}
              </div>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={() => queryClient.invalidateQueries({ queryKey: getGetPaymentOrdersQueryKey(0, 1000) })}
            >
              <RefreshCw className="size-3" /> Làm mới
            </Button>
          </div>
        </div>

        {ordersLoading ? (
          <div className="text-center py-10 text-muted-foreground">Đang tải lịch sử giao dịch...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-muted/20">
            <CreditCard className="size-10 text-muted-foreground/60 mx-auto" />
            <p className="text-muted-foreground mt-3 text-sm">Chưa có giao dịch thanh toán nào khớp với bộ lọc.</p>
          </div>
        ) : (
          <div className="border border-border rounded-2xl overflow-hidden shadow-sm bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase font-semibold">
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-5">Mã đơn hàng</th>
                    <th className="text-left py-4 px-5">Gói dịch vụ</th>
                    <th className="text-left py-4 px-5">Số tiền</th>
                    <th className="text-left py-4 px-5">Trạng thái</th>
                    <th className="text-left py-4 px-5">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedOrders.map((o) => (
                    <tr key={o.orderId} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs text-foreground font-semibold">#{o.orderCode}</td>
                      <td className="py-3.5 px-5 text-foreground">{o.packageName}</td>
                      <td className="py-3.5 px-5 font-semibold text-foreground">{formatPrice(o.amount)}</td>
                      <td className="py-3.5 px-5">{getStatusBadge(o.status)}</td>
                      <td className="py-3.5 px-5 text-muted-foreground text-xs">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-4 bg-muted/20">
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
          </div>
        )}
      </div>
    </div>
  )
}
