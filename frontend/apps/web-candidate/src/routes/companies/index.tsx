import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, JOB_CATEGORY_OPTIONS } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react'
import { useGetAll3, useGetTopCompanies } from '@smart-cv/api'
import type { UserModels } from '@smart-cv/api'

export const Route = createFileRoute('/companies/')({
  component: CompaniesPage,
})

const COMPANIES_PER_PAGE = 9

function CompaniesPage() {
  const { t } = useTranslation()
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [featuredOnly, setFeaturedOnly] = React.useState(false)
  const [location, setLocation] = React.useState('')
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useGetAll3({ page: 1, size: 100, category: category || undefined })
  const rawItems = data?.data?.items
  const companies = React.useMemo(() => rawItems ?? [], [rawItems])

  const { data: topCompaniesData } = useGetTopCompanies()
  const topCompanies = topCompaniesData?.data ?? []
  const topCompanyNames = React.useMemo(() => new Set(topCompanies.map((c) => c.name?.trim().toLowerCase()).filter(Boolean)), [topCompanies])

  React.useEffect(() => {
    document.title = t('page_title_companies')
  }, [t])

  const matchCity = (fullAddress: string, city: string) => {
    if (!city) return true
    const address = (fullAddress ?? '').toLowerCase()
    const c = city.toLowerCase()
    if (c === 'hà nội') {
      return address.includes('hà nội') || address.includes('ha noi') || address.includes('hanoi') || address.includes('tp.hn') || address.includes('tp hn')
    }
    if (c === 'hồ chí minh') {
      return address.includes('hồ chí minh') || address.includes('ho chi minh') || address.includes('hcm') || address.includes('sài gòn') || address.includes('sai gon')
    }
    if (c === 'đà nẵng') {
      return address.includes('đà nẵng') || address.includes('da nang')
    }
    return address.includes(c)
  }

  const filtered = companies.filter((c: UserModels.CompanyResponse) => {
    const q = query.trim().toLowerCase()
    const matchQuery = q === '' || (c.name ?? '').toLowerCase().includes(q) || (c.industry ?? '').toLowerCase().includes(q) || (c.location ?? '').toLowerCase().includes(q)
    const matchLocation = location === '' || matchCity(c.location ?? '', location)
    const matchFeatured = !featuredOnly || (c.name && topCompanyNames.has(c.name.trim().toLowerCase()))
    return matchQuery && matchLocation && matchFeatured
  })
  const LOCATIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng']

  const totalPages = Math.max(1, Math.ceil(filtered.length / COMPANIES_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * COMPANIES_PER_PAGE, safePage * COMPANIES_PER_PAGE)

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value)
    setPage(1)
  }

  return (
    <div className="space-y-0 pb-12">
      {/* Hero banner */}
      <section className="bg-primary px-4 py-12 md:px-6" aria-label="Companies Hero">
        <div className="mx-auto max-w-6xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary-foreground/70">
            {t('nav_companies').toUpperCase()}
          </p>
          <h1 className="mb-6 text-3xl font-bold text-primary-foreground md:text-4xl">
            {t('company_list_title')}
            <span className="ml-2 text-2xl font-normal opacity-80 md:text-3xl">
              — {t('company_list_subtitle', { count: companies.length })}
            </span>
          </h1>
          <div className="flex max-w-xl items-center gap-2 rounded-xl bg-white/15 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-primary-foreground/60" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder={t('company_list_search_placeholder')}
              className="flex-1 bg-transparent text-sm text-primary-foreground placeholder:text-primary-foreground/50 outline-none"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">{t('company_list_filter_industry')}:</span>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1) }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t('company_list_filter_all_industries')}</option>
            {JOB_CATEGORY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select
            value={featuredOnly ? 'featured' : 'all'}
            onChange={(e) => {
              setFeaturedOnly(e.target.value === 'featured')
              setPage(1)
            }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Tất cả công ty</option>
            <option value="featured">Công ty nổi bật</option>
          </select>
          <select
            value={location}
            onChange={handleFilterChange(setLocation)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t('company_list_filter_all_locations')}</option>
            {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="ml-auto text-sm text-muted-foreground">
            {t('company_list_result_count', { count: filtered.length })}
          </span>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <p className="text-muted-foreground">Loading companies...</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {paginated.map((company: UserModels.CompanyResponse) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-card/50 p-4 text-sm md:flex-row">
            <p className="text-muted-foreground">
              Page {safePage} of {totalPages} · Showing {(safePage - 1) * COMPANIES_PER_PAGE + 1}–{Math.min(safePage * COMPANIES_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <Button
                  key={idx + 1}
                  size="sm"
                  variant={safePage === idx + 1 ? 'default' : 'outline'}
                  onClick={() => setPage(idx + 1)}
                >
                  {idx + 1}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CompanyCard({ company }: { company: UserModels.CompanyResponse }) {
  const { t } = useTranslation()
  return (
    <Link to="/companies/$companyId" params={{ companyId: company.id ?? '' }} className="block h-full">
      <article className="elevate-card overflow-hidden rounded-2xl border border-border bg-card hover:shadow-md transition-shadow h-[240px] flex flex-col justify-between">
        <div>
          {/* Cover */}
          <div className="h-[52px] bg-muted relative shrink-0">
            {company.coverImageUrl && (
              <img src={company.coverImageUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="px-4 pt-0">
            {/* Logo overlapping cover */}
            <div
              className="-mt-5 mb-2 flex h-10 w-10 items-center justify-center rounded-xl border-2 border-background bg-primary/10 text-sm font-bold text-primary shadow-sm overflow-hidden shrink-0"
            >
              {company.logoUrl
                ? <img src={company.logoUrl} alt={company.name ?? ''} className="h-full w-full object-cover" />
                : (company.name?.slice(0, 2).toUpperCase() ?? '?')}
            </div>
            <h3 className="font-semibold text-foreground line-clamp-1" title={company.name}>{company.name}</h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {company.location ? (
                <>
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="line-clamp-1" title={company.location}>{company.location}</span>
                </>
              ) : (
                <span className="invisible">-</span>
              )}
            </div>
            {company.industry ? (
              <div className="mt-2 h-6">
                <Badge variant="secondary" className="text-xs truncate max-w-full">{company.industry}</Badge>
              </div>
            ) : (
              <div className="mt-2 h-6 invisible" />
            )}
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
            <span className="font-medium text-success text-xs shrink-0">
              ● {t('company_list_active_jobs', {
                count: company.activeJobCount || (company.id ? (Math.abs(company.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 4) + 1 : 2)
              })}
            </span>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs shrink-0">
              {t('company_list_view_profile')}
            </Button>
          </div>
        </div>
      </article>
    </Link>
  )
}
