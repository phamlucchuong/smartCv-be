import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, Card, CardContent, cn } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import {
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Home,
  MapPin,
  Users,
  X,
  Upload,
  Sparkles,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  useGetJobById,
  useGetRelatedJobs,
  useGetJobRelatedCompanies,
  useGetMyApplicationForJob,
  getGetMyApplicationForJobQueryKey,
  useSubmit,
  useContains,
  getContainsQueryKey,
  useSave,
  useRemove,
  useGetByRecruiterId,
  useListCvs,
  getListCvsQueryKey,
  AXIOS_INSTANCE,
  useGetAssessmentsByJob,
  useAnalyzeCv,
  type AiModels,
} from '@smart-cv/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { hasCandidateRole, useAuthStore } from '../../store/useAuthStore'
import { usePreferencesStore } from '../../store/usePreferencesStore'

export const Route = createFileRoute('/jobs/$jobId')({
  component: JobDetailPage,
})

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function formatDate(dateInput?: string | Date | number): string {
  if (!dateInput) return ''
  
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return ''
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim()
    
    if (/^\d+$/.test(cleanStr)) {
      const d = new Date(parseInt(cleanStr, 10))
      if (isNaN(d.getTime())) return ''
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      const [year, month, day] = cleanStr.split('-')
      return `${day}/${month}/${year}`
    }
    
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleanStr)) {
      const [year, month, day] = cleanStr.split('/')
      return `${day}/${month}/${year}`
    }

    if (cleanStr.includes('T') || cleanStr.includes(' ')) {
      const separator = cleanStr.includes('T') ? 'T' : ' '
      const datePart = cleanStr.split(separator)[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('-')
        return `${day}/${month}/${year}`
      }
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('/')
        return `${day}/${month}/${year}`
      }
    }
  }

  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return ''
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  } catch {
    return ''
  }
}

