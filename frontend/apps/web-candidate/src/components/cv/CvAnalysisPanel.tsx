import { useTranslation } from '@smart-cv/i18n'
import { Button, cn } from '@smart-cv/ui'
import type { UserModels } from '@smart-cv/api'
import { usePreferencesStore } from '../../store/usePreferencesStore'

interface StrengthItem {
  area: string
  detail: string
  detailVi?: string
}

interface WeaknessItem {
  area: string
  detail: string
  detailVi?: string
}

interface ImprovementTip {
  area: string
  suggestion: string
  suggestionVi?: string
  priority: 'High' | 'Medium' | 'Low'
}

interface CvFullAnalysisResult {
  overallScore: number
  scoreLabel: string
  targetPosition: string
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  extraSkills: string[]
  summary: string
  summaryVi?: string
  strengths: StrengthItem[]
  weaknesses: WeaknessItem[]
  tips: ImprovementTip[]
  extractedSkills: string[]
}

interface CvAnalysisPanelProps {
  analysisResultJson: string | null | undefined
  analysisStatus: UserModels.CvItemAnalysisStatus | undefined
  onRetry: () => void
}

function scoreTextColor(score: number): string {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 70) return 'text-blue-600 dark:text-blue-400'
  if (score >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

function scoreRingColor(score: number): string {
  if (score >= 85) return 'text-emerald-500'
  if (score >= 70) return 'text-blue-500'
  if (score >= 50) return 'text-amber-500'
  return 'text-rose-500'
}

function priorityBadge(priority: string): string {
  if (priority === 'High') return 'bg-rose-100 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/30'
  if (priority === 'Medium') return 'bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30'
  return 'bg-slate-100 dark:bg-slate-900/20 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'
}

function priorityBar(priority: string): string {
  if (priority === 'High') return 'bg-rose-500'
  if (priority === 'Medium') return 'bg-amber-500'
  return 'bg-slate-400'
}

const CIRCUMFERENCE = 99.9

export function CvAnalysisPanel({ analysisResultJson, analysisStatus, onRetry }: CvAnalysisPanelProps) {
  const { t } = useTranslation()
  const lang = usePreferencesStore((s) => s.language)

  let analysis: CvFullAnalysisResult | null = null
  let parseError = false
  if (analysisResultJson) {
    try {
      analysis = JSON.parse(analysisResultJson) as CvFullAnalysisResult
    } catch {
      parseError = true
    }
  }

  if (analysisStatus === 'FAILED' || parseError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/10 p-6 text-center">
        <p className="text-sm text-rose-600 dark:text-rose-400">{t('cv_analysis_failed')}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('cv_analysis_retry')}
        </Button>
      </div>
    )
  }

  if (!analysis) return null

  const score = analysis.overallScore ?? 0
  const dash = (score / 100) * CIRCUMFERENCE

  const sortedTips = [...(analysis.tips ?? [])].sort((a, b) => {
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
  })

  const hasSkills = (analysis.matchedSkills?.length ?? 0) + (analysis.missingSkills?.length ?? 0) + (analysis.extraSkills?.length ?? 0) > 0
  const hasStrengthsOrWeaknesses = (analysis.strengths?.length ?? 0) + (analysis.weaknesses?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      {/* Score + Summary */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          {/* Score ring */}
          <div className="relative shrink-0 w-[76px] h-[76px]">
            <svg viewBox="0 0 36 36" className="w-[76px] h-[76px]">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                className="text-slate-200 dark:text-slate-800" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                className={scoreRingColor(score)} strokeWidth="3"
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset="0"
                transform="rotate(-90, 18, 18)"
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-xl font-bold tabular-nums leading-none', scoreTextColor(score))}>
                {score}
              </span>
              <span className="text-[9px] text-muted-foreground font-medium mt-0.5">/ 100</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-base font-bold', scoreTextColor(score))}>
                {analysis.scoreLabel}
              </span>
              {analysis.targetPosition && (
                <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-muted/40 px-2 py-0.5 text-xs text-slate-600 dark:text-muted-foreground font-medium shadow-sm">
                  {t('cv_analysis_target_position')}: {analysis.targetPosition}
                </span>
              )}
            </div>
            {analysis.summary && (
              <p className="mt-2 text-sm text-slate-600 dark:text-muted-foreground leading-relaxed">
                {lang === 'VI' && analysis.summaryVi ? analysis.summaryVi : analysis.summary}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Skills */}
      {hasSkills && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
            Skills
          </p>

          {analysis.matchedSkills?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {t('cv_analysis_matched_skills')} ({analysis.matchedSkills.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.matchedSkills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                    <span className="opacity-70">✓</span> {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.missingSkills?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {t('cv_analysis_missing_skills')} ({analysis.missingSkills.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.missingSkills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30 shadow-sm">
                    <span className="opacity-70">✗</span> {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.extraSkills?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('cv_analysis_extra_skills')} ({analysis.extraSkills.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.extraSkills.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {hasStrengthsOrWeaknesses && (
        <div className="grid gap-4 sm:grid-cols-2">
          {analysis.strengths?.length > 0 && (
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/10 p-4 space-y-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {t('cv_analysis_strengths')} · {analysis.strengths.length}
              </p>
              <ul className="space-y-3">
                {analysis.strengths.map((s, i) => (
                  <li key={`${s.area}-${i}`}>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{s.area}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-900/80 dark:text-muted-foreground">{lang === 'VI' && s.detailVi ? s.detailVi : s.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.weaknesses?.length > 0 && (
            <div className="rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/10 p-4 space-y-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {t('cv_analysis_weaknesses')} · {analysis.weaknesses.length}
              </p>
              <ul className="space-y-3">
                {analysis.weaknesses.map((w, i) => (
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
            {t('cv_analysis_tips')} · {sortedTips.length}
          </p>
          <div className="space-y-2">
            {sortedTips.map((tip, i) => (
              <div key={`${tip.area}-${i}`} className="flex gap-3 rounded-lg border border-slate-200 dark:border-border/50 bg-white dark:bg-slate-900/60 p-3.5 shadow-sm transition-shadow hover:shadow-md">
                <div className={cn('mt-0.5 w-1 shrink-0 rounded-full self-stretch min-h-[1.5rem]', priorityBar(tip.priority))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{tip.area}</span>
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold border', priorityBadge(tip.priority))}>
                      {tip.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-muted-foreground">{lang === 'VI' && tip.suggestionVi ? tip.suggestionVi : tip.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
