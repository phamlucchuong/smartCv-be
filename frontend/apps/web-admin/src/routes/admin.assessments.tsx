import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
} from '@smart-cv/ui'
import {
  useGetRecruiterAssessments,
  useDeleteAssessment,
  getGetRecruiterAssessmentsQueryKey,
  ApplicationModels,
} from '@smart-cv/api'
import { toast } from 'sonner'
import {
  Search,
  Eye,
  Trash2,
  Mail,
  ShieldAlert,
  BookOpen,
  Clock,
  ListChecks,
  AlertTriangle,
  MoreHorizontal,
} from 'lucide-react'

type AssessmentResponse = ApplicationModels.AssessmentResponse

export const Route = createFileRoute('/admin/assessments')({
  component: AssessmentModerationPage,
})

function ViolationEmailModal({
  assessment,
  onClose,
}: {
  assessment: AssessmentResponse
  onClose: () => void
}) {
  const [emailSubject, setEmailSubject] = useState(`Cảnh báo vi phạm nội dung bài kiểm tra: ${assessment.title}`)
  const [emailBody, setEmailBody] = useState(
    `Kính gửi Quý nhà tuyển dụng,\n\nChúng tôi phát hiện bài kiểm tra "${assessment.title}" của bạn có dấu hiệu vi phạm chính sách nội dung của hệ thống SmartCV.\n\nChi tiết vi phạm: \n- Nội dung câu hỏi chưa phù hợp hoặc sao chép trái phép.\n\nYêu cầu quý đối tác thực hiện chỉnh sửa hoặc gỡ bỏ bài thi này trong vòng 24h để tránh bị khóa tài khoản.\n\nTrân trọng,\nĐội ngũ kiểm duyệt SmartCV.`
  )
  const [isSending, setIsSending] = useState(false)

  const handleSend = () => {
    if (!emailBody.trim()) {
      toast.error('Vui lòng nhập nội dung email cảnh báo')
      return
    }
    setIsSending(true)
    setTimeout(() => {
      setIsSending(false)
      toast.success(`Đã gửi email cảnh báo vi phạm tới nhà tuyển dụng liên kết thành công!`)
      onClose()
    }, 1500)
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 rounded-lg border border-border shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-destructive">
            <Mail className="h-5 w-5" />
            Gửi email nhắc nhở vi phạm
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Tiêu đề email</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Nội dung nhắc nhở</label>
            <textarea
              rows={8}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Hủy
          </Button>
          <Button onClick={handleSend} disabled={isSending} variant="destructive">
            {isSending ? 'Đang gửi...' : 'Gửi email cảnh báo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssessmentDetailModal({
  assessment,
  onClose,
}: {
  assessment: AssessmentResponse
  onClose: () => void
}) {
  const questions = assessment.questions ?? []

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto flex flex-col p-6 rounded-lg border border-border shadow-lg">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Chi tiết bài kiểm tra
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">ID bài thi: {assessment.id}</p>
        </DialogHeader>

        <div className="flex-grow space-y-6 py-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Tiêu đề bài kiểm tra</span>
              <span className="font-semibold text-foreground text-sm">{assessment.title}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Thời gian làm bài</span>
              <span className="font-semibold text-foreground text-sm flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {assessment.timeLimitMinutes} phút
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground block font-medium">Mô tả chi tiết</span>
              <span className="text-sm text-foreground/80">{assessment.description || '(Không có mô tả)'}</span>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ListChecks className="h-4.5 w-4.5 text-primary" />
              Danh sách câu hỏi ({questions.length})
            </h3>

            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Không có câu hỏi nào trong bài test này.</p>
            ) : (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border bg-muted/10 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-primary uppercase">Câu {idx + 1}</span>
                      <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded border border-border uppercase">
                        {q.type === 'MCQ' ? 'Trắc nghiệm' : 'Tự luận'}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-foreground leading-relaxed">{q.text}</h4>

                    {q.type === 'MCQ' && q.options && (
                      <div className="grid gap-2 pl-3 border-l-2 border-border">
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = q.correctOptionIndex === oIdx
                          return (
                            <div
                              key={oIdx}
                              className={`flex items-center gap-2 p-2 rounded text-xs font-medium border ${
                                isCorrect
                                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                                  : 'border-transparent text-muted-foreground'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isCorrect ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span>{opt}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssessmentModerationPage() {
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentResponse | null>(null)
  const [emailTargetAssessment, setEmailTargetAssessment] = useState<AssessmentResponse | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword)
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword])

  // Fetch assessments using standard hook
  const { data: apiResponse, isLoading, isError, refetch } = useGetRecruiterAssessments()
  const assessments = apiResponse?.data ?? []

  // Filter list locally: only ACTIVE (published) assessments, and by search keyword
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a: AssessmentResponse) => {
      if (a.status !== 'ACTIVE') return false
      const matchKey = debouncedKeyword.toLowerCase()
      return (
        !matchKey ||
        a.title?.toLowerCase().includes(matchKey) ||
        a.description?.toLowerCase().includes(matchKey)
      )
    })
  }, [assessments, debouncedKeyword])

  const deleteMutation = useDeleteAssessment({
    mutation: {
      onSuccess: () => {
        toast.success('Xoá bài kiểm tra thành công!')
        queryClient.invalidateQueries({ queryKey: getGetRecruiterAssessmentsQueryKey() })
        setDeletingId(null)
        refetch()
      },
      onError: (err: unknown) => {
        toast.error((err as { message?: string })?.message || 'Xoá bài kiểm tra thất bại.')
        setDeletingId(null)
      },
    },
  })

  const handleDeleteConfirm = () => {
    if (deletingId) {
      deleteMutation.mutate({ id: deletingId })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Kiểm duyệt bài kiểm tra (Assessments)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Quản lý, xem nội dung chi tiết, xóa bài test hoặc gửi email nhắc nhở vi phạm điều khoản cho nhà tuyển dụng.
          </p>
        </div>
        <div className="relative min-w-48 max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tên bài test..."
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
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
          <span>Không thể tải danh sách bài kiểm tra.</span>
          <Button variant="outline" onClick={() => refetch()}>
            Tải lại
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="card-surface overflow-x-auto border border-border rounded-xl shadow-sm">
          {filteredAssessments.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">
              Không có bài kiểm tra nào được tìm thấy.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="p-4">Tên bài kiểm tra</th>
                  <th className="p-4">Thời lượng</th>
                  <th className="p-4 text-center">Số câu hỏi</th>
                  <th className="p-4 text-center">Trạng thái</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredAssessments.map((a: AssessmentResponse) => (
                  <tr key={a.id} className="hover:bg-accent/30 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-foreground">{a.title ?? '—'}</div>
                      <div className="text-xs text-muted-foreground max-w-md truncate">
                        {a.description || 'Không có mô tả'}
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground font-medium">
                      {a.timeLimitMinutes} phút
                    </td>
                    <td className="p-4 text-center font-semibold">{a.questions?.length ?? 0}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          a.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }`}
                      >
                        {a.status === 'ACTIVE' ? 'Hoạt động' : 'Nháp'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0 cursor-pointer">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 bg-card border border-border">
                          <DropdownMenuItem
                            onClick={() => setSelectedAssessment(a)}
                            className="cursor-pointer flex items-center gap-2"
                          >
                            <Eye className="size-3.5" />
                            Xem nội dung
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEmailTargetAssessment(a)}
                            className="cursor-pointer flex items-center gap-2"
                          >
                            <Mail className="size-3.5" />
                            Cảnh báo vi phạm
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingId(a.id!)}
                            className="cursor-pointer text-destructive focus:text-destructive flex items-center gap-2"
                          >
                            <Trash2 className="size-3.5" />
                            Xóa bài test
                          </DropdownMenuItem>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-md p-6 rounded-lg border border-border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Xác nhận xóa bài test
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Hành động này sẽ xóa vĩnh viễn bài kiểm tra khỏi hệ thống và không thể phục hồi. Bạn có chắc chắn muốn xóa?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteMutation.isPending}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      {selectedAssessment && (
        <AssessmentDetailModal
          assessment={selectedAssessment}
          onClose={() => setSelectedAssessment(null)}
        />
      )}

      {/* Violation Alert Modal */}
      {emailTargetAssessment && (
        <ViolationEmailModal
          assessment={emailTargetAssessment}
          onClose={() => setEmailTargetAssessment(null)}
        />
      )}
    </div>
  )
}
