import { createFileRoute } from '@tanstack/react-router'
import { StatusBadge } from '@/components/ui-kit/StatusBadge'
import { useTranslation } from '@smart-cv/i18n'

export const Route = createFileRoute('/admin/audit-logs')({ component: AuditLogsPage })

function AuditLogsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{t('admin_audit_logs_title')}</h1>
        <div className="flex gap-2">
          <input type="date" className="h-9 rounded-md border border-input bg-background px-3 text-sm" defaultValue="2026-06-01" />
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option>{t('admin_filter_all_actions')}</option><option>User.Update</option><option>Job.Moderate</option></select>
        </div>
      </div>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-3">{t('admin_col_time')}</th><th className="p-3">{t('admin_col_actor')}</th><th className="p-3">{t('admin_col_action')}</th><th className="p-3">{t('admin_col_resource')}</th><th className="p-3">{t('admin_col_result')}</th></tr></thead>
          <tbody>
            {[
              ['2026-06-01 10:15', 'admin@smartcv.vn', 'Employer.Verify', 'company:123', 'Success' as const],
              ['2026-06-01 10:07', 'admin@smartcv.vn', 'Job.Hide', 'job:893', 'Failed' as const],
            ].map((r) => (
              <tr key={`${r[0]}-${r[3]}`} className="border-t border-border"><td className="p-3">{r[0]}</td><td className="p-3">{r[1]}</td><td className="p-3">{r[2]}</td><td className="p-3">{r[3]}</td><td className="p-3"><StatusBadge status={r[4]} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
