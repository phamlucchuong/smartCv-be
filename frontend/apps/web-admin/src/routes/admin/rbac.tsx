import { createFileRoute } from '@tanstack/react-router'
import {
  useCreatePermission,
  useCreateRole,
  useDeleteRole,
  useGetAllPermission,
  useGetAllRole,
  useUpdateRole,
  type UserRoleResponse,
} from '@smart-cv/api'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from '@smart-cv/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@smart-cv/ui'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/rbac')({ component: AdminRbacPage })

type PermAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'upload'
  | 'download'
  | 'export'
  | 'approve'
  | 'verify'
  | 'refund'

interface ResourceDef {
  key: string
  labelKey: string
  actions: PermAction[]
}

interface Role {
  id: string
  name: string
  description: string
  system: boolean
  permissions: Record<string, PermAction[]>
}

const CRUD_ACTIONS: PermAction[] = ['create', 'read', 'update', 'delete']
const ALL_ACTIONS: PermAction[] = [
  'create',
  'read',
  'update',
  'delete',
  'verify',
  'approve',
  'upload',
  'download',
  'export',
  'refund',
]
const SYSTEM_ROLE_IDS = new Set(['ADMIN', 'RECRUITER', 'CANDIDATE'])

const RESOURCES: ResourceDef[] = [
  { key: 'user', labelKey: 'admin_res_users', actions: [...CRUD_ACTIONS] },
  { key: 'employer_verification', labelKey: 'admin_res_employer_verification', actions: [...CRUD_ACTIONS, 'verify'] },
  { key: 'job', labelKey: 'admin_res_jobs', actions: [...CRUD_ACTIONS, 'approve'] },
  { key: 'cv', labelKey: 'admin_res_cvs', actions: [...CRUD_ACTIONS, 'upload', 'download', 'export'] },
  { key: 'package', labelKey: 'admin_res_packages', actions: [...CRUD_ACTIONS] },
  { key: 'payment', labelKey: 'admin_res_payments', actions: [...CRUD_ACTIONS, 'refund', 'export'] },
  { key: 'ai_config', labelKey: 'admin_res_ai_config', actions: [...CRUD_ACTIONS] },
  { key: 'system_setting', labelKey: 'admin_res_system_settings', actions: [...CRUD_ACTIONS] },
  { key: 'audit_log', labelKey: 'admin_res_audit_logs', actions: [...CRUD_ACTIONS, 'export'] },
]

function cloneRole(role: Role): Role {
  return {
    ...role,
    permissions: Object.fromEntries(Object.entries(role.permissions).map(([key, value]) => [key, [...value]])),
  }
}

function defaultPermissions(fillAll: boolean) {
  return Object.fromEntries(
    RESOURCES.map((resource) => [resource.key, fillAll ? [...resource.actions] : []]),
  ) as Role['permissions']
}

function getPermissionName(resourceKey: string, action: PermAction) {
  return `${resourceKey}.${action}`
}

