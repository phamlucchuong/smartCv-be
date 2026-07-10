import { createFileRoute } from '@tanstack/react-router';
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle } from '@smart-cv/ui';
import { toast } from 'sonner';

import { Clock, ClipboardCheck, ChevronDown, ChevronLeft, History, Plus, Sparkles, Trash2, Upload, Download, HelpCircle, Edit } from 'lucide-react'
import { useTranslation } from '@smart-cv/i18n'
import {
  useGetMyAssessments,
  useGetAssessment,
  useGetAttemptState,
  useSaveAnswers,
  useStartAttempt,
  useSubmitAttempt,
  useGetResult,
  ApplicationModels,
  useSubmitAttemptWithFlag,
  useCreateSelfAssessment,
  useGetMySelfAssessments,
  useDeleteAssessment,
  useDeleteAttempt,
  parseAssessmentFile,
  downloadAssessmentTemplate,
  useUpdateAssessment,
  useGenerateAssessmentQuestions,
} from '@smart-cv/api'
import { useAuthStore } from '../../store/useAuthStore'

type AssessmentsSearch = {
  take?: string
}

export const Route = createFileRoute('/_account/assessments')({
  validateSearch: (search: Record<string, unknown>): AssessmentsSearch => ({
    take: typeof search.take === 'string' ? search.take : undefined,
  }),
  component: AssessmentsPage,
})

type AttemptStateResponse = ApplicationModels.AttemptStateResponse
type AssessmentResponse = ApplicationModels.AssessmentResponse
type AttemptAnswer = ApplicationModels.AttemptAnswer
type Question = ApplicationModels.Question
type LocalAnswer = { selectedOptionIndex?: number; textAnswer?: string }
type MutationError = { message?: string }
type GroupedAssessment = {
  assessmentId: string
  attempts: AttemptStateResponse[]
  latestAttempt: AttemptStateResponse
}

const MCQ = 'MCQ' as const

function formatDate(dateInput?: string | Date): string {
  if (!dateInput) return ''
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      const [year, month, day] = cleanStr.split('-')
      return `${day}/${month}/${year}`
    }
    if (cleanStr.includes('T')) {
      const datePart = cleanStr.split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('-')
        return `${day}/${month}/${year}`
      }
    }
  }
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

type AssessmentStatusFilter = 'all' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED'
type AssessmentSourceFilter = 'all' | 'self' | 'recruiter'

const statusStyle: Record<string, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground border border-border',
  IN_PROGRESS: 'bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20',
  SUBMITTED: 'bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/20',
  EXPIRED: 'bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20',
}

function getStatusLabel(t: (k: string) => string, key: string) {
  switch (key) {
    case 'NOT_STARTED': return t('assessments_status_not_started')
    case 'IN_PROGRESS': return t('assessments_status_in_progress')
    case 'SUBMITTED': return t('assessments_status_submitted')
    case 'EXPIRED': return t('assessments_status_expired')
    default: return key
  }
}

function getFilterLabel(t: (k: string) => string, key: AssessmentStatusFilter) {
  switch (key) {
    case 'all': return t('assessments_filter_all')
    case 'NOT_STARTED': return t('assessments_filter_not_started')
    case 'IN_PROGRESS': return t('assessments_status_in_progress')
    case 'SUBMITTED': return t('assessments_filter_submitted')
    case 'EXPIRED': return t('assessments_filter_expired')
  }
}

function getSourceFilterLabel(t: (k: string) => string, key: AssessmentSourceFilter) {
  switch (key) {
    case 'all': return t('assessments_source_filter_all')
    case 'self': return t('assessments_source_filter_self')
    case 'recruiter': return t('assessments_source_filter_recruiter')
  }
}

function formatAttemptScore(attempt: AttemptStateResponse): string {
  if (attempt.result === 'PENDING') return 'Chờ chấm'
  if (attempt.correctAnswers != null && attempt.totalQuestions != null && attempt.totalQuestions > 0) {
    return `${attempt.correctAnswers}/${attempt.totalQuestions}`
  }
  return '—'
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as MutationError
    if (typeof message === 'string' && message.trim() !== '') {
      return message
    }
  }
  return fallback
}


function isAnswered(q: Question, answers: Record<string, LocalAnswer>): boolean {
  const ans = answers[q.id ?? '']
  if (!ans) return false
  return q.type === MCQ ? ans.selectedOptionIndex !== undefined : !!(ans.textAnswer?.trim())
}