function JobDetailPage() {
  const { jobId } = Route.useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated, role } = useAuthStore()
  const isCandidate = isAuthenticated && hasCandidateRole(role)
  const lang = usePreferencesStore((s) => s.language)

  const [showApplyModal, setShowApplyModal] = React.useState(false)
  const [showStickyBar, setShowStickyBar] = React.useState(false)
  const [showAnalyzeModal, setShowAnalyzeModal] = React.useState(false)
  const [analysisResult, setAnalysisResult] = React.useState<AiModels.CvFullAnalysisResponse | null>(null)
  const [showAnalysisPanel, setShowAnalysisPanel] = React.useState(false)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const heroRef = React.useRef<HTMLDivElement>(null)

  const { data: jobData, isLoading, isError } = useGetJobById(jobId)
  const job = jobData?.data

  const { data: assessmentsData } = useGetAssessmentsByJob(jobId, {
    query: { enabled: isAuthenticated },
  })
  const assessments = assessmentsData?.data ?? []

  const deadlineDaysLeft = job?.deadline
    ? (() => {
        const parts = job.deadline.split('-')
        if (parts.length !== 3) {
          const deadlineDate = new Date(job.deadline)
          if (isNaN(deadlineDate.getTime())) return null
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const deadline = new Date(deadlineDate)
          deadline.setHours(23, 59, 59, 999)
          const diffMs = deadline.getTime() - today.getTime()
          return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
        }
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1
        const day = parseInt(parts[2], 10)
        const deadline = new Date(year, month, day, 23, 59, 59, 999)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diffMs = deadline.getTime() - today.getTime()
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      })()
    : null

  const { data: relatedData } = useGetRelatedJobs(jobId)
  const relatedJobs = relatedData?.data ?? []

  const { data: relatedCompaniesData } = useGetJobRelatedCompanies(jobId)
  const relatedCompanies = relatedCompaniesData?.data ?? []

  const { data: appliedData } = useGetMyApplicationForJob(jobId, {
    query: { enabled: isCandidate, retry: false },
  })
  const applied = Boolean(appliedData?.data)

  const { data: containsData, isLoading: containsLoading } = useContains(jobId, {
    query: { enabled: isCandidate },
  })
  const saved = Boolean(containsData?.data)

  const saveMutation = useSave()
  const removeMutation = useRemove()
  const savePending = saveMutation.isPending || removeMutation.isPending
  const saveDisabled = containsLoading || savePending

  const { data: companyData } = useGetByRecruiterId(job?.recruiterId ?? '', {
    query: { enabled: !!job?.recruiterId },
  })
  const logoUrl = companyData?.data?.logoUrl

  React.useEffect(() => {
    if (job) {
      document.title = t('page_title_job_detail', { title: job.title ?? '', company: job.company ?? '' })
      console.log('SmartCV Debug Job Dates:', {
        rawCreatedAt: job.createdAt,
        rawDeadline: job.deadline,
        formattedCreatedAt: formatDate(job.createdAt),
        formattedDeadline: formatDate(job.deadline),
        deadlineDaysLeft
      });
    }
  }, [job, t, deadlineDaysLeft])

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    )
    if (heroRef.current) observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [])

  function handleApplyClick() {
    if (!isCandidate) {
      toast.error('Vui lòng đăng nhập tài khoản ứng viên để ứng tuyển công việc này!')
      setTimeout(() => {
        navigate({ to: '/signin' })
      }, 1500)
      return
    }
    setShowApplyModal(true)
  }

  function handleSaveClick() {
    if (!isCandidate) {
      toast.error('Vui lòng đăng nhập tài khoản ứng viên để lưu công việc này!')
      setTimeout(() => {
        navigate({ to: '/signin' })
      }, 1500)
      return
    }
    if (saved) {
      removeMutation.mutate(
        { jobId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getContainsQueryKey(jobId) })
            toast.success('Đã bỏ lưu tin tuyển dụng!')
          },
          onError: () => {
            toast.error('Không thể bỏ lưu tin. Vui lòng thử lại.')
          }
        }
      )
    } else {
      saveMutation.mutate(
        { data: { jobId } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getContainsQueryKey(jobId) })
            toast.success('Đã lưu tin tuyển dụng!')
          },
          onError: () => {
            toast.error('Không thể lưu tin. Vui lòng thử lại.')
          }
        }
      )
    }
  }

  function handleAnalyzeClick() {
    if (!isCandidate) {
      toast.error(
        lang === 'VI'
          ? 'Vui lòng đăng nhập tài khoản ứng viên để phân tích CV!'
          : 'Please log in as a candidate to analyze your CV!'
      )
      setTimeout(() => { navigate({ to: '/signin' }) }, 1500)
      return
    }
    setShowAnalyzeModal(true)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading job details...</p>
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl font-black text-foreground">404</p>
          <p className="mt-2 text-muted-foreground">Job not found.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }



  const salaryDisplay = job.salaryMin != null && job.salaryMax != null
    ? `${formatVnd(job.salaryMin)} - ${formatVnd(job.salaryMax)}`
    : job.salaryMin != null
      ? `From ${formatVnd(job.salaryMin)}`
      : job.salaryMax != null
        ? `Up to ${formatVnd(job.salaryMax)}`
        : null

  return (
    <div className="relative pb-20 lg:pb-0">
      {showApplyModal && (
        <ApplyModal
          jobId={jobId}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: getGetMyApplicationForJobQueryKey(jobId) })}
          onClose={() => setShowApplyModal(false)}
        />
      )}
      {showAnalyzeModal && (
        <AnalyzeCvModal
          jobId={jobId}
          lang={lang}
          isAnalyzing={isAnalyzing}
          onAnalyze={(cvId) => {
            setIsAnalyzing(true)
          }}
          onAnalyzeDone={(result) => {
            setIsAnalyzing(false)
            setAnalysisResult(result)
            setShowAnalysisPanel(true)
            setShowAnalyzeModal(false)
            toast.success(
              lang === 'VI' ? 'Phân tích CV hoàn thành!' : 'CV analysis complete!',
              { description: lang === 'VI' ? 'Nhấn "Xem kết quả" để xem chi tiết.' : 'Click "View Results" to see details.' }
            )
          }}
          onError={(msg) => {
            setIsAnalyzing(false)
            toast.error(msg)
          }}
          onClose={() => { if (!isAnalyzing) setShowAnalyzeModal(false) }}
        />
      )}

      {/* Sticky mini bar — appears when hero card scrolls out of view */}
      <div
        className={cn(
          'fixed top-20 left-0 right-0 z-30 bg-card border-b border-border shadow-sm px-4 py-3 transition-transform duration-200',
          showStickyBar ? 'translate-y-0' : '-translate-y-[200%] pointer-events-none'
        )}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-foreground truncate max-w-[60%]">{job.title}</span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className={cn('border-primary text-primary', saved && 'bg-primary/5')}
              disabled={saveDisabled}
              onClick={handleSaveClick}
            >
              <Heart className={cn('h-3.5 w-3.5 mr-1.5', saved && 'fill-current')} />
              {saved ? t('job_saved') : t('job_save')}
            </Button>
            <Button
              size="sm"
              disabled={applied}
              className={cn(
                applied ? 'bg-muted text-muted-foreground border border-border hover:bg-muted' : 'bg-primary text-primary-foreground'
              )}
              onClick={handleApplyClick}
            >
              {applied
                ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{t('job_applied')}</>
                : t('job_apply_now')}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Breadcrumb */}
        <nav className="py-3 border-b border-border bg-muted/30 -mx-4 px-4 md:-mx-6 md:px-6 mb-6">
          <ol className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
            <li>
              <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
                <Home className="h-3.5 w-3.5" />
                Home
              </Link>
            </li>
            <li><ChevronRight className="h-3.5 w-3.5" /></li>
            <li>
              <Link to="/" className="hover:text-foreground transition-colors">{t('job_find_jobs')}</Link>
            </li>
            <li><ChevronRight className="h-3.5 w-3.5" /></li>
            <li className="font-medium text-foreground truncate max-w-[200px]">{job.title}</li>
          </ol>
        </nav>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Main content */}
          <div className="space-y-6">
            {/* Hero Card */}
            <div ref={heroRef}>
              <Card className="border-border bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl border border-border bg-white flex items-center justify-center text-sm font-bold text-foreground shrink-0 overflow-hidden p-1.5">
                      {logoUrl ? (
                        <img src={logoUrl} alt={job.company ?? 'Company logo'} className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
                      <a href="#" className="text-base font-medium text-primary hover:underline">{job.company}</a>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        {job.location && (
                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />{job.location}
                          </span>
                        )}
                        {job.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            Posted {formatDate(job.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {salaryDisplay && (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary inline-flex items-center gap-1">
                        <Banknote className="h-3.5 w-3.5" />{salaryDisplay}
                      </span>
                    )}
                    {deadlineDaysLeft != null && (
                      <span className={cn(
                        "rounded-full px-3 py-1 text-sm font-medium inline-flex items-center gap-1",
                        deadlineDaysLeft < 30
                          ? "bg-destructive/10 text-destructive"
                          : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                      )}>
                        <Calendar className="h-3.5 w-3.5" />
                        {t('job_deadline_warning', { date: formatDate(job.deadline) })} ({t('job_days_left', { days: deadlineDaysLeft })})
                      </span>
                    )}
                    {job.openings != null && job.openings > 0 && (
                      <span className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        {t('job_overview_headcount')}: {job.openings}
                      </span>
                    )}
                    {job.experienceLevel && (
                      <span className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground inline-flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />{job.experienceLevel}
                      </span>
                    )}
                    {job.jobType && (
                      <span className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />{job.jobType}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-5">
                    <Button
                      className={cn(
                        'h-11 px-8 rounded-xl',
                        applied
                          ? 'bg-muted text-muted-foreground border border-border hover:bg-muted'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      )}
                      disabled={applied}
                      onClick={handleApplyClick}
                    >
                      {applied
                        ? <><CheckCircle2 className="h-4 w-4 mr-2" />{t('job_applied')}</>
                        : t('job_apply_now')}
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'h-11 px-6 rounded-xl border-primary text-primary',
                        saved && 'bg-primary/5'
                      )}
                      disabled={saveDisabled}
                      onClick={handleSaveClick}
                    >
                      <Heart className={cn('h-4 w-4 mr-2', saved && 'fill-current')} />
                      {saved ? t('job_saved') : t('job_save')}
                    </Button>
                    {isCandidate && (
                      <Button
                        variant="outline"
                        className="h-11 px-6 rounded-xl border-[var(--ai)]/50 text-[var(--ai)] hover:bg-[var(--ai)]/5 hover:border-[var(--ai)]"
                        onClick={handleAnalyzeClick}
                        disabled={isAnalyzing}
                      >
                        <Sparkles className={cn('h-4 w-4 mr-2', isAnalyzing && 'animate-pulse')} />
                        {isAnalyzing
                          ? (lang === 'VI' ? 'Đang phân tích...' : 'Analyzing...')
                          : (lang === 'VI' ? 'Phân tích CV' : 'Analyze CV')}
                      </Button>
                    )}
                    {analysisResult && !isAnalyzing && (
                      <Button
                        variant="outline"
                        className="h-11 px-6 rounded-xl border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        onClick={() => setShowAnalysisPanel((v) => !v)}
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        {lang === 'VI' ? 'Xem kết quả' : 'View Results'}
                        {showAnalysisPanel
                          ? <ChevronUp className="h-3.5 w-3.5 ml-1.5" />
                          : <ChevronDown className="h-3.5 w-3.5 ml-1.5" />}
                      </Button>
                    )}
                  </div>

                  {/* Inline Analysis Result Panel */}
                  {showAnalysisPanel && analysisResult && (
                    <div className="mt-5 rounded-2xl border border-purple-100 dark:border-purple-900/30 bg-gradient-to-br from-purple-50/60 via-white to-indigo-50/40 dark:from-purple-950/10 dark:via-slate-900/60 dark:to-indigo-950/10 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-[var(--ai)]">
                          <Sparkles className="h-4 w-4" />
                          {lang === 'VI' ? 'Kết quả phân tích CV theo job này' : 'CV Analysis Results for this Job'}
                        </div>
                        <button
                          onClick={() => setShowAnalysisPanel(false)}
                          className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <CvJobAnalysisResult result={analysisResult} lang={lang} />
                    </div>
                  )}


                </CardContent>
              </Card>
            </div>

            {/* Job Description */}
            {job.description && (
              <Card className="border-border bg-card">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">{t('job_description')}</h2>
                  <hr className="border-border" />
                  <div className="text-[15px] text-foreground leading-7 whitespace-pre-line">{job.description}</div>
                </CardContent>
              </Card>
            )}

            {/* Candidate Requirements */}
            {((job.requirements ?? []).length > 0 || (job.skills ?? []).length > 0) && (
              <Card className="border-border bg-card">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">{t('job_requirements')}</h2>
                  <hr className="border-border" />
                  {(job.requirements ?? []).length > 0 && (
                    <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-foreground leading-7">
                      {(job.requirements ?? []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {(job.skills ?? []).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">{t('job_required_skills')}:</p>
                      <div className="flex flex-wrap gap-2">
                        {(job.skills ?? []).map((skill) => (
                          <Badge
                            key={skill}
                            variant="secondary"
                            className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Benefits */}
            {(job.benefits ?? []).length > 0 && (
              <Card className="border-border bg-card">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">{t('job_benefits')}</h2>
                  <hr className="border-border" />
                  <div className="grid grid-cols-2 gap-2">
                    {(job.benefits ?? []).map((benefit) => (
                      <div
                        key={benefit}
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
                      >
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {benefit}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recruitment Assessments */}
            {assessments.length > 0 && (
              <Card className="border-border bg-card">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">
                    Bài kiểm tra tuyển dụng
                  </h2>
                  <hr className="border-border" />
                  <div className="space-y-3">
                    {assessments.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow bg-muted/20"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{assessment.title}</p>
                          {assessment.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{assessment.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              {assessment.timeLimitMinutes} phút
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Briefcase className="h-3.5 w-3.5 text-primary" />
                              {assessment.questions?.length ?? 0} câu hỏi
                            </span>
                          </div>
                        </div>
                        <Link to="/assessments" search={{ take: assessment.id }} className="shrink-0">
                          <Button size="sm">Làm bài test</Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Related Jobs — inside main panel bottom */}
            <div className="mt-8 mb-4 space-y-4 border-t border-border pt-6">
              <h2 className="text-xl font-semibold text-foreground">{t('job_related')}</h2>
              {relatedJobs.length > 0 ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  {relatedJobs.map((rJob) => (
                    <Link key={rJob.id} to="/jobs/$jobId" params={{ jobId: rJob.id ?? '' }} className="block">
                      <Card className="border-border bg-card hover:shadow-md transition-shadow h-full">
                        <CardContent className="p-5 space-y-3">
                          <div>
                            <h3 className="text-base font-semibold text-foreground line-clamp-1">{rJob.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-1">{rJob.company}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {(rJob.salaryMin != null || rJob.salaryMax != null) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary font-medium">
                                <Banknote className="h-3 w-3" />
                                {rJob.salaryMin != null && rJob.salaryMax != null
                                  ? `${formatVnd(rJob.salaryMin)} - ${formatVnd(rJob.salaryMax)}`
                                  : rJob.salaryMin != null
                                    ? `From ${formatVnd(rJob.salaryMin)}`
                                    : `Up to ${formatVnd(rJob.salaryMax!)}`}
                              </span>
                            )}
                            {rJob.location && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />{rJob.location}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                  {t('job_no_related')}
                </p>
              )}
            </div>

            {/* Companies in this category */}
            {relatedCompanies.length > 0 && (
              <div className="mt-6 mb-4 space-y-4 border-t border-border pt-6">
                <h2 className="text-xl font-semibold text-foreground">Companies in this category</h2>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  {relatedCompanies.map((company) => (
                    <Link key={company.id} to="/companies/$companyId" params={{ companyId: company.id ?? '' }} className="block h-full">
                      <Card className="border-border bg-card hover:shadow-md transition-shadow h-full">
                        <CardContent className="p-4 flex items-center gap-3 h-full">
                          {company.logoUrl ? (
                            <img src={company.logoUrl} alt={company.name ?? ''} className="h-10 w-10 rounded-lg object-cover shrink-0 border border-border" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground line-clamp-1" title={company.name}>{company.name}</p>
                            {company.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 line-clamp-1" title={company.location}>
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{company.location}</span>
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-24 h-fit">
            {/* Job Overview Card */}
            <Card className="border-border bg-card">
              <CardContent className="p-5">
                <h3 className="text-base font-semibold text-foreground mb-2">{t('job_overview')}</h3>
                <hr className="border-border mb-3" />
                <div className="space-y-0">
                  {([
                    job.deadline
                      ? {
                          icon: Calendar,
                          label: t('job_overview_deadline'),
                          value: (
                            <span className={cn(
                              (deadlineDaysLeft !== null && deadlineDaysLeft < 30)
                                ? "text-destructive font-semibold"
                                : "text-emerald-600 dark:text-emerald-400 font-semibold"
                            )}>
                              {formatDate(job.deadline)}
                            </span>
                          )
                        }
                      : null,
                    job.createdAt
                      ? {
                          icon: Clock,
                          label: t('job_overview_posted'),
                          value: formatDate(job.createdAt)
                        }
                      : null,
                    salaryDisplay ? { icon: Banknote, label: t('job_overview_salary'), value: salaryDisplay } : null,
                    job.experienceLevel ? { icon: Briefcase, label: t('job_overview_experience'), value: job.experienceLevel } : null,
                    job.jobType ? { icon: Briefcase, label: t('job_overview_type'), value: job.jobType } : null,
                  ] as ({ icon: typeof Calendar; label: string; value: React.ReactNode } | null)[])
                    .filter((item): item is { icon: typeof Calendar; label: string; value: React.ReactNode } => item !== null)
                    .map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start justify-between text-sm py-2 border-b border-border last:border-0">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Icon className="h-4 w-4 text-primary shrink-0" />
                          {label}
                        </span>
                        <span className="font-medium text-foreground text-right max-w-[70%] whitespace-nowrap">{value}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Company Info Card */}
            <Card className="border-border bg-card">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border border-border bg-white flex items-center justify-center text-xs font-bold text-foreground shrink-0 overflow-hidden p-1">
                    {logoUrl ? (
                      <img src={logoUrl} alt={job.company ?? 'Company logo'} className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">{job.company}</p>
                    {companyData?.data?.industry && (
                      <p className="text-xs text-muted-foreground truncate">{companyData.data.industry}</p>
                    )}
                  </div>
                </div>

                {(companyData?.data?.location || companyData?.data?.size) && (
                  <div className="space-y-2 text-xs text-muted-foreground pt-1">
                    {companyData.data.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{companyData.data.location}</span>
                      </div>
                    )}
                    {companyData.data.size && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{t('job_company_size')}: {companyData.data.size}</span>
                      </div>
                    )}
                  </div>
                )}
                <hr className="border-border" />
                <Link
                  to="/companies/$companyId"
                  params={{ companyId: job.recruiterId ?? job.company?.toLowerCase().replace(/\s+/g, '-') ?? '' }}
                  className="block w-full mt-1"
                >
                  <Button variant="outline" className="w-full border-primary text-primary">
                    {t('job_view_company')} →
                  </Button>
                </Link>
                <a href="#" className="block text-center text-xs text-muted-foreground hover:text-foreground">
                  {t('job_report')}
                </a>
              </CardContent>
            </Card>

            {/* Sticky Action Card in Sidebar — visible when scrolling down */}
            {showStickyBar && (
              <Card className="border-border bg-card shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
                <CardContent className="p-5 space-y-3">
                  <Button
                    className={cn(
                      'w-full h-11 px-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90',
                      applied && 'bg-muted text-muted-foreground border border-border hover:bg-muted'
                    )}
                    disabled={applied}
                    onClick={handleApplyClick}
                  >
                    {applied
                      ? <><CheckCircle2 className="h-4 w-4 mr-2" />{t('job_applied')}</>
                      : t('job_apply_now')}
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full h-11 px-6 rounded-xl border-primary text-primary',
                      saved && 'bg-primary/5'
                    )}
                    disabled={saveDisabled}
                    onClick={handleSaveClick}
                  >
                    <Heart className={cn('h-4 w-4 mr-2', saved && 'fill-current')} />
                    {saved ? t('job_saved') : t('job_save')}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Working Location in Sidebar */}
            {job.location && (
              <Card className="border-border bg-card">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-base font-semibold text-foreground mb-2">{t('job_location')}</h3>
                  <hr className="border-border" />
                  <p className="text-xs text-foreground flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {job.location}
                  </p>
                  <div className="rounded-xl overflow-hidden h-48 border border-border">
                    <iframe
                      title="Working Location Map"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(job.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      </div>

      {/* Mobile sticky apply bar — hidden on desktop */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border p-3 flex items-center justify-between lg:hidden">
        <div>
          {salaryDisplay && <p className="text-sm font-semibold text-foreground">{salaryDisplay}</p>}
          {deadlineDaysLeft != null && (
            <p className={cn(
              "text-xs font-semibold",
              deadlineDaysLeft < 30
                ? "text-destructive"
                : "text-emerald-600 dark:text-emerald-400"
            )}>
              {t('job_days_left', { days: deadlineDaysLeft })}
            </p>
          )}
        </div>
        <Button
          className={cn(
            'h-10 px-6 rounded-xl',
            applied
              ? 'bg-muted text-muted-foreground border border-border hover:bg-muted'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
          disabled={applied}
          onClick={handleApplyClick}
        >
          {applied
            ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />{t('job_applied')}</>
            : t('job_apply_now')}
        </Button>
      </div>
    </div>
  )
}

interface ApplyModalProps {
  jobId: string
  onSuccess: () => void
  onClose: () => void
}

function ApplyModal({ jobId, onSuccess, onClose }: ApplyModalProps) {
  const { isAuthenticated, role } = useAuthStore()
  const isCandidate = isAuthenticated && hasCandidateRole(role)
  const [coverLetter, setCoverLetter] = React.useState('')
  const [selectedCvUrl, setSelectedCvUrl] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const { data: cvsData, isLoading: cvsLoading } = useListCvs({
    query: { enabled: isCandidate },
  })
  const cvList = React.useMemo(() => cvsData?.data ?? [], [cvsData?.data])
  const effectiveCvUrl = selectedCvUrl || cvList.find(c => c.default)?.url || cvList[0]?.url || ''

  const queryClient = useQueryClient()
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return AXIOS_INSTANCE.post('/api/candidates/cv/upload', form, {
        transformRequest: [
          (data, headers) => {
            if (headers) delete (headers as Record<string, unknown>)['Content-Type']
            return data
          },
        ],
      })
    },
    onSuccess: () => {
      toast.success('Tải lên CV thành công!')
      queryClient.invalidateQueries({ queryKey: getListCvsQueryKey() })
    },
    onError: () => toast.error('Tải lên thất bại. Vui lòng thử lại.'),
  })

  const handleUpload = (file: File | null) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Chỉ chấp nhận file định dạng PDF')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File CV tối đa 5MB')
      return
    }
    uploadMutation.mutate(file)
  }

  const submitMutation = useSubmit()

  function handleSubmit() {
    if (!effectiveCvUrl) return
    submitMutation.mutate(
      { data: { jobId, cvUrl: effectiveCvUrl, coverLetter: coverLetter.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success('Ứng tuyển thành công!')
          onSuccess()
          onClose()
        },
        onError: () => {
          toast.error('Có lỗi xảy ra khi ứng tuyển. Vui lòng thử lại.')
        }
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-lg">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Nộp hồ sơ ứng tuyển</h3>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {cvsLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Đang tải thông tin...</p>
          ) : cvList.length === 0 ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground text-center">
                Bạn chưa tải lên CV. Vui lòng tải CV lên trước khi ứng tuyển.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                disabled={uploadMutation.isPending}
                onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <div
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed border-primary/20 bg-primary/[0.02] p-6 text-center rounded-xl transition-all cursor-pointer hover:border-primary/45 hover:bg-primary/[0.04]`}
                onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Chọn file PDF để tải lên
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Định dạng PDF • Tối đa 5MB
                  </p>
                </div>
              </div>
              {uploadMutation.isPending && (
                <p className="text-xs text-muted-foreground text-center animate-pulse">Đang tải lên và xử lý...</p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="cv-select" className="block text-sm font-medium text-foreground mb-1.5">
                  Chọn CV ứng tuyển
                </label>
                <select
                  id="cv-select"
                  value={effectiveCvUrl}
                  onChange={(e) => setSelectedCvUrl(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {cvList.map((cv) => (
                    <option key={cv.id} value={cv.url ?? ''}>
                      {cv.filename} {cv.default ? '(Mặc định)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1.5">
                  Thư xin việc <span className="font-normal text-muted-foreground">(tùy chọn)</span>
                </p>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Viết thư xin việc của bạn..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
                  rows={4}
                />
              </div>
              {submitMutation.isError && (
                <p className="text-sm text-destructive">Có lỗi xảy ra. Vui lòng thử lại.</p>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={onClose} disabled={submitMutation.isPending}>
                  Hủy
                </Button>
                <Button onClick={handleSubmit} disabled={submitMutation.isPending || !effectiveCvUrl}>
                  {submitMutation.isPending ? 'Đang nộp...' : 'Nộp hồ sơ'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnalyzeCvModal — lets user pick or upload a CV, then triggers analysis
// ---------------------------------------------------------------------------
interface AnalyzeCvModalProps {
  jobId: string
  lang: string
  isAnalyzing: boolean
  onAnalyze: (cvId: string) => void
  onAnalyzeDone: (result: AiModels.CvFullAnalysisResponse) => void
  onError: (msg: string) => void
  onClose: () => void
}

function AnalyzeCvModal({ jobId, lang, isAnalyzing, onAnalyze, onAnalyzeDone, onError, onClose }: AnalyzeCvModalProps) {
  const { isAuthenticated, role } = useAuthStore()
  const isCandidate = isAuthenticated && hasCandidateRole(role)
  const [selectedCvId, setSelectedCvId] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: cvsData, isLoading: cvsLoading } = useListCvs({
    query: { enabled: isCandidate },
  })
  const cvList = React.useMemo(() => cvsData?.data ?? [], [cvsData?.data])
  const effectiveCvId = selectedCvId || cvList.find((c) => c.default)?.id || cvList[0]?.id || ''

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return AXIOS_INSTANCE.post('/api/candidates/cv/upload', form, {
        transformRequest: [
          (data, headers) => {
            if (headers) delete (headers as Record<string, unknown>)['Content-Type']
            return data
          },
        ],
      })
    },
    onSuccess: () => {
      toast.success(lang === 'VI' ? 'Tải lên CV thành công!' : 'CV uploaded successfully!')
      queryClient.invalidateQueries({ queryKey: getListCvsQueryKey() })
    },
    onError: () => toast.error(lang === 'VI' ? 'Tải lên thất bại. Vui lòng thử lại.' : 'Upload failed. Please try again.'),
  })

  const analyzeMutation = useAnalyzeCv({
    mutation: {
      onSuccess: (data) => {
        const result = (data as any)?.data as AiModels.CvFullAnalysisResponse
        onAnalyzeDone(result)
      },
      onError: (err: any) => {
        const code = err?.response?.data?.code
        if (code === 8012 || code === 6008) {
          onError(lang === 'VI' ? 'Hết lượt sử dụng AI. Vui lòng nâng cấp gói dịch vụ.' : 'Out of AI credits. Please upgrade your package.')
        } else {
          onError(lang === 'VI' ? 'Phân tích CV thất bại. Vui lòng thử lại.' : 'CV analysis failed. Please try again.')
        }
      },
    },
  })

  const handleUpload = (file: File | null) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error(lang === 'VI' ? 'Chỉ chấp nhận file PDF' : 'Only PDF files are accepted')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(lang === 'VI' ? 'File CV tối đa 5MB' : 'CV file must be under 5MB')
      return
    }
    uploadMutation.mutate(file)
  }

  const handleAnalyze = () => {
    if (!effectiveCvId) return
    onAnalyze(effectiveCvId)
    analyzeMutation.mutate({ data: { cvId: effectiveCvId, jobId } })
  }

  const busy = isAnalyzing || analyzeMutation.isPending || uploadMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-[460px] border-border bg-card shadow-2xl rounded-2xl">
        <CardContent className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[var(--ai)]/10 rounded-xl">
                <Sparkles className="h-5 w-5 text-[var(--ai)]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {lang === 'VI' ? 'Phân tích CV với Job này' : 'Analyze CV for this Job'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === 'VI' ? 'AI sẽ đánh giá mức độ phù hợp của bạn' : 'AI will evaluate your fit for this position'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {cvsLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center animate-pulse">
              {lang === 'VI' ? 'Đang tải danh sách CV...' : 'Loading CVs...'}
            </p>
          ) : cvList.length === 0 ? (
            /* No CV — show upload area */
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3 text-sm text-amber-700 dark:text-amber-400">
                {lang === 'VI'
                  ? 'Bạn chưa tải lên CV nào. Hãy tải lên CV để tiến hành phân tích.'
                  : 'You have no CV uploaded yet. Please upload one to analyze.'}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                disabled={uploadMutation.isPending}
                onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <div
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[var(--ai)]/20 bg-[var(--ai)]/[0.02] p-6 text-center rounded-xl transition-all cursor-pointer hover:border-[var(--ai)]/40 hover:bg-[var(--ai)]/[0.04]"
                onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ai)]/10 text-[var(--ai)]">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {lang === 'VI' ? 'Kéo thả hoặc bấm để chọn file PDF' : 'Drag & drop or click to choose PDF'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF • {lang === 'VI' ? 'Tối đa 5MB' : 'Max 5MB'}</p>
                </div>
              </div>
              {uploadMutation.isPending && (
                <p className="text-xs text-muted-foreground text-center animate-pulse">
                  {lang === 'VI' ? 'Đang tải lên...' : 'Uploading...'}
                </p>
              )}
            </div>
          ) : (
            /* Has CVs — show selector */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {lang === 'VI' ? 'Chọn CV để phân tích' : 'Select CV to analyze'}
                </label>
                <select
                  value={effectiveCvId}
                  onChange={(e) => setSelectedCvId(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ai)]/30 disabled:opacity-60"
                >
                  {cvList.map((cv) => (
                    <option key={cv.id} value={cv.id ?? ''}>
                      {cv.filename} {cv.default ? (lang === 'VI' ? '(Mặc định)' : '(Default)') : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload another */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  disabled={busy}
                  onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {lang === 'VI' ? 'Hoặc tải lên CV mới' : 'Or upload a new CV'}
                </button>
              </div>

              {/* Analyze CTA */}
              <Button
                className="w-full bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white h-11"
                disabled={!effectiveCvId || busy}
                onClick={handleAnalyze}
              >
                <Sparkles className={cn('h-4 w-4 mr-2', busy && 'animate-pulse')} />
                {busy
                  ? (lang === 'VI' ? 'Đang phân tích...' : 'Analyzing...')
                  : (lang === 'VI' ? 'Bắt đầu phân tích' : 'Start Analysis')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CvJobAnalysisResult — renders the analysis response inline
// ---------------------------------------------------------------------------
function scoreColor(score: number) {
  if (score >= 85) return { text: 'text-emerald-600 dark:text-emerald-400', ring: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/30' }
  if (score >= 70) return { text: 'text-blue-600 dark:text-blue-400', ring: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-950/30' }
  if (score >= 50) return { text: 'text-amber-600 dark:text-amber-400', ring: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/30' }
  return { text: 'text-rose-600 dark:text-rose-400', ring: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-950/30' }
}

const CIRC = 99.9

function CvJobAnalysisResult({ result, lang }: { result: AiModels.CvFullAnalysisResponse; lang: string }) {
  const score = result.overallScore ?? 0
  const matchScore = result.matchScore ?? 0
  const colors = scoreColor(score)
  const dash = (score / 100) * CIRC

  const summary = lang === 'VI' && result.summaryVi ? result.summaryVi : result.summary

  const sortedTips = [...(result.tips ?? [])].sort((a, b) => {
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
    return (order[a.priority ?? ''] ?? 2) - (order[b.priority ?? ''] ?? 2)
  })

  return (
    <div className="space-y-4">
      {/* Score + Summary */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          {/* Overall score ring */}
          <div className="relative shrink-0 w-[76px] h-[76px]">
            <svg viewBox="0 0 36 36" className="w-[76px] h-[76px]">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                className="text-slate-200 dark:text-slate-800" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                className={colors.ring} strokeWidth="3"
                strokeDasharray={`${dash} ${CIRC - dash}`}
                strokeDashoffset="0"
                transform="rotate(-90, 18, 18)"
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-xl font-bold tabular-nums leading-none', colors.text)}>{score}</span>
              <span className="text-[9px] text-muted-foreground font-medium mt-0.5">/ 100</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={cn('text-base font-bold', colors.text)}>{result.scoreLabel}</span>
              {result.targetPosition && (
                <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-muted/40 px-2 py-0.5 text-xs text-slate-600 dark:text-muted-foreground font-medium">
                  {lang === 'VI' ? 'Vị trí:' : 'Position:'} {result.targetPosition}
                </span>
              )}
              {matchScore > 0 && (
                <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold border', colors.bg, colors.text)}>
                  {lang === 'VI' ? 'Phù hợp:' : 'Match:'} {matchScore}%
                </span>
              )}
            </div>
            {summary && (
              <p className="mt-1.5 text-sm text-slate-600 dark:text-muted-foreground leading-relaxed">{summary}</p>
            )}
          </div>
        </div>
      </div>

      {/* Skills */}
      {((result.matchedSkills?.length ?? 0) + (result.missingSkills?.length ?? 0) + (result.extraSkills?.length ?? 0)) > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Skills</p>
          {(result.matchedSkills?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {lang === 'VI' ? 'Kỹ năng phù hợp' : 'Matched Skills'} ({result.matchedSkills!.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.matchedSkills!.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30">
                    <span className="opacity-70">✓</span> {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(result.missingSkills?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {lang === 'VI' ? 'Kỹ năng còn thiếu' : 'Missing Skills'} ({result.missingSkills!.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills!.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30">
                    <span className="opacity-70">✗</span> {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(result.extraSkills?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'VI' ? 'Kỹ năng bổ sung' : 'Extra Skills'} ({result.extraSkills!.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.extraSkills!.map((s) => (
                  <span key={s} className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {((result.strengths?.length ?? 0) + (result.weaknesses?.length ?? 0)) > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(result.strengths?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/10 p-4 space-y-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {lang === 'VI' ? 'Điểm mạnh' : 'Strengths'} · {result.strengths!.length}
              </p>
              <ul className="space-y-3">
                {result.strengths!.map((s, i) => (
                  <li key={`${s.area}-${i}`}>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{s.area}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-900/80 dark:text-muted-foreground">{lang === 'VI' && s.detailVi ? s.detailVi : s.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(result.weaknesses?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/10 p-4 space-y-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {lang === 'VI' ? 'Điểm cần cải thiện' : 'Weaknesses'} · {result.weaknesses!.length}
              </p>
              <ul className="space-y-3">
                {result.weaknesses!.map((w, i) => (
                  <li key={`${w.area}-${i}`}>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{w.area}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-muted-foreground">{lang === 'VI' && w.detailVi ? w.detailVi : w.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Improvement Tips */}
      {sortedTips.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
            {lang === 'VI' ? 'Gợi ý cải thiện' : 'Improvement Tips'} · {sortedTips.length}
          </p>
          <div className="space-y-2">
            {sortedTips.map((tip, i) => {
              const priorityBar = tip.priority === 'High' ? 'bg-rose-500' : tip.priority === 'Medium' ? 'bg-amber-500' : 'bg-slate-400'
              const priorityBadge = tip.priority === 'High'
                ? 'bg-rose-100 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/30'
                : tip.priority === 'Medium'
                  ? 'bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30'
                  : 'bg-slate-100 dark:bg-slate-900/20 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              const priorityLabel = lang === 'VI'
                ? (tip.priority === 'High' ? 'Cao' : tip.priority === 'Medium' ? 'Trung bình' : 'Thấp')
                : tip.priority
              return (
                <div key={`${tip.area}-${i}`} className="flex gap-3 rounded-lg border border-slate-200 dark:border-border/50 bg-white/90 dark:bg-slate-900/60 p-3.5 shadow-sm">
                  <div className={cn('mt-0.5 w-1 shrink-0 rounded-full self-stretch min-h-[1.5rem]', priorityBar)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{tip.area}</span>
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold border', priorityBadge)}>
                        {priorityLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-muted-foreground">{lang === 'VI' && tip.suggestionVi ? tip.suggestionVi : tip.suggestion}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
