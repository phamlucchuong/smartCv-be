import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  JOB_CATEGORY_LABELS,
} from '@smart-cv/ui'
import { StatusBadge } from '@/components/ui-kit/StatusBadge'
import { useTranslation } from '@smart-cv/i18n'
import { RecruiterApi } from '@smart-cv/api'
import type { RecruiterResponse } from '@smart-cv/api'
import { toast } from 'sonner'
import { ExternalLink, Search, MoreHorizontal } from 'lucide-react'

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED'

export const Route = createFileRoute('/admin/employer-verification')({ component: EmployerVerificationPage })

function EmployerVerificationPage() {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<StatusFilter | undefined>('PENDING')
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [selectedRecruiter, setSelectedRecruiter] = useState<RecruiterResponse | null>(null)

  const handleViewLicense = (url: string) => {
    if (!url) return
    window.open(url, '_blank')
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setDebouncedKeyword(keyword)
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const { data, isLoading, refetch } = RecruiterApi.useGetAll({
    status: statusFilter,
    page,
    size: 10,
    keyword: debouncedKeyword || undefined,
  })
  const recruiters = data?.data?.items ?? []
  const totalPages = data?.data?.totalPages ?? 1

  const updateStatusMutation = RecruiterApi.useUpdateStatus({
    mutation: {
      onSuccess: () => {
        toast.success('Đã cập nhật trạng thái')
        refetch()
        setRejectTarget(null)
        setRejectionNote('')
      },
      onError: () => {
        toast.error('Cập nhật trạng thái thất bại. Vui lòng thử lại.')
      },
    },
  })

  const handleApprove = (id: string) => {
    updateStatusMutation.mutate({ id, data: { status: 'APPROVED' } })
  }

  const handleRejectConfirm = () => {
    if (!rejectTarget) return
    updateStatusMutation.mutate({
      id: rejectTarget,
      data: { status: 'REJECTED', rejectionNote },
    })
  }

  const STATUS_TABS: StatusFilter[] = ['PENDING', 'APPROVED', 'REJECTED']

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">{t('admin_employer_verification_title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('admin_search_recruiters_placeholder')}
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPage(1)
                  setStatusFilter((current) => (current === s ? undefined : s))
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === s
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/70'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : recruiters.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Không có hồ sơ nào.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">{t('admin_col_company')}</th>
                <th className="p-3">{t('admin_col_representative')}</th>
                <th className="p-3">{t('admin_col_registered_date')}</th>
                <th className="p-3">{t('admin_col_document')}</th>
                <th className="p-3">{t('admin_col_status')}</th>
                <th className="p-3">{t('admin_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {recruiters.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-medium">{r.companyName ?? '—'}</td>
                  <td className="p-3">{r.contactName ?? r.fullName ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="p-3">
                    {r.businessLicenseUrl ? (
                      <button
                        onClick={() => handleViewLicense(r.businessLicenseUrl!)}
                        className="flex items-center gap-1 text-primary hover:underline text-xs cursor-pointer bg-transparent border-0 p-0 font-medium"
                      >
                        Xem <ExternalLink className="size-3" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs">Chưa tải lên</span>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status ?? 'PENDING'} />
                  </td>
                  <td className="p-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0 cursor-pointer">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-card border border-border">
                        <DropdownMenuItem
                          onClick={() => setSelectedRecruiter(r)}
                          className="cursor-pointer"
                        >
                          Xem hồ sơ
                        </DropdownMenuItem>
                        {r.status === 'PENDING' && r.id && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleApprove(r.id!)}
                              disabled={updateStatusMutation.isPending}
                              className="cursor-pointer"
                            >
                              {t('admin_action_approve')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRejectTarget(r.id!)
                                setRejectionNote('')
                              }}
                              disabled={updateStatusMutation.isPending}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              {t('admin_action_reject')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('admin_page_of', { page, total: totalPages })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t('admin_pagination_prev')}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              {t('admin_pagination_next')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối hồ sơ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Lý do từ chối</label>
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              rows={4}
              placeholder="Nhập lý do để nhà tuyển dụng biết cần chỉnh sửa gì..."
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionNote.trim() || updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRecruiter} onOpenChange={(open) => !open && setSelectedRecruiter(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>Thông tin nhà tuyển dụng</span>
              {selectedRecruiter && <StatusBadge status={selectedRecruiter.status ?? 'PENDING'} />}
            </DialogTitle>
          </DialogHeader>
          {selectedRecruiter && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Tên công ty" value={selectedRecruiter.companyName} />
                <DetailField label="Mã số thuế" value={selectedRecruiter.taxCode} />
                <DetailField label="Email liên hệ" value={selectedRecruiter.contactEmail} />
                <DetailField label="Số điện thoại" value={selectedRecruiter.contactPhone} />
                <DetailField label="Quy mô công ty" value={selectedRecruiter.companySize} />
                <DetailField label="Lĩnh vực hoạt động" value={selectedRecruiter.industry} />
                <DetailField label="Danh mục ngành nghề" value={(selectedRecruiter as unknown as { category?: string }).category ? JOB_CATEGORY_LABELS[(selectedRecruiter as unknown as { category?: string }).category!] : undefined} />
                <DetailField label="Người đại diện" value={selectedRecruiter.contactName ?? selectedRecruiter.fullName} />
                <DetailField label="Website" value={selectedRecruiter.companyWebsite} isLink />
                <DetailField label="Ngày đăng ký" value={selectedRecruiter.createdAt ? new Date(selectedRecruiter.createdAt).toLocaleDateString('vi-VN') : undefined} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Giấy phép kinh doanh</label>
                {selectedRecruiter.businessLicenseUrl ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Tài liệu giấy phép kinh doanh</span>
                    <button
                      onClick={() => handleViewLicense(selectedRecruiter.businessLicenseUrl!)}
                      className="flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium"
                    >
                      Xem chi tiết <ExternalLink className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">Chưa tải lên giấy phép kinh doanh</div>
                )}
              </div>

              {selectedRecruiter.status === 'REJECTED' && selectedRecruiter.rejectionNote && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-1">
                  <div className="text-sm font-semibold text-destructive">Lý do từ chối trước đó</div>
                  <div className="text-sm text-foreground/80">{selectedRecruiter.rejectionNote}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {/* <Button variant="outline" onClick={() => setSelectedRecruiter(null)}>
              Đóng
            </Button> */}
            {selectedRecruiter?.status === 'PENDING' && (
              <>
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setRejectTarget(selectedRecruiter.id!)
                    setRejectionNote('')
                    setSelectedRecruiter(null)
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  Từ chối
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(selectedRecruiter.id!)
                    setSelectedRecruiter(null)
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  Phê duyệt
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailField({ label, value, isLink }: { label: string; value?: string | null; isLink?: boolean }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-sm font-medium text-foreground truncate">
        {isLink && value ? (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
            {value} <ExternalLink className="size-3 inline" />
          </a>
        ) : (
          value ?? <span className="text-muted-foreground italic font-normal">—</span>
        )}
      </div>
    </div>
  )
}
