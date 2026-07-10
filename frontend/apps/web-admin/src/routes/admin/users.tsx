import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@smart-cv/ui'
import { StatusBadge } from '@/components/ui-kit/StatusBadge'
import { useTranslation } from '@smart-cv/i18n'
import {
  useGetAllUsers,
  useUpdateUserStatus,
  useDeleteUser,
} from '@smart-cv/api'
import { toast } from 'sonner'
import { Search, CheckCircle2, XCircle } from 'lucide-react'

export const Route = createFileRoute('/admin/users')({ component: UsersPage })

const ROLE_OPTIONS = ['CANDIDATE', 'RECRUITER', 'ADMIN'] as const

function UsersPage() {
  const { t } = useTranslation()

  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [role, setRole] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setDebouncedKeyword(keyword)
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const { data, isLoading, refetch } = useGetAllUsers({
    page,
    size: 10,
    keyword: debouncedKeyword || undefined,
    role: role || undefined,
    locked: statusFilter === 'all' ? undefined : statusFilter === 'locked',
  })
  const users = data?.data?.items ?? []
  const totalPages = data?.data?.totalPages ?? 1

  const lockMutation = useUpdateUserStatus({
    mutation: {
      onSuccess: (_data, variables) => {
        toast.success(variables.data.locked ? 'User locked' : 'User unlocked')
        refetch()
      },
      onError: () => toast.error('Failed to update status'),
    },
  })

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        toast.success('User deleted')
        refetch()
        setDeleteTarget(null)
      },
      onError: () => toast.error('Failed to delete user'),
    },
  })

  const ROLE_LABEL: Record<string, string> = {
    CANDIDATE: t('admin_role_candidate'),
    RECRUITER: t('admin_role_employer'),
    ADMIN: t('admin_role_admin'),
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('admin_users_title')}</h1>

      {/* Search + Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('admin_search_users_placeholder')}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <select
          value={role ?? ''}
          onChange={(e) => { setPage(1); setRole(e.target.value || undefined) }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 font-medium"
        >
          <option value="">{t('admin_filter_role_all')}</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value as any) }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 font-medium"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Bị khóa</option>
        </select>
      </div>

      {/* Table */}
      <div className="card-surface overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">{t('admin_col_avatar')}</th>
                <th className="p-3">{t('admin_col_name')}</th>
                <th className="p-3">{t('admin_col_email')}</th>
                <th className="p-3">{t('admin_col_role')}</th>
                <th className="p-3">{t('admin_col_verified')}</th>
                <th className="p-3">{t('admin_col_status')}</th>
                <th className="p-3">{t('admin_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const name = user.fullName ?? user.email?.split('@')[0] ?? '?'
                const isLocked = user.locked ?? false
                const isVerified = user.verified ?? false
                const roles = user.roles ?? []
                return (
                  <tr key={user.id} className="border-t border-border">
                    <td className="p-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={name}
                          className="size-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                          {name[0]?.toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-medium">{name}</td>
                    <td className="p-3 text-muted-foreground">{user.email ?? '—'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <span key={r} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {ROLE_LABEL[r] ?? r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      {isVerified
                        ? <CheckCircle2 className="size-4 text-green-500" />
                        : <XCircle className="size-4 text-muted-foreground" />}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={isLocked ? 'Locked' : 'Active'} />
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={lockMutation.isPending}
                          onClick={() => lockMutation.mutate({ userId: user.id!, data: { locked: !isLocked } })}
                        >
                          {isLocked ? t('admin_action_unlock') : t('admin_action_lock')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget({ id: user.id!, name })}
                        >
                          {t('admin_action_delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('admin_page_of', { page, total: totalPages })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t('admin_pagination_prev')}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              {t('admin_pagination_next')}
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin_confirm_delete_title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('admin_confirm_delete_desc', { name: deleteTarget?.name ?? '' })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate({ userID: deleteTarget.id })}
            >
              {deleteMutation.isPending ? 'Deleting…' : t('admin_action_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
