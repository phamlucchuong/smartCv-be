import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { Button, Input } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { getGetMyWishlistsQueryKey, useGetMyWishlists, useListCvs, useRemove, useSubmit } from '@smart-cv/api'
import { useQueryClient } from '@tanstack/react-query'
import { JobCard } from '../../components/jobs/JobCard'
import { hasCandidateRole, useAuthStore } from '../../store/useAuthStore'

export const Route = createFileRoute('/_account/wishlists')({
  component: WishlistsPage,
})

function WishlistsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()
  const { isAuthenticated, role } = useAuthStore()
  const isCandidate = isAuthenticated && hasCandidateRole(role)
  const { data, isLoading, isError } = useGetMyWishlists({ query: { enabled: isAuthenticated } })
  const jobs = data?.data ?? []
  const { mutate: removeWishlist } = useRemove()
  const { data: cvsData } = useListCvs({
    query: { enabled: isCandidate },
  })
  const cvList = cvsData?.data ?? []
  const submitMutation = useSubmit()

  const [selectedChip, setSelectedChip] = React.useState('all')
  const [query, setQuery] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    document.title = t('page_title_wishlists')
  }, [t])

  const chips = [
    { key: 'all', label: t('wishlists_filter_all') },
    { key: 'expiring-soon', label: t('wishlists_filter_expiring_soon') },
  ]

  const filtered = jobs.filter((job) => {
    const q = query.trim().toLowerCase()
    const matchText = q === '' || (job.title ?? '').toLowerCase().includes(q) || (job.company ?? '').toLowerCase().includes(q)
    const matchExpiring = selectedChip === 'all' || ((job as { deadline?: string }).deadline ? new Date((job as { deadline?: string }).deadline!) > new Date() : false)
    return matchText && matchExpiring
  })

  const pageSize = 9
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedJobs = React.useMemo(() => {
    return filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  }, [filtered, pageSize, safePage])

  React.useEffect(() => {
    setPage(1)
  }, [query, selectedChip])

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  function handleRemoveWishlist(e: React.MouseEvent<HTMLButtonElement>, jobId: string) {
    e.preventDefault()
    e.stopPropagation()

    removeWishlist(
      { jobId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyWishlistsQueryKey() })
          toast.success(t('account_removed_from_wishlist'))
        },
        onError: () => {
          toast.error('Failed to remove from wishlist')
        },
      }
    )
  }

  function handleQuickApply(e: React.MouseEvent, jobId: string) {
    e.preventDefault()
    e.stopPropagation()

    if (!isCandidate) {
      navigate({ to: '/signin' })
      return
    }

    if (cvList.length === 0) {
      toast.error('Bạn chưa có CV nào. Vui lòng tải lên CV trước khi ứng tuyển.')
      navigate({ to: '/cv' })
      return
    }

    const defaultCv = cvList.find((c) => c.default) ?? cvList[0]
    if (!defaultCv?.url) {
      toast.error('CV của bạn không hợp lệ. Vui lòng kiểm tra lại.')
      navigate({ to: '/cv' })
      return
    }

    submitMutation.mutate(
      { data: { jobId, cvUrl: defaultCv.url } },
      {
        onSuccess: () => {
          toast.success('Ứng tuyển nhanh thành công!')
        },
        onError: () => {
          toast.error('Có lỗi xảy ra khi ứng tuyển. Vui lòng thử lại.')
        },
      }
    )
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading wishlists...</div>
  if (isError) return <div className="p-8 text-center text-destructive">Failed to load wishlists.</div>

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('wishlists_page_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('wishlists_count', { count: filtered.length })}</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('wishlists_search_placeholder')} className="h-10 max-w-sm border-input bg-background" />
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setSelectedChip(chip.key)}
              className={selectedChip === chip.key ? 'cursor-pointer rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground' : 'cursor-pointer rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:bg-muted/50'}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-muted-foreground">
          <Heart className="h-12 w-12" />
          <p>{t('wishlists_empty')}</p>
          <Link to="/"><Button variant="outline">{t('job_find_jobs')}</Button></Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedJobs.map((job) => (
              <JobCard
                key={job.jobId}
                jobId={job.jobId}
                title={job.title}
                company={job.company}
                salaryMin={job.salaryMin}
                salaryMax={job.salaryMax}
                location={job.location}
                openings={(job as { openings?: number }).openings}
                skills={job.skills}
                deadline={(job as { deadline?: string }).deadline}
                activityDate={job.savedAt}
                daysLeftLabel={(days) => t('job_days_left', { days })}
                isWishlisted
                onWishlistClick={handleRemoveWishlist}
                footerAction={<Button size="sm" onClick={(e) => handleQuickApply(e, job.jobId ?? '')} disabled={submitMutation.isPending}>Quick Apply</Button>}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {safePage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
