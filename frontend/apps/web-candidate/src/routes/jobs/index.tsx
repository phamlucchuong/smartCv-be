import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, Input, JOB_CATEGORY_OPTIONS, JOB_CATEGORY_LABELS, cn } from '@smart-cv/ui'
import { Search, MapPin, DollarSign, Clock3, Users, Heart } from 'lucide-react'
import { getGetMyWishlistsQueryKey, useSearchJobs, useGetHotJobs, useGetMyWishlists, useSave } from '@smart-cv/api'
import { useTranslation } from '@smart-cv/i18n'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { hasCandidateRole, useAuthStore } from '../../store/useAuthStore'

export const Route = createFileRoute('/jobs/')({
  validateSearch: (search: Record<string, unknown>): {
    q?: string
    location?: string
    page?: number
    category?: string
    filterType?: string
    experienceLevel?: string
    jobType?: string
  } => ({
    q: typeof search.q === 'string' ? search.q || undefined : undefined,
    location: typeof search.location === 'string' ? search.location || undefined : undefined,
    page: typeof search.page === 'number' ? search.page : 1,
    category: typeof search.category === 'string' ? search.category || undefined : undefined,
    filterType: typeof search.filterType === 'string' ? search.filterType || undefined : undefined,
    experienceLevel: typeof search.experienceLevel === 'string' ? search.experienceLevel || undefined : undefined,
    jobType: typeof search.jobType === 'string' ? search.jobType || undefined : undefined,
  }),
  component: JobsPage,
})

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

