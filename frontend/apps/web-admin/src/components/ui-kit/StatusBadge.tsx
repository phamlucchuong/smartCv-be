import { cn } from '@/lib/utils'

type Status =
  | 'Active'
  | 'Locked'
  | 'Pending'
  | 'PENDING'
  | 'Verified'
  | 'Rejected'
  | 'REJECTED'
  | 'Approved'
  | 'APPROVED'
  | 'Hidden'
  | 'Paid'
  | 'Failed'
  | 'Refunded'
  | 'Success'

const TONE: Record<Status, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Locked: 'bg-slate-100 text-slate-700 border-slate-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Hidden: 'bg-slate-100 text-slate-700 border-slate-200',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Failed: 'bg-red-50 text-red-700 border-red-200',
  Refunded: 'bg-violet-50 text-violet-700 border-violet-200',
  Success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function StatusBadge({ status }: { status: Status | string }) {
  const tone = TONE[status as Status] ?? 'bg-slate-100 text-slate-700 border-slate-200'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', tone)}>
      {status}
    </span>
  )
}
