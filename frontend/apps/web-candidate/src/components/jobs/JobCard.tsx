import { Link } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, cn } from '@smart-cv/ui'
import { Clock3, DollarSign, Heart, MapPin, Users } from 'lucide-react'

type JobCardProps = {
  jobId?: string
  title?: string
  company?: string
  salaryMin?: number
  salaryMax?: number
  location?: string
  openings?: number | null
  skills?: string[]
  deadline?: string
  activityDate?: string
  activityFallback?: string
  daysLeftLabel?: (days: number) => string
  isWishlisted?: boolean
  wishlistDisabled?: boolean
  onWishlistClick?: (e: React.MouseEvent<HTMLButtonElement>, jobId: string) => void
  footerAction?: React.ReactNode
  className?: string
}

function formatSalary(min?: number, max?: number): string {
  if (min != null && max != null) return `$${min.toLocaleString()} - $${max.toLocaleString()}`
  if (min != null) return `From $${min.toLocaleString()}`
  if (max != null) return `Up to $${max.toLocaleString()}`
  return ''
}

function formatDate(dateInput?: string | Date | number): string {
  if (!dateInput) return ''

  if (typeof dateInput === 'number') {
    const d = new Date(dateInput)
    if (Number.isNaN(d.getTime())) return ''
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim()

    if (/^\d+$/.test(cleanStr)) {
      const d = new Date(Number.parseInt(cleanStr, 10))
      if (Number.isNaN(d.getTime())) return ''
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
    if (Number.isNaN(d.getTime())) return ''
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
      if (Number.isNaN(deadlineDate.getTime())) return null
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dDate = new Date(deadlineDate)
      dDate.setHours(23, 59, 59, 999)
      return Math.max(0, Math.floor((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    }

    const year = Number.parseInt(parts[0], 10)
    const month = Number.parseInt(parts[1], 10) - 1
    const day = Number.parseInt(parts[2], 10)
    const deadlineDate = new Date(year, month, day, 23, 59, 59, 999)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.max(0, Math.floor((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
  } catch {
    return null
  }
}

export function JobCard({
  jobId,
  title,
  company,
  salaryMin,
  salaryMax,
  location,
  openings,
  skills,
  deadline,
  activityDate,
  activityFallback,
  daysLeftLabel,
  isWishlisted = false,
  wishlistDisabled = false,
  onWishlistClick,
  footerAction,
  className,
}: JobCardProps) {
  const salary = formatSalary(salaryMin, salaryMax)
  const daysLeft = getDeadlineDaysLeft(deadline)
  const dateLabel = formatDate(activityDate) || activityFallback || ''

  const card = (
    <article className={cn('elevate-card rounded-2xl card-surface p-5 h-64 flex flex-col justify-between', className)}>
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          <div className="mb-2 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold line-clamp-2 h-12 overflow-hidden" title={title}>{title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-1 h-5 overflow-hidden mt-0.5" title={company}>{company}</p>
            </div>
            {onWishlistClick ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full border border-border shrink-0 mt-0.5"
                disabled={wishlistDisabled || !jobId}
                onClick={(e) => {
                  if (!jobId) return
                  onWishlistClick(e, jobId)
                }}
              >
                <Heart className={cn('h-4 w-4 text-primary', isWishlisted && 'fill-current')} />
              </Button>
            ) : null}
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-xs h-7 overflow-hidden items-center">
            {salary ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-primary">
                <DollarSign className="h-3 w-3" />
                {salary}
              </span>
            ) : null}
            {location ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-muted-foreground">
                <MapPin className="h-3 w-3" />{location}
              </span>
            ) : null}
            {openings != null && openings > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-muted-foreground">
                <Users className="h-3 w-3" />{openings} vị trí
              </span>
            ) : null}
          </div>
        </div>

        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5 h-6 overflow-hidden items-center">
            {(skills ?? []).slice(0, 3).map((skill) => (
              <Badge key={skill} variant="outline" className="border-border text-[11px] px-2 py-0.5 truncate max-w-[100px]">{skill}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className={cn('border-t border-border pt-3 text-xs text-muted-foreground mt-auto shrink-0 flex items-center gap-3', footerAction ? 'justify-between' : 'justify-start')}>
        <div className="flex items-center gap-3 min-w-0">
          {dateLabel ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Clock3 className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
          ) : null}
          {daysLeft !== null ? (
            <span className={cn(
              'font-medium whitespace-nowrap',
              daysLeft < 30 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
            )}>
              {daysLeftLabel ? daysLeftLabel(daysLeft) : `${daysLeft} ngày còn lại`}
            </span>
          ) : null}
        </div>
        {footerAction}
      </div>
    </article>
  )

  if (!jobId) return card

  return (
    <Link to="/jobs/$jobId" params={{ jobId }} className="block h-full">
      {card}
    </Link>
  )
}