function formatRoleName(name: string) {
  return name
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function mapRole(role: UserRoleResponse): Role {
  const permissions = defaultPermissions(false)

  for (const permission of role.permissionResponseSet ?? []) {
    const [resourceKey, actionName] = (permission.name ?? '').split('.')
    if (!resourceKey || !actionName) continue
    const action = actionName as PermAction
    if (!ALL_ACTIONS.includes(action) || !(resourceKey in permissions)) continue
    permissions[resourceKey] = [...permissions[resourceKey], action]
  }

  return {
    id: role.name ?? '',
    name: role.name ?? '',
    description: role.description ?? '',
    system: SYSTEM_ROLE_IDS.has(role.name ?? ''),
    permissions,
  }
}

function toRoleRequest(role: Role) {
  return {
    name: role.name.trim(),
    description: role.description.trim(),
    permissions: RESOURCES.flatMap((resource) =>
      (role.permissions[resource.key] ?? []).map((action) => getPermissionName(resource.key, action)),
    ),
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const maybeResponse = error as { response?: { data?: { message?: string } } }
    return maybeResponse.response?.data?.message ?? fallback
  }
  return fallback
}

function RoleEditor({
  role,
  permissions,
  refetchRoles,
  refetchPermissions,
}: {
  role: Role
  permissions: Array<{ name?: string }>
  refetchRoles: () => Promise<unknown>
  refetchPermissions: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [originalRole, setOriginalRole] = useState<Role>(() => cloneRole(role))
  const [draftRole, setDraftRole] = useState<Role>(() => cloneRole(role))

  const createPermissionMutation = useCreatePermission()
  const updateRoleMutation = useUpdateRole()

  const isDirty = useMemo(() => {
    return JSON.stringify(draftRole) !== JSON.stringify(originalRole)
  }, [draftRole, originalRole])
  const isSaving = createPermissionMutation.isPending || updateRoleMutation.isPending

  const updatePerm = (resourceKey: string, action: PermAction, checked: boolean) => {
    setDraftRole((prev) => {
      if (prev.system && prev.id === 'ADMIN') return prev

      const current = new Set(prev.permissions[resourceKey] ?? [])
      if (checked) current.add(action)
      else current.delete(action)

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [resourceKey]: Array.from(current),
        },
      }
    })
  }

  const ensurePermissionsExist = async (permissionNames: string[]) => {
    const existingPermissionNames = new Set(permissions.map((permission) => permission.name ?? ''))
    const missingPermissions = permissionNames.filter((name) => !existingPermissionNames.has(name))

    if (!missingPermissions.length) return

    await Promise.all(
      missingPermissions.map((name) =>
        createPermissionMutation.mutateAsync({
          data: {
            name,
            description: name.replace('.', ' '),
          },
        }),
      ),
    )
  }

  const saveRole = async () => {
    const request = toRoleRequest(draftRole)
    try {
      await ensurePermissionsExist(request.permissions)
      const response = await updateRoleMutation.mutateAsync({
        name: draftRole.id,
        data: request,
      })
      const nextRole = mapRole(response.data!)
      setOriginalRole(cloneRole(nextRole))
      setDraftRole(cloneRole(nextRole))
      await Promise.all([refetchRoles(), refetchPermissions()])
      toast.success(t('admin_rbac_saved_toast'))
    } catch (error) {
      toast.error(getErrorMessage(error, 'Lưu vai trò thất bại'))
    }
  }

  const resetRole = () => {
    setDraftRole(cloneRole(originalRole))
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="card-surface p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="role-name">{t('admin_rbac_role_name')}</Label>
            <Input
              id="role-name"
              className="mt-1.5"
              value={draftRole.name}
              disabled
            />
          </div>
          <div>
            <Label htmlFor="role-desc">{t('admin_rbac_role_desc')}</Label>
            <Input
              id="role-desc"
              className="mt-1.5"
              value={draftRole.description}
              onChange={(event) => setDraftRole({ ...draftRole, description: event.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="card-surface overflow-x-auto bg-card">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-[180px] p-3 font-medium text-muted-foreground text-xs">
                {t('admin_rbac_col_resource') || 'Tài nguyên'}
              </th>
              {ALL_ACTIONS.map((action) => (
                <th key={action} className="p-3 text-center font-medium text-muted-foreground">
                  <span className="text-[10px] uppercase tracking-wider font-semibold">
                    {t(`admin_rbac_perm_${action}`)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {RESOURCES.map((resource) => (
              <tr key={resource.key} className="transition-colors hover:bg-muted/10">
                <td className="p-4 font-medium text-foreground">
                  {t(resource.labelKey)}
                </td>
                {ALL_ACTIONS.map((action) => {
                  const supported = resource.actions.includes(action)
                  const checked = Boolean(draftRole.permissions[resource.key]?.includes(action))
                  const disabled = (draftRole.system && draftRole.id === 'ADMIN') || isSaving
                  const switchId = `${resource.key}-${action}`

                  return (
                    <td key={action} className="p-4 text-center">
                      {supported ? (
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            id={switchId}
                            checked={checked}
                            disabled={disabled}
                            onChange={(event) => updatePerm(resource.key, action, event.target.checked)}
                            className="size-4 cursor-pointer rounded border-input text-primary focus:ring-primary/20 disabled:cursor-not-allowed"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isDirty && (
        <div className="card-surface animate-in fade-in slide-in-from-bottom-2 sticky bottom-4 z-30 flex items-center justify-between rounded-xl border border-primary/20 bg-card/90 p-4 shadow-2xl backdrop-blur-md duration-300">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            <span className="text-sm font-medium text-foreground">
              {t('admin_rbac_unsaved_changes') || 'Bạn có thay đổi chưa lưu cho vai trò này'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={resetRole}>
              {t('admin_rbac_cancel')}
            </Button>
            <Button size="sm" disabled={isSaving} onClick={() => void saveRole()}>
              {t('admin_rbac_save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminRbacPage() {
  const { t } = useTranslation()
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')

  const { data: rolesData, isLoading: isRolesLoading, refetch: refetchRoles } = useGetAllRole()
  const { data: permissionsData, isLoading: isPermissionsLoading, refetch: refetchPermissions } = useGetAllPermission()
  const createRoleMutation = useCreateRole()
  const deleteRoleMutation = useDeleteRole()

  const roles = useMemo(() => (rolesData?.data ?? []).map(mapRole), [rolesData])
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null
  const selectedValue = selectedRole?.id ?? ''
  const isLoading = isRolesLoading || isPermissionsLoading
  const isDeleting = deleteRoleMutation.isPending

  const deleteRole = async (roleId: string) => {
    try {
      await deleteRoleMutation.mutateAsync({ name: roleId })
      if (selectedRoleId === roleId) {
        setSelectedRoleId('')
      }
      await refetchRoles()
      toast.success('Đã xóa vai trò')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Xóa vai trò thất bại'))
    }
  }

  const createRole = async () => {
    const trimmedName = newRoleName.trim()
    if (!trimmedName) return

    try {
      const response = await createRoleMutation.mutateAsync({
        data: {
          name: trimmedName,
          description: newRoleDescription.trim(),
          permissions: [],
        },
      })
      const nextRole = mapRole(response.data!)
      await refetchRoles()
      setSelectedRoleId(nextRole.id)
      setCreateOpen(false)
      setNewRoleName('')
      setNewRoleDescription('')
      toast.success('Đã tạo vai trò mới')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Tạo vai trò thất bại'))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 card-surface bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-sm font-semibold text-muted-foreground">{t('admin_rbac_roles')}:</span>
          <Select
            value={selectedValue}
            onValueChange={(value) => {
              setSelectedRoleId(value)
            }}
            disabled={isLoading || !roles.length}
          >
            <SelectTrigger className="w-[220px] bg-background">
              <SelectValue placeholder={t('admin_rbac_roles')} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {formatRoleName(role.name)} {role.system ? `(${t('admin_rbac_role_system_badge')})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {!selectedRole?.system && (
            <Button
              variant="destructive"
              disabled={!selectedRole || isDeleting}
              onClick={() => selectedRole && void deleteRole(selectedRole.id)}
            >
              <Trash2 className="mr-2 size-4" />
              {t('admin_rbac_delete_role')}
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t('admin_rbac_create_role')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="card-surface flex justify-center p-6">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !selectedRole ? (
        <div className="card-surface p-6 text-sm text-muted-foreground">{t('admin_rbac_empty')}</div>
      ) : (
        <RoleEditor
          key={selectedRole.id}
          role={selectedRole}
          permissions={permissionsData?.data ?? []}
          refetchRoles={refetchRoles}
          refetchPermissions={refetchPermissions}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin_rbac_create_role')}</DialogTitle>
            <DialogDescription>{t('admin_rbac_create_role_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-role-name">{t('admin_rbac_role_name')}</Label>
              <Input
                id="new-role-name"
                className="mt-1.5"
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-role-desc">{t('admin_rbac_role_desc')}</Label>
              <Input
                id="new-role-desc"
                className="mt-1.5"
                value={newRoleDescription}
                onChange={(event) => setNewRoleDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('admin_rbac_cancel')}
            </Button>
            <Button
              onClick={() => void createRole()}
              disabled={!newRoleName.trim() || createRoleMutation.isPending}
            >
              {t('admin_rbac_create_role')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