// Fetches assessment title for a single attempt card
function AssessmentCard({
  assessmentId,
  attempts,
  latestAttempt,
  onTake,
  onTitleLoaded,
  onRetake,
  isRetaking,
  onViewHistory,
  isSelfCreated,
  onDelete,
  onUnsave,
  onEdit,
}: {
  assessmentId: string
  attempts: AttemptStateResponse[]
  latestAttempt: AttemptStateResponse
  onTake: (assessmentId: string, attemptId: string) => void
  onTitleLoaded: (assessmentId: string, title: string) => void
  onRetake?: (assessmentId: string) => void
  isRetaking?: boolean
  onViewHistory: (assessmentId: string, title: string) => void
  isSelfCreated?: boolean
  onDelete?: (assessmentId: string) => void
  onUnsave?: (attempts: AttemptStateResponse[]) => void
  onEdit?: (assessmentId: string) => void
}) {
  const { t } = useTranslation()
  const { data: assessmentData } = useGetAssessment(assessmentId, {
    query: { enabled: !!assessmentId },
  })
  const title = assessmentData?.data?.title ?? assessmentId
  const itemStatus = String(latestAttempt.status ?? 'NOT_STARTED')

  // Report the loaded title to the parent for search filtering
  React.useEffect(() => {
    if (assessmentData?.data?.title && assessmentId) {
      onTitleLoaded(assessmentId, assessmentData.data.title)
    }
  }, [assessmentData?.data?.title, assessmentId, onTitleLoaded])

  // Determine active attempt (IN_PROGRESS) or NOT_STARTED
  const notStartedAttempt = attempts.find((att) => String(att.status) === 'NOT_STARTED')

  const isCancelled = React.useMemo(() => {
    if (!latestAttempt.attemptId) return false
    try {
      const cancelled = JSON.parse(localStorage.getItem('cancelledAttempts') || '[]')
      return Array.isArray(cancelled) && cancelled.includes(latestAttempt.attemptId)
    } catch {
      return false
    }
  }, [latestAttempt.attemptId])

  return (
    <div className="card-surface p-5 flex flex-col h-full gap-4">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ai-soft)] text-[var(--ai)]">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onViewHistory(assessmentId, title)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer mr-1"
            title="Lịch sử làm bài"
          >
            <History className="h-4 w-4" />
            <span className="font-medium">{attempts.length}</span>
          </button>
          {isCancelled ? (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-red-500/10 text-red-600 border border-red-500/20">
              Hủy giữa chừng
            </span>
          ) : (
            <>
              {itemStatus === 'SUBMITTED' && (
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                  latestAttempt.result === 'PENDING'
                    ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                    : latestAttempt.result === 'PASS'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-600 border border-red-500/20'
                }`}>
                  {formatAttemptScore(latestAttempt)}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[itemStatus] ?? statusStyle['NOT_STARTED']}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {getStatusLabel(t, itemStatus)}
              </span>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {itemStatus !== "NOT_STARTED" && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Lần làm cuối: {latestAttempt.startedAt ? `${formatDate(latestAttempt.startedAt)} lúc ${new Date(latestAttempt.startedAt).toLocaleTimeString()}` : "—"}
            </span>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-3">
          <span>Số câu: <strong className="text-foreground">{assessmentData?.data?.questions?.length ?? 0}</strong></span>
          <span>•</span>
          <span>Thời gian: <strong className="text-foreground">{assessmentData?.data?.timeLimitMinutes ?? 30} phút</strong></span>
        </div>
        {assessmentData?.data?.description && (
          <p className="text-muted-foreground/80 line-clamp-2 mt-1">
            {assessmentData.data.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 mt-auto pt-2">
        {attempts.length === 0 || notStartedAttempt ? (
          <Button
            className="flex-1 cursor-pointer"
            onClick={() => onTake(assessmentId, notStartedAttempt?.attemptId ?? '')}
          >
            Bắt đầu làm bài
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetake?.(assessmentId)}
            disabled={isRetaking}
            className="flex-1 cursor-pointer"
          >
            Làm lại
          </Button>
        )}

        {isSelfCreated ? (
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEdit?.(assessmentId)}
              className="text-muted-foreground hover:text-primary transition-colors cursor-pointer p-2 border border-border rounded-md flex items-center justify-center h-9 w-9"
              title="Chỉnh sửa bài test"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(assessmentId)}
              className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer p-2 border border-border rounded-md flex items-center justify-center h-9 w-9"
              title="Xóa bài test"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onUnsave?.(attempts)}
            className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer p-2 border border-border rounded-md shrink-0 flex items-center justify-center h-9 w-9"
            title="Hủy lưu bài test"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function AssessmentsPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthStore()
  const { take: takeAssessmentId } = Route.useSearch()
  const { data, isLoading, isError } = useGetMyAssessments({ query: { enabled: isAuthenticated } })
  const assessments = React.useMemo(() => data?.data ?? [], [data?.data])

  const { data: selfData, isLoading: isSelfLoading, isError: isSelfError } = useGetMySelfAssessments({ query: { enabled: isAuthenticated } })
  const selfAssessments = React.useMemo(() => selfData?.data ?? [], [selfData?.data])

  const combinedLoading = isLoading || isSelfLoading
  const combinedError = isError || isSelfError

  const queryClient = useQueryClient()
  const [taking, setTaking] = React.useState<{ assessmentId: string; attemptId: string } | null>(null)
  const [historyAssessment, setHistoryAssessment] = React.useState<{ assessmentId: string; title: string } | null>(null)

  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [isEditMode, setIsEditMode] = React.useState(false)
  const [currentId, setCurrentId] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState(30)
  const [questions, setQuestions] = React.useState<Question[]>([])

  const [isAiDialogOpen, setIsAiDialogOpen] = React.useState(false)
  const [aiJobName, setAiJobName] = React.useState('')
  const [aiDifficulty, setAiDifficulty] = React.useState('Medium')
  const [aiLevel, setAiLevel] = React.useState('Junior')
  const [aiNumQuestions, setAiNumQuestions] = React.useState<number | "">(5)

  const generateMutation = useGenerateAssessmentQuestions()

  const importInputRef = React.useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = React.useState(false)

  const handleOpenCreate = () => {
    setIsEditMode(false)
    setCurrentId(null)
    setTitle('')
    setDescription('')
    setTimeLimitMinutes(30)
    setQuestions([])
    setIsFormOpen(true)
  }

  const handleOpenEdit = (assessmentId: string) => {
    const sa = selfAssessments.find((x) => x.id === assessmentId)
    if (!sa) return
    setIsEditMode(true)
    setCurrentId(sa.id || null)
    setTitle(sa.title || '')
    setDescription(sa.description || '')
    setTimeLimitMinutes(sa.timeLimitMinutes || 30)
    setQuestions(sa.questions ? [...sa.questions] : [])
    setIsFormOpen(true)
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setIsImporting(true)
    try {
      const result = await parseAssessmentFile(file)
      if (result.questions.length === 0) {
        const reasons = result.skippedRows.map(r => `Dòng ${r.rowNumber}: ${r.reason}`).join(' | ')
        toast.error(`Không tìm thấy câu hỏi hợp lệ.${reasons ? ' ' + reasons : ''}`)
        return
      }
      toast.success(`Đã import ${result.questions.length} câu hỏi`)
      if (result.skippedRows.length > 0) {
        const detail = result.skippedRows.map(r => `Dòng ${r.rowNumber}: ${r.reason}`).join(' | ')
        toast.warning(`Bỏ qua ${result.skippedRows.length} dòng không hợp lệ: ${detail}`)
      }
      setQuestions(result.questions)
      setTitle('')
      setDescription('')
      setTimeLimitMinutes(30)
      setIsFormOpen(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'File không đọc được. Vui lòng dùng file .xlsx hoặc .csv hợp lệ.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleAiConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiJobName.trim()) {
      toast.error('Vui lòng nhập tên công việc')
      return
    }
    generateMutation.mutate(
      { jobName: aiJobName, level: aiLevel, difficulty: aiDifficulty, numQuestions: Number(aiNumQuestions) || 5 },
      {
        onSuccess: (response) => {
          const generatedQuestions = response.data?.questions ?? []
          if (generatedQuestions.length === 0) {
            toast.error('AI không tạo được câu hỏi. Vui lòng thử lại.')
            return
          }
          const mapped: Question[] = generatedQuestions.slice(0, Number(aiNumQuestions) || 5).map((q) => ({
            id: crypto.randomUUID(),
            text: q.text,
            type: 'MCQ' as const,
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
          }))
          setQuestions(mapped)
          setTitle(`Bài test ${aiJobName} - Trình độ ${aiLevel}`)
          setDescription(`Bài test tự động tạo bằng AI cho vị trí ${aiJobName} (${aiLevel}) với độ khó ${aiDifficulty}.`)
          setIsAiDialogOpen(false)
          setIsFormOpen(true)
          toast.success('Đã tạo câu hỏi bằng AI thành công!')
        },
        onError: (err: any) => {
          const errCode = err?.response?.data?.code;
          if (errCode === 8012 || errCode === 6008) {
            toast.error('Hết lượt sử dụng AI. Vui lòng nâng cấp gói dịch vụ.')
          } else {
            toast.error('Không thể tạo câu hỏi bằng AI. Vui lòng thử lại.')
          }
        },
      }
    )
  }

  const createMutation = useCreateSelfAssessment({
    mutation: {
      onSuccess: () => {
        toast.success("Tạo bài kiểm tra thành công!")
        queryClient.invalidateQueries({ queryKey: ['/api/assessments/my'] })
        queryClient.invalidateQueries({ queryKey: ['/api/assessments/self'] })
        setIsFormOpen(false)
        setTitle('')
        setDescription('')
        setTimeLimitMinutes(30)
        setQuestions([])
      },
      onError: (err: unknown) => {
        toast.error(getErrorMessage(err, "Tạo bài kiểm tra thất bại."))
      },
    },
  })

  const updateMutation = useUpdateAssessment({
    mutation: {
      onSuccess: () => {
        toast.success("Cập nhật bài kiểm tra thành công!")
        queryClient.invalidateQueries({ queryKey: ['/api/assessments/my'] })
        queryClient.invalidateQueries({ queryKey: ['/api/assessments/self'] })
        setIsFormOpen(false)
        setTitle('')
        setDescription('')
        setTimeLimitMinutes(30)
        setQuestions([])
      },
      onError: (err: unknown) => {
        toast.error(getErrorMessage(err, "Cập nhật bài kiểm tra thất bại."))
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Vui lòng nhập tên bài test")
      return
    }
    const payload = {
      title,
      description,
      timeLimitMinutes,
      questions,
    }
    if (isEditMode && currentId) {
      updateMutation.mutate({ id: currentId, data: payload })
    } else {
      createMutation.mutate({ data: payload })
    }
  }

  const startAttemptMutation = useStartAttempt()
  const submitMutation = useSubmitAttempt()
  const hasAutoStarted = React.useRef(false)

  const handleRetake = (assessmentId: string) => {
    // Find if there is any active IN_PROGRESS attempt for this assessment
    const group = grouped.find((g) => g.assessmentId === assessmentId)
    const activeAttempt = group?.attempts.find((a) => a.status === 'IN_PROGRESS')

    const proceedToStart = () => {
      startAttemptMutation.mutate(
        { id: assessmentId },
        {
          onSuccess: (res: { data?: { attemptId?: string } }) => {
            const attemptId = res?.data?.attemptId ?? ''
            if (attemptId) {
              setTaking({ assessmentId, attemptId })
              queryClient.invalidateQueries({ queryKey: ['/api/assessments/my'] })
            }
          },
        },
      )
    }

    if (activeAttempt?.attemptId) {
      // Submit the active attempt first to finalize it
      submitMutation.mutate(
        { attemptId: activeAttempt.attemptId },
        {
          onSuccess: () => {
            proceedToStart()
          },
          onError: () => {
            // Even if submit fails (e.g. already submitted), try starting
            proceedToStart()
          }
        }
      )
    } else {
      proceedToStart()
    }
  }

  const handleTake = (assessmentId: string, attemptId: string) => {
    if (attemptId) {
      setTaking({ assessmentId, attemptId })
    } else {
      startAttemptMutation.mutate(
        { id: assessmentId },
        {
          onSuccess: (res: { data?: { attemptId?: string } }) => {
            const newAttemptId = res?.data?.attemptId ?? ''
            if (newAttemptId) {
              setTaking({ assessmentId, attemptId: newAttemptId })
              queryClient.invalidateQueries({ queryKey: ['/api/assessments/my'] })
              queryClient.invalidateQueries({ queryKey: ['/api/assessments/self'] })
            }
          },
          onError: (err: unknown) => {
            toast.error(getErrorMessage(err, "Không thể bắt đầu làm bài."))
          }
        }
      )
    }
  }

  const deleteMutation = useDeleteAssessment({
    mutation: {
      onSuccess: () => {
        toast.success("Xoá bài kiểm tra thành công!")
        queryClient.invalidateQueries({ queryKey: ['/api/assessments/my'] })
        queryClient.invalidateQueries({ queryKey: ['/api/assessments/self'] })
      },
      onError: (err: unknown) => {
        toast.error(getErrorMessage(err, "Xoá bài kiểm tra thất bại."))
      }
    }
  })

  const handleDelete = (assessmentId: string) => {
    if (confirm("Bạn có chắc chắn muốn xoá bài kiểm tra này?")) {
      deleteMutation.mutate({ id: assessmentId })
    }
  }

  const deleteAttemptMutation = useDeleteAttempt({
    mutation: {
      onSuccess: () => {
        toast.success("Hủy lưu bài kiểm tra thành công!")
        queryClient.invalidateQueries({ queryKey: ['/api/assessments/my'] })
        queryClient.invalidateQueries({ queryKey: ['/api/assessments/self'] })
      },
      onError: (err: unknown) => {
        toast.error(getErrorMessage(err, "Hủy lưu bài kiểm tra thất bại."))
      }
    }
  })

  const handleUnsave = (attempts: AttemptStateResponse[]) => {
    if (confirm("Bạn có chắc chắn muốn hủy lưu bài kiểm tra này?")) {
      attempts.forEach((att) => {
        if (att.attemptId) {
          deleteAttemptMutation.mutate({ attemptId: att.attemptId })
        }
      })
    }
  }

  React.useEffect(() => {
    if (!takeAssessmentId || hasAutoStarted.current || combinedLoading) return
    const existing = assessments.find(
      (a) => a.assessmentId === takeAssessmentId && a.status === 'IN_PROGRESS',
    )
    if (existing) {
      hasAutoStarted.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTaking({ assessmentId: existing.assessmentId ?? '', attemptId: existing.attemptId ?? '' })
      return
    }
    hasAutoStarted.current = true
    startAttemptMutation.mutate(
      { id: takeAssessmentId },
      {
        onSuccess: (res: { data?: { attemptId?: string } }) => {
          const attemptId = res?.data?.attemptId ?? ''
          if (attemptId) setTaking({ assessmentId: takeAssessmentId, attemptId })
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeAssessmentId, assessments, combinedLoading])
  const [query, setQuery] = React.useState('')
  const [status, setStatus] = React.useState<AssessmentStatusFilter>('all')
  const [source, setSource] = React.useState<AssessmentSourceFilter>('all')
  const [statusMenuOpen, setStatusMenuOpen] = React.useState(false)
  const [sourceMenuOpen, setSourceMenuOpen] = React.useState(false)
  // Populated by AssessmentCard children once their title queries resolve
  const [titleMap, setTitleMap] = React.useState<Record<string, string>>({})
  const statusMenuRef = React.useRef<HTMLDivElement>(null)
  const sourceMenuRef = React.useRef<HTMLDivElement>(null)

  const registerTitle = React.useCallback((assessmentId: string, title: string) => {
    setTitleMap(prev => (prev[assessmentId] === title ? prev : { ...prev, [assessmentId]: title }))
  }, [])

  React.useEffect(() => {
    document.title = t('page_title_assessments')
  }, [t])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (statusMenuRef.current && !statusMenuRef.current.contains(target)) {
        setStatusMenuOpen(false)
      }
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(target)) {
        setSourceMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const grouped: GroupedAssessment[] = (() => {
    const groups: Record<string, AttemptStateResponse[]> = {}
    assessments.forEach((a) => {
      if (!a.assessmentId) return
      if (!groups[a.assessmentId]) {
        groups[a.assessmentId] = []
      }
      groups[a.assessmentId].push(a)
    })

    selfAssessments.forEach((sa) => {
      if (!sa.id) return
      if (!groups[sa.id]) {
        groups[sa.id] = []
      }
    })

    return Object.entries(groups).map(([assessmentId, groupAttempts]) => {
      const sorted = [...groupAttempts].sort((x, y) => {
        const dx = x.startedAt ? new Date(x.startedAt).getTime() : 0
        const dy = y.startedAt ? new Date(y.startedAt).getTime() : 0
        return dy - dx
      })
      const latestAttempt: AttemptStateResponse = sorted[0] ?? {
        assessmentId,
        status: 'NOT_STARTED',
      }

      return {
        assessmentId,
        attempts: sorted,
        latestAttempt,
      }
    })
  })()

  if (taking) {
    return (
      <TakeAssessment
        assessmentId={taking.assessmentId}
        attemptId={taking.attemptId}
        onClose={() => setTaking(null)}
      />
    )
  }

  if (combinedLoading) return <div className="p-8 text-center text-muted-foreground">Loading assessments...</div>
  if (combinedError) return <div className="p-8 text-center text-destructive">Failed to load assessments.</div>

  const filterOptions: Array<{ key: AssessmentStatusFilter }> = [
    { key: 'all' },
    { key: 'NOT_STARTED' },
    { key: 'IN_PROGRESS' },
    { key: 'SUBMITTED' },
    { key: 'EXPIRED' },
  ]
  const sourceFilterOptions: Array<{ key: AssessmentSourceFilter }> = [
    { key: 'all' },
    { key: 'self' },
    { key: 'recruiter' },
  ]

  const filteredGroups = grouped.filter((group) => {
    const itemStatus = String(group.latestAttempt.status ?? 'NOT_STARTED')
    const byStatus = status === 'all' ? true : itemStatus === status
    const isSelfCreated = selfAssessments.some((sa) => sa.id === group.assessmentId)
    const bySource = source === 'all' ? true : source === 'self' ? isSelfCreated : !isSelfCreated
    const q = query.trim().toLowerCase()
    // Search by loaded title; fall back to assessmentId while title is still loading
    const resolvedTitle = titleMap[group.assessmentId] ?? group.assessmentId
    const byQuery = q === '' ? true : resolvedTitle.toLowerCase().includes(q)
    return byStatus && bySource && byQuery
  })

  return (
    <div className="space-y-6">
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('assessments_page_title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('assessments_page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
            className="gap-2 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            {isImporting ? 'Đang đọc...' : 'Import Excel'}
          </Button>
          <div className="relative group">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-10 z-50 hidden group-hover:block w-72 rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
              <p className="font-semibold text-foreground mb-2">Format mỗi dòng Excel/CSV:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong className="text-foreground">Question</strong> — nội dung câu hỏi (bắt buộc)</li>
                <li>• <strong className="text-foreground">Option A, Option B</strong> — bắt buộc với MCQ</li>
                <li>• <strong className="text-foreground">Option C, Option D</strong> — tuỳ chọn</li>
                <li>• <strong className="text-foreground">Correct</strong> — A, B, C hoặc D</li>
                <li>• Chỉ hỗ trợ câu hỏi <strong className="text-foreground">trắc nghiệm (MCQ)</strong></li>
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => downloadAssessmentTemplate()}
            title="Tải file mẫu"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
          </button>
          <Button
            onClick={handleOpenCreate}
            className="gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Tạo bài test
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('assessments_search_placeholder')}
          className="h-10 max-w-sm"
        />
        <div>
          <div className="relative" ref={sourceMenuRef}>
            <button
              type="button"
              onClick={() => setSourceMenuOpen((v) => !v)}
              className="border-border bg-card/80 text-foreground flex h-10 min-w-52 items-center justify-between rounded-lg border px-3 text-sm shadow-sm"
            >
              {getSourceFilterLabel(t, source)}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${sourceMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {sourceMenuOpen && (
              <div className="border-border bg-card absolute left-0 top-11 z-20 w-full rounded-lg border p-1 shadow-lg">
                {sourceFilterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => { setSource(option.key); setSourceMenuOpen(false) }}
                    className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm ${source === option.key ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                  >
                    {getSourceFilterLabel(t, option.key)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="relative" ref={statusMenuRef}>
            <button
              type="button"
              onClick={() => setStatusMenuOpen((v) => !v)}
              className="border-border bg-card/80 text-foreground flex h-10 min-w-44 items-center justify-between rounded-lg border px-3 text-sm shadow-sm"
            >
              {getFilterLabel(t, status)}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {statusMenuOpen && (
              <div className="border-border bg-card absolute left-0 top-11 z-20 w-full rounded-lg border p-1 shadow-lg">
                {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => { setStatus(option.key); setStatusMenuOpen(false) }}
                    className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm ${status === option.key ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                  >
                    {getFilterLabel(t, option.key)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">{t('account_no_results')}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => {
            return (
              <AssessmentCard
                key={group.assessmentId}
                assessmentId={group.assessmentId}
                attempts={group.attempts}
                latestAttempt={group.latestAttempt}
                onTake={handleTake}
                onTitleLoaded={registerTitle}
                onRetake={handleRetake}
                isRetaking={startAttemptMutation.isPending || submitMutation.isPending}
                onViewHistory={(assessmentId, title) => setHistoryAssessment({ assessmentId, title })}
                isSelfCreated={selfAssessments.some((sa) => sa.id === group.assessmentId)}
                onDelete={handleDelete}
                onUnsave={handleUnsave}
                onEdit={handleOpenEdit}
              />
            )
          })}
        </div>
      )}

      {historyAssessment && (
        <Dialog open={!!historyAssessment} onOpenChange={(open) => !open && setHistoryAssessment(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Lịch sử làm bài: {historyAssessment.title}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              {(grouped.find(g => g.assessmentId === historyAssessment.assessmentId)?.attempts ?? []).map((attempt, index, arr) => {
                const itemStatus = String(attempt.status ?? 'NOT_STARTED')
                const isAttemptCancelled = (() => {
                  if (!attempt.attemptId) return false
                  try {
                    const cancelled = JSON.parse(localStorage.getItem('cancelledAttempts') || '[]')
                    return Array.isArray(cancelled) && cancelled.includes(attempt.attemptId)
                  } catch {
                    return false
                  }
                })()
                return (
                  <div key={attempt.attemptId} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span>Lần làm {arr.length - index}</span>
                        {isAttemptCancelled ? (
                          <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold bg-red-500/10 text-red-600 border border-red-500/20">
                            Hủy giữa chừng
                          </span>
                        ) : (
                          itemStatus === 'SUBMITTED' && (
                            <span className={`inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                              attempt.result === 'PENDING'
                                ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                                : attempt.result === 'PASS'
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-600 border border-red-500/20'
                            }`}>
                              {formatAttemptScore(attempt)}
                            </span>
                          )
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span>Ngày: {attempt.startedAt ? formatDate(attempt.startedAt) : '—'}</span>
                        <span>Giờ: {attempt.startedAt ? new Date(attempt.startedAt).toLocaleTimeString() : '—'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isAttemptCancelled
                          ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                          : statusStyle[itemStatus] ?? statusStyle['NOT_STARTED']
                      }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                        {isAttemptCancelled ? 'Hủy giữa chừng' : getStatusLabel(t, itemStatus)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isFormOpen && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto flex flex-col p-6 rounded-lg border border-border shadow-lg">
            <DialogHeader className="flex flex-row justify-between items-center pr-6">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {isEditMode ? (
                    <>
                      <Edit className="h-5 w-5 text-primary" />
                      Chỉnh sửa bài kiểm tra
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 text-primary" />
                      Tạo bài kiểm tra mới
                    </>
                  )}
                </DialogTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFormOpen(false)
                  setIsAiDialogOpen(true)
                }}
                className="gap-1.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" /> Tạo bằng AI
              </Button>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 my-2 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-semibold text-foreground">Tên bài kiểm tra *</label>
                  <Input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Kiểm tra kiến thức Java Core"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-semibold text-foreground">Thời gian (phút) *</label>
                  <Input
                    type="number"
                    required
                    min={1}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 30)}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-semibold text-foreground">Mô tả ngắn</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả mục đích bài kiểm tra..."
                  />
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold">Danh sách câu hỏi ({questions.length})</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestions([...questions, {
                      id: `q_${Date.now()}`,
                      text: '',
                      type: 'MCQ',
                      options: ['Lựa chọn 1', 'Lựa chọn 2'],
                      correctOptionIndex: 0
                    }])}
                    className="h-8 text-xs cursor-pointer"
                  >
                    + Thêm câu hỏi
                  </Button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {questions.map((q, qIndex) => (
                    <div key={q.id || qIndex} className="p-3 border border-border rounded-lg bg-muted/20 space-y-3 relative">
                      <button
                        type="button"
                        onClick={() => setQuestions(questions.filter((_, idx) => idx !== qIndex))}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 cursor-pointer text-xs"
                      >
                        Xóa
                      </button>
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-primary">Câu {qIndex + 1}</span>
                        <Input
                          required
                          value={q.text || ''}
                          onChange={(e) => {
                            const updated = [...questions]
                            updated[qIndex] = { ...q, text: e.target.value }
                            setQuestions(updated)
                          }}
                          placeholder="Nội dung câu hỏi..."
                        />
                      </div>
                      <div className="space-y-2 pl-3 border-l-2 border-primary/20">
                        <span className="text-[11px] font-semibold text-muted-foreground">Đáp án trắc nghiệm</span>
                        <div className="grid gap-2">
                          {q.options?.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`q-${qIndex}-correct`}
                                checked={q.correctOptionIndex === oIdx}
                                onChange={() => {
                                  const updated = [...questions]
                                  updated[qIndex] = { ...q, correctOptionIndex: oIdx }
                                  setQuestions(updated)
                                }}
                                className="cursor-pointer"
                              />
                              <Input
                                required
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...questions]
                                  const opts = [...(q.options || [])]
                                  opts[oIdx] = e.target.value
                                  updated[qIndex] = { ...q, options: opts }
                                  setQuestions(updated)
                                }}
                                className="h-8 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Đang lưu...'
                    : isEditMode
                      ? 'Lưu thay đổi'
                      : 'Tạo bài test'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isAiDialogOpen && (
        <Dialog
          open={isAiDialogOpen}
          onOpenChange={(open) => {
            setIsAiDialogOpen(open)
            if (!open) setIsFormOpen(true)
          }}
        >
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Tạo bài kiểm tra tự động bằng AI
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAiConfirm} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Tên công việc / Chủ đề *</label>
                <Input
                  required
                  value={aiJobName}
                  onChange={(e) => setAiJobName(e.target.value)}
                  placeholder="Ví dụ: React Developer, Java core..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Trình độ</label>
                  <select
                    value={aiLevel}
                    onChange={(e) => setAiLevel(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
                  >
                    <option value="Intern">Intern</option>
                    <option value="Fresher">Fresher</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Độ khó</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
                  >
                    <option value="Dễ">Dễ</option>
                    <option value="Trung bình">Trung bình</option>
                    <option value="Khó">Khó</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Số câu hỏi</label>
                <Input
                  type="number"
                  required
                  min={1}
                  max={20}
                  value={aiNumQuestions}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setAiNumQuestions("");
                    } else {
                      const parsed = parseInt(val);
                      setAiNumQuestions(isNaN(parsed) ? "" : parsed);
                    }
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAiDialogOpen(false)
                    setIsFormOpen(true)
                  }}
                  disabled={generateMutation.isPending}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={generateMutation.isPending}>
                  {generateMutation.isPending ? 'Đang tạo bằng AI...' : 'Xác nhận tạo'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// Outer shell: waits for assessment + attempt data before mounting TakeAssessmentContent.
// This lets the inner component initialize all state from props without useEffect.
function TakeAssessment({
  assessmentId,
  attemptId,
  onClose,
}: {
  assessmentId: string
  attemptId: string
  onClose: () => void
}) {
  const { data: assessmentData, isLoading: loadingAssessment } = useGetAssessment(assessmentId)
  const { data: attemptData, isLoading: loadingAttempt } = useGetAttemptState(attemptId)

  if (loadingAssessment || loadingAttempt || !assessmentData?.data) {
    return <div className="p-8 text-center text-muted-foreground">Loading assessment...</div>
  }

  return (
    <TakeAssessmentContent
      assessment={assessmentData.data}
      attemptId={attemptId}
      savedAnswers={attemptData?.data?.answers ?? []}
      onClose={onClose}
    />
  )
}

// Inner content: all data available at mount — state is initialized from props.
function TakeAssessmentContent({
  assessment,
  attemptId,
  savedAnswers,
  onClose,
}: {
  assessment: AssessmentResponse
  attemptId: string
  savedAnswers: AttemptAnswer[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const questions: Question[] = assessment.questions ?? []

  const saveAnswersMutation = useSaveAnswers()
  const submitMutation = useSubmitAttempt()
  const submitWithFlagMutation = useSubmitAttemptWithFlag()
  const { data: resultData, refetch: fetchResult } = useGetResult(attemptId, {
    query: { enabled: false },
  })

  // Initialize from saved answers using lazy useState
  const [answers, setAnswers] = React.useState<Record<string, LocalAnswer>>(() => {
    const init: Record<string, LocalAnswer> = {}
    savedAnswers.forEach((a) => {
      if (a.questionId) {
        init[a.questionId] = {
          selectedOptionIndex: a.selectedOptionIndex,
          textAnswer: a.textAnswer,
        }
      }
    })
    return init
  })

  const [currentQIndex, setCurrentQIndex] = React.useState(0)
  const [showResult, setShowResult] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [confirmExitOpen, setConfirmExitOpen] = React.useState(false)
  const [isCancellingMidway, setIsCancellingMidway] = React.useState(false)

  const handleCancelMidway = () => {
    setIsCancellingMidway(true)
    try {
      const cancelled = JSON.parse(localStorage.getItem('cancelledAttempts') || '[]')
      if (Array.isArray(cancelled) && !cancelled.includes(attemptId)) {
        cancelled.push(attemptId)
        localStorage.setItem('cancelledAttempts', JSON.stringify(cancelled))
      }
    } catch {
      // ignore storage errors
    }
    submitMutation.mutate(
      { attemptId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/assessments/my'] })
          queryClient.invalidateQueries({ queryKey: ['/api/assessments/self'] })
          setIsCancellingMidway(false)
          setConfirmExitOpen(false)
          onClose()
        },
        onError: () => {
          setIsCancellingMidway(false)
          setConfirmExitOpen(false)
          onClose()
        },
      }
    )
  }

  // Initialize timer from assessment data directly (no useEffect needed)
  const [timeLeft, setTimeLeft] = React.useState((assessment.timeLimitMinutes ?? 30) * 60)

  // Update ref in useLayoutEffect so the timer callback always reads current state
  const handleSubmitRef = React.useRef<(overtime?: boolean) => void>(() => {})
  React.useLayoutEffect(() => {
    handleSubmitRef.current = (overtime = false) => {
      if (isSubmitting) return
      setIsSubmitting(true)
      const callbacks = {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/assessments/my'] })
          queryClient.invalidateQueries({ queryKey: ['/api/assessments/self'] })
          setShowResult(true)
          fetchResult()
        },
        onError: () => setIsSubmitting(false),
      }
      if (overtime) {
        submitWithFlagMutation.mutate({ attemptId, overtime: true }, callbacks)
      } else {
        submitMutation.mutate({ attemptId }, callbacks)
      }
    }
  })

  // Countdown — only depends on timeLeft and showResult (no stale-closure issue via ref)
  React.useEffect(() => {
    if (showResult) return
    if (timeLeft <= 0) { handleSubmitRef.current(true); return }
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [timeLeft, showResult])

  const handleAnswerChange = (questionId: string, value: LocalAnswer) => {
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)
    saveAnswersMutation.mutate({
      attemptId,
      data: {
        answers: Object.entries(newAnswers).map(([qId, ans]) => ({ questionId: qId, ...ans })),
      },
    })
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="card-surface p-10 space-y-4">
          <h2 className="text-xl font-bold">Bài kiểm tra không có câu hỏi</h2>
          <Button onClick={onClose}>{t('btn_back_to_list')}</Button>
        </div>
      </div>
    )
  }

  if (showResult) {
    const result = resultData?.data
    const isPending = result?.result === 'PENDING'
    const isPassed = result?.result === 'PASS'

    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="card-surface p-10 space-y-4">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            isPending
              ? 'bg-yellow-100 text-yellow-600'
              : isPassed
                ? 'bg-[var(--success-soft)] text-[var(--success)]'
                : 'bg-[var(--danger-soft)] text-[var(--danger)]'
          }`}>
            <ClipboardCheck className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold">{t('assessment_completed')}</h2>
          {isPending ? (
            <>
              <p className="text-lg font-semibold text-yellow-600">Đang chờ chấm điểm</p>
              <p className="text-sm text-muted-foreground">{t('assessment_result_pending_desc')}</p>
            </>
          ) : (
            <>
              <p className={`text-5xl font-bold ${isPassed ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {result?.correctAnswers != null && result?.totalQuestions != null && result.totalQuestions > 0
                  ? `${result.correctAnswers}/${result.totalQuestions}`
                  : '—'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPassed ? t('assessment_passed_desc') : t('assessment_failed_desc')}
              </p>
            </>
          )}
          <Button onClick={onClose}>{t('btn_back_to_list')}</Button>
        </div>
      </div>
    )
  }

  const totalQuestions = questions.length
  const currentQuestion = questions[currentQIndex]
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6">
      {/* Header */}
      <div className="card-surface flex items-center justify-between p-4">
        <button
          onClick={() => setConfirmExitOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('btn_exit')}
        </button>
        <div className="text-sm font-medium text-foreground">{assessment.title}</div>
        <div className={`inline-flex items-center gap-2 font-mono text-lg font-bold px-4 py-1.5 rounded-full border ${
          timeLeft < 120
            ? 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/20 animate-pulse'
            : 'bg-primary/10 text-primary border-primary/20'
        }`}>
          <Clock className="h-4 w-4" />
          {mm}:{ss}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Question map */}
        <div className="card-surface p-5 space-y-4 lg:col-span-1 h-fit">
          <h3 className="font-bold text-sm text-foreground">Bản đồ câu hỏi</h3>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, idx) => {
              const answered = isAnswered(q, answers)
              const active = currentQIndex === idx
              let btnClass = 'border-border text-foreground hover:bg-muted/60'
              if (active) {
                btnClass = 'bg-primary text-white border-primary shadow-sm shadow-primary/25'
              } else if (answered) {
                btnClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold'
              }
              return (
                <button
                  key={q.id ?? idx}
                  onClick={() => setCurrentQIndex(idx)}
                  className={`h-10 rounded-lg border flex items-center justify-center text-sm transition-all font-medium ${btnClass}`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
          <div className="pt-2 border-t border-border space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-primary border border-primary" />
              <span>Đang chọn</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-emerald-500/10 border border-emerald-500/20" />
              <span>Đã trả lời</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-transparent border border-border" />
              <span>Chưa trả lời</span>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={isSubmitting}
            onClick={() => handleSubmitRef.current()}
          >
            {isSubmitting ? 'Đang nộp...' : t('btn_submit_assessment')}
          </Button>
        </div>

        {/* Main question panel */}
        <div className="lg:col-span-3 card-surface p-6 space-y-5 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
            <span>{t('assessment_question_count', { current: currentQIndex + 1, total: totalQuestions })}</span>
            <span className="bg-secondary px-2.5 py-0.5 rounded-md border border-border">
              {currentQuestion.type === MCQ ? 'Trắc nghiệm' : 'Tự luận'}
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentQIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>

          <h2 className="text-base font-semibold leading-relaxed">{currentQuestion.text}</h2>

          {currentQuestion.type === MCQ && currentQuestion.options && (
            <div className="space-y-2 flex-1">
              {currentQuestion.options.map((opt, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    answers[currentQuestion.id ?? '']?.selectedOptionIndex === i
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={answers[currentQuestion.id ?? '']?.selectedOptionIndex === i}
                    onChange={() => handleAnswerChange(currentQuestion.id ?? '', { selectedOptionIndex: i })}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.type !== MCQ && (
            <textarea
              className="w-full flex-1 min-h-[180px] rounded-lg border border-border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Nhập câu trả lời của bạn..."
              value={answers[currentQuestion.id ?? '']?.textAnswer ?? ''}
              onChange={(e) => handleAnswerChange(currentQuestion.id ?? '', { textAnswer: e.target.value })}
            />
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex((c) => c - 1)}
            >
              {t('btn_prev_question')}
            </Button>
            <Button
              variant="outline"
              disabled={currentQIndex === totalQuestions - 1}
              onClick={() => setCurrentQIndex((c) => c + 1)}
            >
              {t('btn_next_question')}
            </Button>
          </div>
        </div>
      </div>
      {confirmExitOpen && (
        <Dialog open={confirmExitOpen} onOpenChange={setConfirmExitOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Xác nhận thoát bài làm</DialogTitle>
            </DialogHeader>
            <div className="mt-2 text-sm text-muted-foreground">
              Bạn có chắc chắn muốn thoát? Bài làm của bạn sẽ được nộp tự động và tính là **Hủy giữa chừng**.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmExitOpen(false)} disabled={isCancellingMidway}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={handleCancelMidway} disabled={isCancellingMidway}>
                {isCancellingMidway ? 'Đang thoát...' : 'Thoát & Hủy'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
