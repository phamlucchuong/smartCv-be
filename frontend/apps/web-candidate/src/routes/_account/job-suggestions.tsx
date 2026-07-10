import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, Input } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { Clock3, DollarSign, MapPin, Sparkles, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useGetJobSuggestions } from '@smart-cv/api'
import { useAuthStore } from '../../store/useAuthStore'

export const Route = createFileRoute('/_account/job-suggestions')({
  component: JobSuggestionsPage,
})

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Negotiable'
  if (min && max) return `${(min / 1_000_000).toFixed(0)}–${(max / 1_000_000).toFixed(0)}M`
  if (min) return `${(min / 1_000_000).toFixed(0)}M+`
  return `Up to ${((max ?? 0) / 1_000_000).toFixed(0)}M`
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

function JobSuggestionsPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthStore()
  const { data, isLoading, isError } = useGetJobSuggestions({ query: { enabled: isAuthenticated } })
  const suggestions = data?.data ?? []

  const [selectedChip, setSelectedChip] = React.useState('all')
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    document.title = t('page_title_job_suggestions')
  }, [t])

  const chips = [
    { key: 'all', label: t('job_suggestions_filter_all') },
    { key: 'React', label: 'React' },
    { key: 'TypeScript', label: 'TypeScript' },
    { key: 'Next.js', label: 'Next.js' },
    { key: 'Node.js', label: 'Node.js' },
  ]

  const filtered = suggestions.filter((item) => {
    const job = item.job
    const q = query.trim().toLowerCase()
    const matchText = q === '' || (job?.title ?? '').toLowerCase().includes(q) || (job?.company ?? '').toLowerCase().includes(q)
    const matchChip = selectedChip === 'all' || (job?.skills ?? []).some((skill) => skill.toLowerCase().includes(selectedChip.toLowerCase()))
    return matchText && matchChip
  })

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading job suggestions...</div>
  if (isError) return <div className="p-8 text-center text-destructive">Failed to load job suggestions.</div>

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('job_suggestions_page_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('job_suggestions_subtitle')}</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('job_suggestions_search_placeholder')} className="h-10 max-w-sm border-input bg-background" />
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
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">{t('account_no_results')}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const job = item.job
            const initials = (job?.company ?? '').slice(0, 2).toUpperCase()
            const salary = formatSalary(job?.salaryMin, job?.salaryMax)
            return (
              <article key={item.jobId} className="elevate-card card-surface rounded-2xl p-5">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-xs font-bold text-muted-foreground">{initials}</div>
                    <div>
                      <h3 className="text-base font-semibold">{job?.title}</h3>
                      <p className="text-sm text-muted-foreground">{job?.company}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-ai/20 bg-ai-soft px-2.5 py-1 text-xs font-semibold text-ai">{t('job_match_score_pct', { score: Math.round((item.matchScore ?? 0) * 100) })}</span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-1"><DollarSign className="h-3.5 w-3.5" />{salary}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1"><MapPin className="h-3.5 w-3.5" />{job?.location}</span>
                  {(job as { openings?: number })?.openings != null && (job as { openings?: number }).openings! > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1"><Users className="h-3.5 w-3.5" />{(job as { openings?: number }).openings} vị trí</span>
                  )}
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {(job?.skills ?? []).map((skill) => <Badge key={skill} variant="outline" className="border-border bg-secondary/70 text-xs text-secondary-foreground">{skill}</Badge>)}
                </div>

                {item.matchReason && (
                  <p className="mb-4 inline-flex items-center gap-1 rounded-md border border-ai/20 bg-ai-soft px-2 py-1 text-xs text-ai"><Sparkles className="h-3.5 w-3.5" />{item.matchReason}</p>
                )}

                <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDate(item.suggestedAt)}</span>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      // Apply coming soon — no submit hook wired to suggestions
                      toast.info('Apply coming soon')
                    }}
                  >
                    {t('job_apply_now')}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