function getDeadlineDaysLeft(deadline?: string): number | null {
  if (!deadline) return null
  try {
    const parts = deadline.split('-')
    if (parts.length !== 3) {
      const deadlineDate = new Date(deadline)
      if (isNaN(deadlineDate.getTime())) return null
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dDate = new Date(deadlineDate)
      dDate.setHours(23, 59, 59, 999)
      return Math.max(0, Math.floor((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    }
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const deadlineDate = new Date(year, month, day, 23, 59, 59, 999)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.max(0, Math.floor((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
  } catch {
    return null
  }
}



function getPageTitle(filters: {
  q?: string
  location?: string
  category?: string
  experienceLevel?: string
  jobType?: string
  filterType?: string
}) {
  if (filters.filterType === 'featured') {
    return 'Việc làm nổi bật'
  }
  const parts: string[] = []
  
  if (filters.category) {
    parts.push(JOB_CATEGORY_LABELS[filters.category] || filters.category)
  } else {
    parts.push('Việc làm')
  }

  if (filters.jobType) {
    const typeLabels: Record<string, string> = {
      FULL_TIME: 'Toàn thời gian',
      PART_TIME: 'Bán thời gian',
      REMOTE: 'Remote',
      CONTRACT: 'Hợp đồng',
      INTERNSHIP: 'Thực tập',
    }
    parts.push(`(${typeLabels[filters.jobType] || filters.jobType})`)
  }

  if (filters.experienceLevel) {
    const levelLabels: Record<string, string> = {
      INTERN: 'Thực tập sinh',
      JUNIOR: 'Junior / Fresher',
      MIDDLE: 'Middle',
      SENIOR: 'Senior',
      LEAD: 'Lead / Manager',
    }
    parts.push(`trình độ ${levelLabels[filters.experienceLevel] || filters.experienceLevel}`)
  }

  if (filters.location) {
    parts.push(`tại ${filters.location}`)
  }

  if (filters.q) {
    parts.push(`cho "${filters.q}"`)
  }

  const title = parts.join(' ')
  if (title === 'Việc làm') {
    return 'Tất cả việc làm'
  }
  return title
}

function JobsPage() {
  const { t } = useTranslation()
  const { q, location, page = 1, category, filterType = 'all', experienceLevel, jobType } = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated, role } = useAuthStore()
  const isCandidate = isAuthenticated && hasCandidateRole(role)

  const isFeatured = filterType === 'featured'

  const { data: activeSearchData, isLoading: isSearchLoading } = useSearchJobs({
    request: {
      keyword: q || undefined,
      location: location || undefined,
      category: (category || undefined) as import('@smart-cv/api').JobModels.JobSearchRequestCategory | undefined,
      experienceLevel: (experienceLevel || undefined) as import('@smart-cv/api').JobModels.JobSearchRequestExperienceLevel | undefined,
      jobType: (jobType || undefined) as import('@smart-cv/api').JobModels.JobSearchRequestJobType | undefined,
      page: page - 1,
      size: 100,
    },
  }, { query: { enabled: !isFeatured } })

  const { data: hotJobsData, isLoading: isHotLoading } = useGetHotJobs({
    query: { enabled: isFeatured }
  })

  const isLoading = isFeatured ? isHotLoading : isSearchLoading

  const rawJobs = isFeatured 
    ? (hotJobsData?.data ?? []) 
    : (activeSearchData?.data?.items ?? [])

  const filteredJobs = rawJobs
  const { data: wishlistsData } = useGetMyWishlists({
    query: { enabled: isCandidate },
  })
  const savedJobIds = new Set((wishlistsData?.data ?? []).map((item) => item.jobId).filter(Boolean))
  const saveWishlistMutation = useSave()

  const jobsPerPage = 9
  const total = filteredJobs.length
  const totalPages = Math.max(1, Math.ceil(total / jobsPerPage))
  const safePage = Math.min(page, totalPages)
  const jobs = React.useMemo(() => {
    return filteredJobs.slice((safePage - 1) * jobsPerPage, safePage * jobsPerPage)
  }, [filteredJobs, safePage])

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    navigate({
      search: {
        q: (fd.get('q') as string) || undefined,
        location: (fd.get('location') as string) || undefined,
        category: (fd.get('category') as string) || undefined,
        experienceLevel: (fd.get('experienceLevel') as string) || undefined,
        jobType: (fd.get('jobType') as string) || undefined,
        filterType: (fd.get('filterType') as string) || undefined,
        page: 1,
      },
    })
  }

  function handleSaveJob(e: React.MouseEvent, jobId: string) {
    e.preventDefault()
    e.stopPropagation()

    if (!isCandidate) {
      toast.error('Vui lòng đăng nhập tài khoản ứng viên để lưu công việc này!')
      setTimeout(() => {
        navigate({ to: '/signin' })
      }, 1500)
      return
    }

    if (savedJobIds.has(jobId)) {
      toast.success('Tin tuyển dụng đã có trong danh sách yêu thích!')
      return
    }

    saveWishlistMutation.mutate(
      { data: { jobId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyWishlistsQueryKey() })
          toast.success('Đã lưu tin tuyển dụng!')
        },
        onError: () => {
          toast.error('Không thể lưu tin. Vui lòng thử lại.')
        },
      }
    )
  }

  const pageTitle = getPageTitle({ q, location, category, experienceLevel, jobType, filterType })

  React.useEffect(() => {
    document.title = `${pageTitle} — SmartCV`
  }, [pageTitle])

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-3 py-6 md:px-5 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          {q && <p className="mt-1 text-muted-foreground">Showing results for "{q}"</p>}
        </div>

        {/* Top Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:max-w-md bg-card border border-border p-1.5 rounded-2xl shadow-sm items-center">
          <input type="hidden" name="location" value={location ?? ''} />
          <input type="hidden" name="category" value={category ?? ''} />
          <input type="hidden" name="experienceLevel" value={experienceLevel ?? ''} />
          <input type="hidden" name="jobType" value={jobType ?? ''} />
          <input type="hidden" name="filterType" value={filterType ?? ''} />
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q ?? ''} placeholder="Tìm kiếm công việc..." className="h-10 border-none bg-transparent pl-9 outline-none focus:ring-0 w-full" />
          </div>
          <Button type="submit" className="h-10 rounded-xl px-5">Tìm kiếm</Button>
        </form>
      </div>

      {/* Grid layout: Sidebar + Job list */}
      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 items-start">
        {/* Left Sidebar Filter */}
        <aside className="space-y-6 bg-card border border-border p-6 rounded-2xl h-fit">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-semibold text-foreground text-base">Bộ lọc tìm kiếm</h3>
            {(location || category || experienceLevel || jobType || filterType !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-muted-foreground hover:text-primary h-auto p-0 hover:bg-transparent"
                onClick={() => {
                  navigate({
                    search: {
                      q,
                      page: 1,
                    }
                  })
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </div>

          <form onSubmit={handleSearch} id="sidebar-filter-form" className="space-y-4">
            <input type="hidden" name="q" value={q ?? ''} />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Địa điểm</label>
              <select
                name="location"
                value={location ?? ''}
                onChange={(e) => {
                  const form = e.target.form
                  if (form) form.requestSubmit()
                }}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary outline-none w-full"
              >
                <option value="">Tất cả địa điểm</option>
                <option value="Hà Nội">Hà Nội</option>
                <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                <option value="Đà Nẵng">Đà Nẵng</option>
                <option value="Ho Chi Minh City">Ho Chi Minh City</option>
                <option value="Ha Noi">Ha Noi</option>
                <option value="Da Nang">Da Nang</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ngành nghề</label>
              <select
                name="category"
                value={category ?? ''}
                onChange={(e) => {
                  const form = e.target.form
                  if (form) form.requestSubmit()
                }}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary outline-none w-full"
              >
                <option value="">Tất cả ngành nghề</option>
                {JOB_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cấp bậc</label>
              <select
                name="experienceLevel"
                value={experienceLevel ?? ''}
                onChange={(e) => {
                  const form = e.target.form
                  if (form) form.requestSubmit()
                }}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary outline-none w-full"
              >
                <option value="">Tất cả cấp bậc</option>
                <option value="INTERN">Intern (Thực tập)</option>
                <option value="JUNIOR">Junior / Fresher</option>
                <option value="MIDDLE">Middle (Kinh nghiệm)</option>
                <option value="SENIOR">Senior (Dày dặn)</option>
                <option value="LEAD">Lead / Manager</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hình thức</label>
              <select
                name="jobType"
                value={jobType ?? ''}
                onChange={(e) => {
                  const form = e.target.form
                  if (form) form.requestSubmit()
                }}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary outline-none w-full"
              >
                <option value="">Tất cả hình thức</option>
                <option value="FULL_TIME">Full-time (Toàn thời gian)</option>
                <option value="PART_TIME">Part-time (Bán thời gian)</option>
                <option value="REMOTE">Remote (Làm từ xa)</option>
                <option value="CONTRACT">Contract (Hợp đồng)</option>
                <option value="INTERNSHIP">Internship (Thực tập)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Loại việc làm</label>
              <select
                name="filterType"
                value={filterType}
                onChange={(e) => {
                  const form = e.target.form
                  if (form) form.requestSubmit()
                }}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary outline-none w-full"
              >
                <option value="all">Tất cả loại hình</option>
                <option value="featured">Việc làm nổi bật</option>
                <option value="recent">Việc làm mới đăng</option>
              </select>
            </div>
          </form>
        </aside>

        {/* Right main jobs panel */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-border p-5 h-48 bg-muted/30" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center bg-card border border-border rounded-2xl">
              <p className="text-lg font-semibold">Không tìm thấy việc làm phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">Vui lòng thử lại với các tiêu chí lọc khác.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {jobs.map((job) => (
                  <Link key={job.id} to="/jobs/$jobId" params={{ jobId: job.id ?? '' }} className="block">
                    <article className="elevate-card rounded-2xl border border-border bg-card p-5 h-64 flex flex-col justify-between">
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="mb-2 flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base font-semibold line-clamp-2 h-12 overflow-hidden" title={job.title}>{job.title}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-1 h-5 overflow-hidden mt-0.5" title={job.company}>{job.company}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full border border-border shrink-0 mt-0.5"
                              disabled={saveWishlistMutation.isPending}
                              onClick={(e) => handleSaveJob(e, job.id ?? '')}
                            >
                              <Heart className={cn('h-4 w-4 text-primary', savedJobIds.has(job.id ?? '') && 'fill-current')} />
                            </Button>
                          </div>

                          <div className="mb-3 flex flex-wrap gap-2 text-xs h-7 overflow-hidden items-center">
                            {(job.salaryMin != null || job.salaryMax != null) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-primary">
                                <DollarSign className="h-3 w-3" />
                                {job.salaryMin != null && job.salaryMax != null
                                  ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
                                  : job.salaryMin != null
                                    ? `From $${job.salaryMin.toLocaleString()}`
                                    : `Up to $${job.salaryMax!.toLocaleString()}`}
                              </span>
                            )}
                            {job.location && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-muted-foreground">
                                <MapPin className="h-3 w-3" />{job.location}
                              </span>
                            )}
                            {job.openings != null && job.openings > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-muted-foreground">
                                <Users className="h-3 w-3" />{job.openings} vị trí
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1.5 h-6 overflow-hidden items-center">
                            {(job.skills ?? []).slice(0, 3).map((skill) => (
                              <Badge key={skill} variant="outline" className="border-border text-[11px] px-2 py-0.5 truncate max-w-[100px]">{skill}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-border pt-3 text-xs text-muted-foreground mt-auto shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock3 className="h-3.5 w-3.5" />
                            {job.createdAt ? formatDate(job.createdAt) : 'Vừa mới đăng'}
                          </span>
                          {job.deadline && (() => {
                            const daysLeft = getDeadlineDaysLeft(job.deadline)
                            return daysLeft !== null ? (
                              <span className={cn(
                                "font-medium whitespace-nowrap",
                                daysLeft < 30 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                              )}>
                                {t('job_days_left', { days: daysLeft })}
                              </span>
                            ) : null
                          })()}
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => navigate({ search: (s) => ({ ...s, page: page - 1 }) })}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => navigate({ search: (s) => ({ ...s, page: page + 1 }) })}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
