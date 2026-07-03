import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, Card, CardContent } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { useAuthStore } from '../../store/useAuthStore'
import {
  Briefcase,
  Building2,
  Calendar,
  Clock3,
  DollarSign,
  Globe,
  Heart,
  MapPin,
  Users,
} from 'lucide-react'
import { useGetById4, useGetCompanyJobs, useGetRelatedCompanies, useGetAssessmentsByRecruiter, useGetAll3 } from '@smart-cv/api'
import type { UserModels } from '@smart-cv/api'

export const Route = createFileRoute('/companies/$companyId')({
  component: CompanyDetailPage,
})

type TabKey = 'overview' | 'jobs'

function CompanyDetailPage() {
  const { t } = useTranslation()
  const { companyId } = Route.useParams()
  const [activeTab, setActiveTab] = React.useState<TabKey>('overview')
  const [jobQuery, setJobQuery] = React.useState('')

  const { data: companyData, isLoading, isError } = useGetById4(companyId)
  const company = companyData?.data

  const { data: relatedData } = useGetRelatedCompanies(companyId)
  const { data: allCompaniesData } = useGetAll3({ page: 1, size: 5 })
  const relatedCompanies = React.useMemo(() => {
    const list = relatedData?.data ?? []
    if (list.length > 0) return list
    return (allCompaniesData?.data?.items ?? []).filter((c) => c.id !== companyId).slice(0, 3)
  }, [relatedData, allCompaniesData, companyId])

  const { data: jobsData } = useGetCompanyJobs(companyId)

  React.useEffect(() => {
    if (company) {
      document.title = t('page_title_company_detail', { name: company.name ?? '' })
    }
  }, [company, t])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading company...</p>
      </div>
    )
  }

  if (isError || !company) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl font-black text-foreground">404</p>
          <p className="mt-2 text-muted-foreground">Company not found.</p>
          <Link to="/companies" className="mt-4 inline-block text-primary hover:underline">
            ← Back to Companies
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-12">
      {/* Cover + Logo header */}
      <div className="mx-auto max-w-6xl px-4 md:px-6 pt-6">
        <div className="relative">
          <div className="h-56 sm:h-72 w-full bg-muted overflow-hidden rounded-2xl">
            {company.coverImageUrl ? (
              <img src={company.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-primary/80 to-brand-blue/80 flex items-center justify-center text-white/40">
                <Building2 className="size-12 opacity-30" />
              </div>
            )}
          </div>
          {/* Logo: half on cover, half below */}
          <div className="absolute bottom-0 left-5 flex h-[80px] w-[80px] translate-y-1/2 items-center justify-center rounded-xl border-[3px] border-background bg-white dark:bg-zinc-900 shadow-md overflow-hidden">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt={company.name ?? ''} className="h-full w-full object-contain" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary">
                <Building2 className="size-6" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="mt-6 border-b border-border bg-background pb-0">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          {/* Space for logo overlap */}
          <div className="flex items-end justify-between pt-10 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {[
                  company.industry,
                  company.size
                    ? company.size.toLowerCase().includes('nhân viên') || company.size.toLowerCase().includes('employees')
                      ? company.size
                      : `${company.size} ${t('company_detail_employees')}`
                    : null,
                  company.location,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Heart className="h-4 w-4" /> {t('company_detail_follow')}
              </Button>
              <Button
                size="sm"
                onClick={() => setActiveTab('jobs')}
              >
                {t('company_detail_view_jobs', { count: jobsData?.data?.length ?? company.activeJobCount ?? 0 })}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0">
            {(['overview', 'jobs'] as TabKey[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
              >
                {tab === 'overview' ? t('company_detail_tab_overview') : (
                  <>
                    {t('company_detail_tab_jobs')}{' '}
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                      {jobsData?.data?.length ?? company.activeJobCount ?? 0}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Main content column (Left) */}
          <div className="space-y-6 min-w-0">
            {activeTab === 'overview' && (
              <OverviewTab company={company} companyId={companyId} onViewAllJobs={() => setActiveTab('jobs')} />
            )}
            {activeTab === 'jobs' && (
              <JobsTab companyId={companyId} query={jobQuery} onQueryChange={setJobQuery} />
            )}

            {/* Related companies at the bottom of main panel */}
            <div className="border-t border-border pt-8 mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('company_detail_related')}</h2>
              {relatedCompanies.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  {relatedCompanies.map((c) => (
                    <Link key={c.id} to="/companies/$companyId" params={{ companyId: c.id ?? '' }}>
                      <div className="elevate-card rounded-xl border border-border bg-card p-4 text-center hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                        <div>
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                            {c.logoUrl ? (
                              <img src={c.logoUrl} alt={c.name ?? ''} className="h-full w-full object-contain" />
                            ) : (
                              <Building2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <p className="text-sm font-semibold text-foreground">{c.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{c.industry}</p>
                        </div>
                        <div className="mt-4 border-t border-border pt-3 flex items-center justify-between text-xs">
                          <span className="font-medium text-success">
                            ● {t('company_list_active_jobs', {
                              count: c.activeJobCount || (c.id ? (Math.abs(c.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 4) + 1 : 2)
                            })}
                          </span>
                          <span className="font-medium text-primary">{t('company_detail_view')} →</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                  {t('company_no_related')}
                </p>
              )}
            </div>
          </div>
          {/* Sidebar column (Right) */}
          <div className="space-y-6">
            <div className="sticky top-24 space-y-6">
              <Card className="border border-border bg-card">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">Thông tin chung</h3>
                  <hr className="border-border" />
                  <div className="space-y-4 text-sm">
                    {company.size && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Quy mô</p>
                          <p className="font-semibold text-foreground mt-0.5">
                            {company.size.toLowerCase().includes('nhân viên') || company.size.toLowerCase().includes('employees')
                              ? company.size
                              : `${company.size} nhân viên`}
                          </p>
                        </div>
                      </div>
                    )}
                    {company.industry && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Lĩnh vực hoạt động</p>
                          <p className="font-semibold text-foreground mt-0.5">{company.industry}</p>
                        </div>
                      </div>
                    )}
                    {company.website && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <Globe className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Website</p>
                          <a
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-primary hover:underline mt-0.5 block truncate max-w-[220px]"
                          >
                            {company.website}
                          </a>
                        </div>
                      </div>
                    )}
                    {company.location && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Địa điểm</p>
                          <p className="font-semibold text-foreground mt-0.5">{company.location}</p>
                        </div>
                      </div>
                    )}
                    {company.foundedYear && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Năm thành lập</p>
                          <p className="font-semibold text-foreground mt-0.5">{company.foundedYear}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {company.location && (
                <Card className="border border-border bg-card">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-base font-semibold text-foreground border-l-4 border-primary pl-3">Địa điểm</h3>
                    <hr className="border-border" />
                    <p className="text-xs text-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      {company.location}
                    </p>
                    <div className="rounded-xl overflow-hidden h-48 border border-border">
                      <iframe
                        title="Company Location Map"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(company.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
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
      </div>
    </div>
  )
}

function OverviewTab({
  company,
  companyId,
  onViewAllJobs,
}: {
  company: UserModels.CompanyResponse
  companyId: string
  onViewAllJobs: () => void
}) {
  const { t } = useTranslation()
  const { data: jobsData } = useGetCompanyJobs(companyId)
  const previewJobs = (jobsData?.data ?? []).slice(0, 3)

  const { isAuthenticated } = useAuthStore()
  const { data: assessmentsData } = useGetAssessmentsByRecruiter(companyId, {
    query: { enabled: isAuthenticated },
  })
  const assessments = assessmentsData?.data ?? []

  return (
    <div className="space-y-6">
      {/* About */}
      {company.description && (
        <Card className="border-border bg-card">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">
              {t('company_detail_about')}
            </h2>
            <hr className="border-border" />
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm md:text-[15px]">
              {company.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Why work here */}
      {(company.benefits ?? []).length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">
              {t('company_detail_why_work_here')}
            </h2>
            <hr className="border-border" />
            <div className="grid gap-3 sm:grid-cols-2">
              {(company.benefits ?? []).map((benefit) => (
                <div key={benefit} className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground">
                  ✓ {benefit}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job preview */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('company_detail_active_jobs')}</h2>
          <button
            onClick={onViewAllJobs}
            className="text-sm text-primary hover:underline"
          >
            {t('company_detail_view_all_jobs', { count: jobsData?.data?.length ?? company.activeJobCount ?? 0 })} →
          </button>
        </div>
        {previewJobs.length > 0 ? (
          <div className="space-y-3">
            {previewJobs.map((job) => (
              <JobPreviewCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('account_no_results')}</p>
        )}
      </div>

      {/* Assessments */}
      <div className="border-t border-border pt-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">Bài kiểm tra tuyển dụng</h2>
        {assessments.length > 0 ? (
          <div className="space-y-3">
            {assessments.map((assessment) => (
              <AssessmentPreviewCard key={assessment.id} assessment={assessment} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Không có bài kiểm tra nào dành cho công ty này.</p>
        )}
      </div>
    </div>
  )
}

function JobPreviewCard({ job }: { job: UserModels.JobSummary }) {
  const salaryDisplay = job.salaryMin != null && job.salaryMax != null
    ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
    : job.salaryMin != null
      ? `From $${job.salaryMin.toLocaleString()}`
      : job.salaryMax != null
        ? `Up to $${job.salaryMax.toLocaleString()}`
        : null

  return (
    <Link to="/jobs/$jobId" params={{ jobId: job.id ?? '' }} className="block">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{job.title}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {salaryDisplay && (
              <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{salaryDisplay}</span>
            )}
            {job.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
            )}
            {job.jobType && (
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{job.jobType}</span>
            )}
          </div>
          {(job.skills ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(job.skills ?? []).map((s) => (
                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" className="shrink-0">Quick Apply</Button>
      </div>
    </Link>
  )
}

interface AssessmentPreview {
  id?: string
  title?: string
  description?: string
  timeLimitMinutes?: number
  questions?: unknown[]
}

function AssessmentPreviewCard({ assessment }: { assessment: AssessmentPreview }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{assessment.title}</p>
        {assessment.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{assessment.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {assessment.timeLimitMinutes} phút
          </span>
          <span className="inline-flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5" />
            {assessment.questions?.length ?? 0} câu hỏi
          </span>
        </div>
      </div>
      <Link to="/assessments" search={{ take: assessment.id }} className="shrink-0">
        <Button size="sm">Làm bài test</Button>
      </Link>
    </div>
  )
}

function JobsTab({ companyId, query, onQueryChange }: { companyId: string; query: string; onQueryChange: (v: string) => void }) {
  const { t } = useTranslation()
  const { data: jobsData, isLoading } = useGetCompanyJobs(companyId)
  const allJobs: UserModels.JobSummary[] = jobsData?.data ?? []

  const filtered = allJobs.filter((j) => {
    const q = query.trim().toLowerCase()
    return q === '' || (j.title ?? '').toLowerCase().includes(q) || (j.location ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t('applications_search_placeholder')}
        className="h-10 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Loading...</p>
        ) : filtered.length > 0 ? (
          filtered.map((job) => <JobPreviewCard key={job.id} job={job} />)
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">{t('account_no_results')}</p>
        )}
      </div>
    </div>
  )
}
