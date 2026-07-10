import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@smart-cv/ui'
import { StatusBadge } from '@/components/ui-kit/StatusBadge'
import { useTranslation } from '@smart-cv/i18n'
import {
  useGetAdminJobs,
  useApproveJob,
  useRejectJob,
  getGetAdminJobsQueryKey,
} from '@smart-cv/api'
import type { JobResponse } from '@smart-cv/api'
import { toast } from 'sonner'
import { Search, MoreHorizontal } from 'lucide-react'

export const Route = createFileRoute('/admin/job-moderation')({ component: JobModerationPage })

type ModerationFilter = 'PENDING' | 'PUBLISHED' | ''

type ApiError = { response?: { data?: { message?: string } } }

function RejectModal({
  jobId,
  onClose,
  onSuccess,
}: {
  jobId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [note, setNote] = useState('')
  const rejectMutation = useRejectJob()

  const handleReject = async () => {
    const trimmed = note.trim()
    if (!trimmed) {
      toast.error('Vui lòng nhập lý do từ chối')
      return
    }
    try {
      await rejectMutation.mutateAsync({ id: jobId, data: { note: trimmed } })
      toast.success('Đã từ chối tin tuyển dụng')
      onSuccess()
    } catch (err: unknown) {
      const e = err as ApiError
      toast.error(e.response?.data?.message ?? 'Từ chối thất bại')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Từ chối tin tuyển dụng</h2>
        <div>
          <label className="text-sm font-medium">Lý do từ chối</label>
          <textarea
            className="mt-1.5 w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
            rows={4}
            placeholder="Nhập lý do từ chối để recruiter biết cần sửa gì..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={rejectMutation.isPending}>
            Huỷ
          </Button>
          <Button onClick={handleReject} disabled={rejectMutation.isPending}>
            {rejectMutation.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function JobDetailModal({
  job,
  onClose,
}: {
  job: JobResponse
  onClose: () => void
}) {
  function formatSalary(min?: number, max?: number) {
    if (min === undefined && max === undefined) return 'Thoả thuận'
    if (min !== undefined && max !== undefined) return `${min.toLocaleString()} - ${max.toLocaleString()} VND`
    if (min !== undefined) return `Từ ${min.toLocaleString()} VND`
    if (max !== undefined) return `Đến ${max.toLocaleString()} VND`
    return 'Thoả thuận'
  }

  function formatJobType(type?: string) {
    switch (type) {
      case 'FULL_TIME': return 'Full-time'
      case 'PART_TIME': return 'Part-time'
      case 'REMOTE': return 'Remote'
      case 'CONTRACT': return 'Hợp đồng'
      case 'INTERNSHIP': return 'Thực tập'
      default: return 'Chưa cập nhật'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{job.title || 'Không có tiêu đề'}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Doanh nghiệp: <span className="font-semibold text-foreground">{job.company || 'Chưa cập nhật'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl font-medium p-1"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Địa điểm</span>
              <span className="font-medium">{job.location || 'Chưa cập nhật'}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Mức lương</span>
              <span className="font-medium text-success">{formatSalary(job.salaryMin, job.salaryMax)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Loại hình công việc</span>
              <span className="font-medium">{formatJobType(job.jobType)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Số lượng cần tuyển</span>
              <span className="font-medium">{job.openings ? `${job.openings} người` : 'Chưa cập nhật'}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Kinh nghiệm yêu cầu</span>
              <span className="font-medium">{job.experienceLevel || 'Chưa cập nhật'}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Hạn nộp hồ sơ</span>
              <span className="font-medium text-warning">
                {job.deadline ? new Intl.DateTimeFormat('vi-VN').format(new Date(job.deadline)) : 'Chưa cập nhật'}
              </span>
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-primary">Mô tả công việc</h3>
              <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{job.description}</p>
            </div>
          )}

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-primary">Yêu cầu công việc</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
                {job.requirements.map((req: string, idx: number) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && job.benefits.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-primary">Quyền lợi</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
                {job.benefits.map((ben: string, idx: number) => (
                  <li key={idx}>{ben}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-primary">Kỹ năng yêu cầu</h3>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((skill: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  )
}

function JobModerationPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<ModerationFilter>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null)
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobResponse | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setDebouncedKeyword(keyword)
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const { data, isLoading, isError, refetch } = useGetAdminJobs({
    moderationStatus: filter || undefined,
    keyword: debouncedKeyword || undefined,
    category: categoryFilter || undefined,
    page,
    size: 10,
  })
  const jobs = data?.data?.items ?? []
  const totalPages = data?.data?.totalPages ?? 1

  const approveMutation = useApproveJob()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetAdminJobsQueryKey(), exact: false })

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ id })
      toast.success('Đã phê duyệt tin tuyển dụng')
      invalidate()
    } catch (err: unknown) {
      const e = err as ApiError
      toast.error(e.response?.data?.message ?? 'Phê duyệt thất bại')
    }
  }

  function formatDate(date?: string) {
    if (!date) return '—'
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date))
  }

  function formatModerationStatus(status?: string) {
    if (status === 'PENDING') return 'Pending'
    if (status === 'PUBLISHED') return 'Approved'
    if (status === 'DRAFT') return 'Draft'
    return 'Unknown'
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">{t('admin_job_moderation_title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên việc, công ty..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => { setPage(1); setFilter(e.target.value as ModerationFilter) }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
          >
            <option value="">Tất cả (tình trạng)</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="PUBLISHED">Đã duyệt</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setPage(1); setCategoryFilter(e.target.value) }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
          >
            <option value="">Tất cả ngành nghề</option>
            <option value="IT_SOFTWARE">IT &amp; Software</option>
            <option value="FINANCE_BANKING">Finance &amp; Banking</option>
            <option value="MARKETING">Marketing &amp; Advertising</option>
            <option value="HEALTHCARE">Healthcare &amp; Pharma</option>
            <option value="EDUCATION">Education &amp; Training</option>
            <option value="MANUFACTURING">Manufacturing &amp; Production</option>
            <option value="RETAIL">Retail &amp; Consumer Goods</option>
            <option value="REAL_ESTATE">Real Estate &amp; Construction</option>
            <option value="TRANSPORTATION">Transportation &amp; Logistics</option>
            <option value="MEDIA_ENTERTAINMENT">Media &amp; Entertainment</option>
            <option value="LEGAL_CONSULTING">Legal &amp; Consulting</option>
            <option value="HUMAN_RESOURCES">Human Resources</option>
            <option value="AGRICULTURE">Agriculture</option>
            <option value="ENERGY_ENVIRONMENT">Energy &amp; Environment</option>
            <option value="HOSPITALITY_TOURISM">Hospitality &amp; Tourism</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="card-surface p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="card-surface p-6 text-sm flex items-center justify-between">
          <span>Không thể tải danh sách tin tuyển dụng.</span>
          <Button variant="outline" onClick={() => refetch()}>
            Tải lại
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="card-surface overflow-x-auto">
          {jobs.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">
              Không có tin tuyển dụng nào phù hợp với bộ lọc.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">{t('admin_col_title')}</th>
                  <th className="p-3">{t('admin_col_company')}</th>
                  <th className="p-3">{t('admin_col_posted_date')}</th>
                  <th className="p-3">{t('admin_col_status')}</th>
                  <th className="p-3">{t('admin_col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-border hover:bg-accent/40">
                    <td className="p-3">
                      <div className="font-medium">{job.title ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{job.location ?? '—'}</div>
                    </td>
                    <td className="p-3">{job.company ?? '—'}</td>
                    <td className="p-3">{formatDate(job.createdAt)}</td>
                    <td className="p-3">
                      <StatusBadge status={formatModerationStatus(job.moderationStatus)} />
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
                            onClick={() => setSelectedJobDetail(job)}
                            className="cursor-pointer"
                          >
                            Chi tiết
                          </DropdownMenuItem>
                          {job.moderationStatus === 'PENDING' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleApprove(job.id!)}
                                disabled={approveMutation.isPending}
                                className="cursor-pointer"
                              >
                                {t('admin_action_approve')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setRejectingJobId(job.id!)}
                                className="cursor-pointer text-danger focus:text-danger"
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
      )}

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

      {rejectingJobId && (
        <RejectModal
          jobId={rejectingJobId}
          onClose={() => setRejectingJobId(null)}
          onSuccess={() => {
            setRejectingJobId(null)
            invalidate()
          }}
        />
      )}

      {selectedJobDetail && (
        <JobDetailModal
          job={selectedJobDetail}
          onClose={() => setSelectedJobDetail(null)}
        />
      )}
    </div>
  )
}
