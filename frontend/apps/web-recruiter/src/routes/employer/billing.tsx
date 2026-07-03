import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@smart-cv/ui";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useGetServicePackages,
  type ServicePackageResponse,
  useGetPaymentOrders,
  type OrderResponse,
  useCreatePaymentOrder,
  useCancelPaymentOrder,
  RecruiterApi,
  type RecruiterResponse,
  getGetPaymentOrdersQueryKey,
} from "@smart-cv/api";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/employer/billing")({
  head: () => ({ meta: [{ title: "Gói & Thanh toán — SmartCV" }] }),
  component: RecruiterBillingPage,
});

function RecruiterBillingPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [currentTime] = React.useState(() => Date.now());
  const size = 5;

  const { data: apiResponse } = RecruiterApi.useGetMe1();
  const recruiter = apiResponse?.data as RecruiterResponse | undefined;

  const { data: packagesData, isLoading: packagesLoading } = useGetServicePackages();
  const packages = packagesData?.data ?? [];
  const displayPackages = packages.filter((p) => p.id !== "fee");
  const platformFeePackage: ServicePackageResponse = packages.find((p) => p.id === "fee") || {
    id: "fee",
    name: "Phí sàn",
    price: 10000,
    durationDays: 30,
    features: ["Miễn phí tháng đầu tiên", "Thanh toán định kỳ mỗi tháng"],
  };

  // Fetch all payment orders (up to 1000) for client-side filtering/cascade options
  const { data: ordersData, isLoading: ordersLoading } = useGetPaymentOrders(0, 1000);
  const allOrders = React.useMemo(() => ordersData?.data?.content ?? [], [ordersData?.data?.content]);

  // Filter States
  const [selectedMonth, setSelectedMonth] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState('');
  const [selectedType, setSelectedType] = React.useState('');
  const [freePackageDialogOpen, setFreePackageDialogOpen] = React.useState(false);
  const [pendingPackageId, setPendingPackageId] = React.useState<string | null>(null);

  const matchesMonth = (o: OrderResponse, m: string) => !m || o.createdAt.startsWith(m);
  const matchesStatus = (o: OrderResponse, s: string) => !s || o.status === s;
  const matchesType = (o: OrderResponse, t: string) => !t || (o.paymentType || 'Gói sử dụng') === t;

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: unknown }).response === "object" &&
      (error as { response?: { data?: unknown } }).response?.data &&
      typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
    ) {
      return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
    }
    return fallback;
  };

  // Extract available options dynamically based on all *other* selected filters (Cascading Filters)
  const availableStatuses = React.useMemo(() => {
    const filtered = allOrders.filter(
      (o) => matchesMonth(o, selectedMonth) && matchesType(o, selectedType)
    );
    return Array.from(new Set(filtered.map((o) => o.status)));
  }, [allOrders, selectedMonth, selectedType]);

  const availableTypes = React.useMemo(() => {
    const filtered = allOrders.filter(
      (o) => matchesMonth(o, selectedMonth) && matchesStatus(o, selectedStatus)
    );
    return Array.from(new Set(filtered.map((o) => o.paymentType || 'Gói sử dụng')));
  }, [allOrders, selectedMonth, selectedStatus]);

  // Get final filtered list of orders
  const filteredOrders = React.useMemo(() => {
    return allOrders.filter(
      (o) =>
        matchesMonth(o, selectedMonth) &&
        matchesStatus(o, selectedStatus) &&
        matchesType(o, selectedType)
    );
  }, [allOrders, selectedMonth, selectedStatus, selectedType]);

  // Paginated subset of filtered orders
  const totalPages = Math.ceil(filteredOrders.length / size);
  const paginatedOrders = React.useMemo(() => {
    return filteredOrders.slice(page * size, (page + 1) * size);
  }, [filteredOrders, page, size]);

  const createOrderMutation = useCreatePaymentOrder();
  const cancelOrderMutation = useCancelPaymentOrder();
  const feeDueAt = recruiter?.platformFeeDueAt ? new Date(recruiter.platformFeeDueAt) : null;
  const feeLockedAt = recruiter?.platformFeeLockedAt ? new Date(recruiter.platformFeeLockedAt) : null;
  const feeIsOverdue = feeDueAt ? feeDueAt.getTime() <= currentTime : false;
  const feeIsLocked = Boolean(feeLockedAt);

  const handleBuyPackage = (packageId: string) => {
    if (packageId === "free") {
      setPendingPackageId(packageId);
      setFreePackageDialogOpen(true);
      return;
    }

    if (packageId === "fee") {
      createOrderMutation.mutate(
        { packageId },
        {
          onSuccess: (res) => {
            if (res.data?.paymentUrl) {
              window.location.href = res.data.paymentUrl;
            } else {
              toast.error("Không thể tạo liên kết thanh toán phí sàn.");
            }
          },
          onError: (err: unknown) => {
            toast.error(getErrorMessage(err, "Tạo đơn hàng phí sàn thất bại"));
          },
        }
      );
      return;
    }

    // Check if user is using a non-free package and it's still valid
    const isPremium = recruiter?.activePackageId && recruiter.activePackageId !== "free";
    const isNotExpired = recruiter?.packageExpiresAt && new Date(recruiter.packageExpiresAt) > new Date();
    if (isPremium && isNotExpired) {
      toast.error("Vui lòng sử dụng gói hiện tại đến hết thời hạn đăng ký.");
      return;
    }

    createOrderMutation.mutate(
      { packageId },
      {
        onSuccess: (res) => {
          if (res.data?.paymentUrl) {
            toast.success("Đang chuyển hướng đến trang thanh toán PayOS...");
            window.location.href = res.data.paymentUrl;
          } else {
            toast.error("Không thể tạo liên kết thanh toán.");
          }
        },
        onError: (err: unknown) => {
          toast.error(getErrorMessage(err, "Tạo đơn hàng thất bại"));
        },
      }
    );
  };

  const confirmFreePackage = () => {
    if (!pendingPackageId) {
      return;
    }

    createOrderMutation.mutate(
      { packageId: pendingPackageId },
      {
        onSuccess: (res) => {
          setFreePackageDialogOpen(false);
          setPendingPackageId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/recruiters/me"] as const });
          queryClient.invalidateQueries({ queryKey: getGetPaymentOrdersQueryKey(0, 1000) });
          if (res.data?.paymentUrl) {
            window.location.href = res.data.paymentUrl;
            return;
          }
          toast.success("Đã chuyển sang gói Free.");
        },
        onError: (err: unknown) => {
          setFreePackageDialogOpen(false);
          setPendingPackageId(null);
          toast.error(getErrorMessage(err, "Không thể chuyển sang gói Free"));
        },
      }
    );
  };

  const handleCancelOrder = (orderId: string) => {
    cancelOrderMutation.mutate(orderId, {
      onSuccess: () => {
        toast.success("Đã hủy đơn hàng thành công");
        queryClient.invalidateQueries({ queryKey: getGetPaymentOrdersQueryKey(0, 1000) });
      },
      onError: (err: unknown) => {
        toast.error(getErrorMessage(err, "Không thể hủy đơn hàng"));
      },
    });
  };

  const activePackage: ServicePackageResponse = packages.find((p) => p.id === recruiter?.activePackageId) || {
    name: "Free",
    features: ["3 tin/tháng", "AI Screening cơ bản"],
  };

  const formatPrice = (price: number) => {
    if (price === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  };

  const formatAiCredits = (remaining?: number, total?: number, used?: number) => {
    if (total === undefined || total === null || total === -1) {
      return "Không giới hạn";
    }
    return `${Math.max(remaining ?? Math.max(total - (used ?? 0), 0), 0)}/${total}`;
  };

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case "PAID":
        return "Paid";
      case "PENDING":
        return "Pending";
      case "CANCELLED":
        return "Cancelled";
      case "FAILED":
        return "Failed";
      default:
        return status;
    }
  };

  // Select dropdown class name for custom arrow and padding-right
  const selectClassName = "h-8 rounded-md border border-input bg-background pl-2.5 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-primary appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[right_0.5rem_center] bg-[length:1rem_1rem] bg-no-repeat w-[160px]";

  return (
    <div className="space-y-6">
      <Dialog open={freePackageDialogOpen} onOpenChange={setFreePackageDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Xác nhận đổi sang gói Free</DialogTitle>
            <DialogDescription>
              Gói Free sẽ được áp dụng ngay sau khi xác nhận. Không cần thanh toán qua PayOS.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreePackageDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={confirmFreePackage} disabled={createOrderMutation.isPending}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Gói & Thanh toán</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý quyền lợi tin tuyển dụng, lượt xem CV và dịch vụ AI.</p>
        </div>
      </div>

      {(feeIsOverdue || feeIsLocked) && (
        <button
          type="button"
          onClick={() => handleBuyPackage("fee")}
          className={`w-full rounded-2xl border p-5 text-left transition-colors ${feeIsLocked ? "border-destructive/30 bg-destructive/10 hover:bg-destructive/15" : "border-warning/30 bg-warning/10 hover:bg-warning/15"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-base">
                {feeIsLocked ? "Tài khoản đã bị khóa do chưa thanh toán phí sàn" : "Phí sàn đã đến hạn thanh toán"}
              </div>
              <div className="text-sm opacity-80 mt-1">
                {feeDueAt ? `Hạn thanh toán: ${formatDate(feeDueAt.toISOString())}` : "Phí sàn 10.000đ/tháng"}
              </div>
            </div>
            <Button disabled={createOrderMutation.isPending}>
              Thanh toán ngay
            </Button>
          </div>
        </button>
      )}

      {/* Current Active Package Dashboard */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-primary to-brand-blue text-white shadow-lg grid md:grid-cols-2 gap-6 items-center">
        <div>
          <div className="text-sm opacity-90 font-medium">Gói hiện tại của doanh nghiệp</div>
          <div className="text-3xl font-black mt-1">{activePackage?.name}</div>
          {activePackage?.durationDays && (
            <div className="text-sm opacity-90 mt-2">Thời hạn gói: {activePackage.durationDays} ngày</div>
          )}
          {recruiter?.packageExpiresAt ? (
            <div className="text-sm opacity-90 mt-1">Hạn sử dụng: {formatDate(recruiter.packageExpiresAt)}</div>
          ) : (
            <div className="text-sm opacity-90 mt-1">Sử dụng trọn đời hoặc chưa nâng cấp</div>
          )}
          <div className="mt-6 flex gap-2">
            <a href="#packages-section">
              <Button variant="secondary">Nâng cấp ngay</Button>
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat l="Quota Tin tuyển dụng" v={recruiter?.quotaJobPost !== undefined ? `${recruiter.quotaJobPost}` : "0"} />
          <Stat l="AI Credit còn lại" v={formatAiCredits(recruiter?.aiCreditsRemaining, recruiter?.aiCreditsTotal, recruiter?.aiCreditsUsed)} />
        </div>
      </div>

      {/* Available Packages Section */}
      <div id="packages-section" className="space-y-4">
        <h2 className="font-semibold text-lg">Các gói dịch vụ có sẵn</h2>
        {packagesLoading ? (
          <div className="text-center py-10 text-muted-foreground">Đang tải danh sách gói dịch vụ...</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {displayPackages.map((p) => {
              const isCurrent = recruiter?.activePackageId === p.id || (!recruiter?.activePackageId && p.id === "free");
              return (
                <div key={p.id} className={`card-surface p-5 flex flex-col justify-between ${p.featured ? "ring-2 ring-primary relative" : "border border-border/80"}`}>
                  {p.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Phổ biến
                    </span>
                  )}
                  <div>
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <div className="text-xl font-bold mt-1 text-primary">{formatPrice(p.price ?? 0)}</div>
                    <ul className="mt-3 space-y-1.5 text-sm">
                      <li className="flex gap-2 text-muted-foreground">
                        <CheckCircle2 className="size-4 text-success shrink-0" />
                        <span>
                          Số tin tuyển dụng: {p.jobLimit === -1 || p.jobLimit === null || p.jobLimit === undefined ? 'Vô hạn' : p.jobLimit}
                        </span>
                      </li>
                      <li className="flex gap-2 text-muted-foreground">
                        <CheckCircle2 className="size-4 text-success shrink-0" />
                        <span>
                          Số AI Credits: {p.aiCredits === -1 || p.aiCredits === null || p.aiCredits === undefined ? 'Vô hạn' : `${p.aiCredits} /tháng`}
                        </span>
                      </li>
                      {p.features?.map((f, idx) => (
                        <li key={idx} className="flex gap-2 text-muted-foreground">
                          <CheckCircle2 className="size-4 text-success shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-5">
                    {isCurrent ? (
                      <Button className="w-full" variant="outline" disabled>Gói hiện tại</Button>
                    ) : (
                      <Button
                        className="w-full gap-2"
                        variant={p.featured ? "default" : "outline"}
                        onClick={() => handleBuyPackage(p.id!)}
                        disabled={createOrderMutation.isPending}
                      >
                        <CreditCard className="size-4" /> {p.id === 'free' ? 'Dùng thử miễn phí' : 'Chọn gói'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Platform Fee Section */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">Phí sàn</h2>
        <div className="rounded-2xl border border-border/80 p-5 card-surface">
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <div>
              <div className="text-lg font-bold">{platformFeePackage.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {feeLockedAt
                  ? "Tài khoản đã bị khóa do quá hạn phí sàn."
                  : feeIsOverdue
                    ? "Phí sàn đã quá hạn, vui lòng thanh toán ngay để tránh bị khóa."
                    : recruiter?.platformFeeLastPaidAt
                      ? "Đã thanh toán phí sàn kỳ này."
                      : "Miễn phí tháng đầu tiên kể từ lúc tạo doanh nghiệp."}
              </div>
              {feeDueAt && (
                <div className="text-sm mt-2">
                  Hạn tiếp theo: <strong>{formatDate(feeDueAt.toISOString())}</strong>
                </div>
              )}
            </div>
            <div className="flex flex-col md:items-end gap-3">
              <div className="text-2xl font-black text-primary">10.000đ / tháng</div>
              {(!feeIsOverdue && !feeIsLocked && recruiter?.platformFeeLastPaidAt) ? (
                <Button disabled variant="outline" className="bg-success-soft text-success border-success/20 pointer-events-none">
                  Đã thanh toán
                </Button>
              ) : (
                <Button onClick={() => handleBuyPackage("fee")} disabled={createOrderMutation.isPending}>
                  Thanh toán phí sàn
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order Transaction History */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-semibold text-lg">Lịch sử thanh toán</h2>

          <div className="flex items-center gap-3">
            {/* Filters Bar */}
            {allOrders.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-0 bg-transparent border-0 shadow-none">
                <input
                  type="month"
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-[140px]"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setPage(0);
                  }}
                />
                <select
                  className={selectClassName}
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  {availableStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st === 'PAID' ? 'Đã thanh toán' : st === 'PENDING' ? 'Chờ thanh toán' : st === 'CANCELLED' ? 'Đã hủy' : 'Thất bại'}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClassName}
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả loại thanh toán</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {(selectedMonth || selectedStatus || selectedType) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] text-destructive hover:bg-destructive/5 px-2"
                    onClick={() => {
                      setSelectedMonth('');
                      setSelectedStatus('');
                      setSelectedType('');
                      setPage(0);
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
          <div className="text-center py-10 border border-dashed border-border rounded-xl bg-card">
            <p className="text-sm text-muted-foreground">Chưa có giao dịch thanh toán nào khớp với bộ lọc.</p>
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-left py-3 px-4">Mã HD</th>
                  <th className="text-left py-3 px-4">Gói dịch vụ</th>
                  <th className="text-left py-3 px-4">Loại thanh toán</th>
                  <th className="text-left py-3 px-4">Số tiền</th>
                  <th className="text-left py-3 px-4">Trạng thái</th>
                  <th className="text-left py-3 px-4">Ngày giao dịch</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((o) => (
                  <tr key={o.orderId} className="border-t border-border hover:bg-accent/30">
                    <td className="py-3 px-4 font-mono text-xs">#{o.orderCode}</td>
                    <td className="py-3 px-4 font-semibold">{o.packageName}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-foreground">
                      {o.paymentType ?? 'Gói sử dụng'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-primary">{formatPrice(o.amount)}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={getOrderStatusLabel(o.status)} />
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(o.createdAt)}</td>
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
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-lg bg-white/10 p-3 text-center">
      <div className="text-xl font-bold">{v}</div>
      <div className="text-[10px] opacity-80 leading-normal mt-0.5">{l}</div>
    </div>
  );
}
