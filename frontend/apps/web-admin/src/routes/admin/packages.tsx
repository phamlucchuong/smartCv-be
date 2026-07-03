import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
} from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import {
  getGetServicePackagesQueryKey,
  useCreateServicePackage,
  useDeleteServicePackage,
  useGetServicePackages,
  useUpdateServicePackage,
  type ServicePackageResponse,
  type ServicePackageUpsertRequest,
} from '@smart-cv/api'
import { toast } from 'sonner'
import { Briefcase, Check, Cpu, Edit3, FileText, Loader2, Package, Percent, Plus, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/packages')({ component: PackagesPage })

type PackageCategory = 'STANDARD' | 'PLATFORM_FEE'

type PackageFormState = {
  name: string
  price: string
  aiCredits: string
  jobLimit: string
  cvLimit: string
  features: string[]
  featured: boolean
  unlimitedJobs: boolean
  unlimitedCvs: boolean
  category: PackageCategory
}

const INITIAL_FORM: PackageFormState = {
  name: '',
  price: '0',
  aiCredits: '0',
  jobLimit: '0',
  cvLimit: '0',
  features: [],
  featured: false,
  unlimitedJobs: false,
  unlimitedCvs: false,
  category: 'STANDARD',
}

function PackageCard({
  pkg,
  onEdit,
  onDelete,
  formatPrice,
}: {
  pkg: ServicePackageResponse
  onEdit: (pkg: ServicePackageResponse) => void
  onDelete: (pkg: ServicePackageResponse) => void
  formatPrice: (value: number) => string
}) {
  const { t } = useTranslation()
  const isPlatformFee = pkg.category === 'PLATFORM_FEE'
  const visualKey = (pkg.id ?? pkg.name ?? '').toLowerCase()
  const isPlus = !isPlatformFee && visualKey === 'plus'
  const isPro = !isPlatformFee && visualKey === 'pro'

  return (
    <div
      className={cn(
        'relative card-surface flex flex-col justify-between p-6 transition-all duration-300 hover:shadow-lg',
        isPlus && 'border-primary/40 bg-gradient-to-b from-primary/5 to-card ring-2 ring-primary/10 shadow-md',
        isPro && 'border-indigo-500/30 bg-gradient-to-b from-indigo-500/5 to-card',
        isPlatformFee && 'border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-card',
      )}
    >
      {pkg.featured && (
        <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
          <Sparkles className="size-3" />
          {t('admin_most_popular') || 'Phổ biến nhất'}
        </span>
      )}

      <div>
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
          <h2 className={cn('text-xl font-bold', isPro && 'text-indigo-600 dark:text-indigo-400', isPlatformFee && 'text-amber-600 dark:text-amber-400')}>
            {pkg.name}
          </h2>
          {isPlatformFee && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 border border-amber-500/20">
              <Percent className="size-3" />
              Phí sàn
            </span>
          )}
        </div>

        <div className="mt-4 text-3xl font-extrabold text-foreground">
          {formatPrice(pkg.price ?? 0)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">/tháng</span>
        </div>

        {!isPlatformFee && (
          <div className="mt-6 space-y-3.5 border-y border-border/55 py-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Briefcase className="size-4" />
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Tin đăng giới hạn</span>
                <span className="font-semibold text-foreground">
                  {pkg.jobLimit === -1 ? 'Không giới hạn' : `${pkg.jobLimit ?? 0} tin tuyển dụng`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Cpu className="size-4" />
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">AI Credits</span>
                <span className="font-semibold text-foreground">
                  {(pkg.aiCredits ?? 0).toLocaleString('vi-VN')} credits / tháng
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-4" />
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Lượt tải lên CV</span>
                <span className="font-semibold text-foreground">
                  {pkg.cvLimit === -1 ? 'Không giới hạn' : `${(pkg.cvLimit ?? 0).toLocaleString('vi-VN')} CVs`}
                </span>
              </div>
            </div>
          </div>
        )}

        {isPlatformFee && pkg.durationDays != null && (
          <div className="mt-4 text-sm text-muted-foreground">
            Chu kỳ: <span className="font-semibold text-foreground">{pkg.durationDays} ngày</span>
          </div>
        )}

        <ul className="mt-5 space-y-2.5">
          {(pkg.features ?? []).map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button className="cursor-pointer" variant="default" onClick={() => onEdit(pkg)}>
          <Edit3 className="mr-2 size-3.5" />
          Chỉnh sửa
        </Button>
        <Button
          className="cursor-pointer border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
          variant="outline"
          onClick={() => onDelete(pkg)}
        >
          <Trash2 className="mr-2 size-3.5" />
          Xóa
        </Button>
      </div>
    </div>
  )
}

function EmptySection({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <div className="card-surface flex min-h-40 flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">Chưa có {label} nào.</p>
      <Button variant="outline" onClick={onAdd}>Thêm mới</Button>
    </div>
  )
}

function PackagesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<PackageCategory>('STANDARD')
  const [editingPkg, setEditingPkg] = useState<ServicePackageResponse | null>(null)
  const [deletingPkg, setDeletingPkg] = useState<ServicePackageResponse | null>(null)
  const [form, setForm] = useState<PackageFormState>(INITIAL_FORM)
  const [newFeature, setNewFeature] = useState('')

  const packagesQuery = useGetServicePackages()
  const allPackages = packagesQuery.data?.data ?? []
  const standardPackages = allPackages.filter((p) => p.category === 'STANDARD' || !p.category)
  const platformFeePackages = allPackages.filter((p) => p.category === 'PLATFORM_FEE')

  const invalidatePackages = () => queryClient.invalidateQueries({ queryKey: getGetServicePackagesQueryKey() })

  const createMutation = useCreateServicePackage({
    mutation: {
      mutationKey: ['service-packages', 'create'],
      onSuccess: (response) => {
        toast.success(response.message ?? 'Đã tạo gói thành công')
        setEditingPkg(null)
        setForm(INITIAL_FORM)
        void invalidatePackages()
      },
      onError: () => toast.error('Không thể tạo gói'),
    },
  })

  const updateMutation = useUpdateServicePackage({
    mutation: {
      mutationKey: ['service-packages', 'update'],
      onSuccess: (response) => {
        toast.success(response.message ?? 'Đã cập nhật thành công')
        setEditingPkg(null)
        setForm(INITIAL_FORM)
        void invalidatePackages()
      },
      onError: () => toast.error('Không thể cập nhật'),
    },
  })

  const deleteMutation = useDeleteServicePackage({
    mutation: {
      mutationKey: ['service-packages', 'delete'],
      onSuccess: (response) => {
        toast.success(response.message ?? 'Đã xóa thành công')
        setEditingPkg(null)
        setDeletingPkg(null)
        setForm(INITIAL_FORM)
        void invalidatePackages()
      },
      onError: () => toast.error('Không thể xóa'),
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const openCreateDialog = (category: PackageCategory = activeTab) => {
    setEditingPkg({ id: undefined, name: '', price: 0, aiCredits: 0, jobLimit: 0, cvLimit: 0, featured: false, features: [] })
    setForm({ ...INITIAL_FORM, category })
    setNewFeature('')
  }

  const openEditDialog = (pkg: ServicePackageResponse) => {
    setEditingPkg(pkg)
    setForm({
      name: pkg.name ?? '',
      price: String(pkg.price ?? 0),
      aiCredits: String(pkg.aiCredits ?? 0),
      jobLimit: pkg.jobLimit === -1 ? '' : String(pkg.jobLimit ?? 0),
      cvLimit: pkg.cvLimit === -1 ? '' : String(pkg.cvLimit ?? 0),
      features: pkg.features ?? [],
      featured: pkg.featured ?? false,
      unlimitedJobs: pkg.jobLimit === -1,
      unlimitedCvs: pkg.cvLimit === -1,
      category: (pkg.category as PackageCategory) ?? 'STANDARD',
    })
    setNewFeature('')
  }

  const closeDialog = () => {
    setEditingPkg(null)
    setForm(INITIAL_FORM)
    setNewFeature('')
  }

  const updateForm = <K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleAddFeature = () => {
    const trimmed = newFeature.trim()
    if (!trimmed) return
    if (form.features.includes(trimmed)) { toast.error('Tính năng này đã tồn tại'); return }
    updateForm('features', [...form.features, trimmed])
    setNewFeature('')
  }

  const handleRemoveFeature = (index: number) => {
    updateForm('features', form.features.filter((_, i) => i !== index))
  }

  const buildPayload = (): (ServicePackageUpsertRequest & { category: PackageCategory }) | null => {
    const name = form.name.trim()
    const price = Number(form.price)
    const aiCredits = Number(form.aiCredits)
    const jobLimit = form.unlimitedJobs ? -1 : Number(form.jobLimit)
    const cvLimit = form.unlimitedCvs ? -1 : Number(form.cvLimit)
    const features = form.features.map((item) => item.trim()).filter(Boolean)

    if (!name) { toast.error('Tên gói là bắt buộc'); return null }
    if ([price, aiCredits].some(Number.isNaN) || (!form.unlimitedJobs && Number.isNaN(jobLimit)) || (!form.unlimitedCvs && Number.isNaN(cvLimit))) {
      toast.error('Vui lòng nhập đầy đủ cấu hình số'); return null
    }
    if (price < 0 || aiCredits < 0) { toast.error('Giới hạn không hợp lệ'); return null }

    return { name, price, aiCredits, jobLimit, cvLimit, featured: form.featured, features, category: form.category }
  }

  const handleSave = () => {
    if (!editingPkg) return
    const payload = buildPayload()
    if (!payload) return
    if (editingPkg.id) { updateMutation.mutate({ packageId: editingPkg.id, data: payload }); return }
    createMutation.mutate(payload)
  }

  const handleConfirmDelete = () => {
    if (!deletingPkg?.id) return
    deleteMutation.mutate(deletingPkg.id)
  }

  const formatPrice = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

  const tabs: { key: PackageCategory; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'STANDARD', label: 'Gói dịch vụ', icon: <Package className="size-4" />, count: standardPackages.length },
    { key: 'PLATFORM_FEE', label: 'Phí sàn', icon: <Percent className="size-4" />, count: platformFeePackages.length },
  ]

  const currentPackages = activeTab === 'STANDARD' ? standardPackages : platformFeePackages

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('admin_packages_title')}</h1>
        <Button className="cursor-pointer" onClick={() => openCreateDialog()}>
          <Plus className="mr-2 size-4" />
          Thêm mới
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
            <span className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
              activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/20 text-muted-foreground',
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {packagesQuery.isLoading ? (
        <div className="card-surface flex min-h-52 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : packagesQuery.isError ? (
        <div className="card-surface flex min-h-52 items-center justify-center text-sm text-muted-foreground">
          Không thể tải danh sách.
        </div>
      ) : currentPackages.length === 0 ? (
        <EmptySection
          onAdd={() => openCreateDialog(activeTab)}
          label={activeTab === 'STANDARD' ? 'gói dịch vụ' : 'gói phí sàn'}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {currentPackages.map((pkg) => (
            <PackageCard
              key={pkg.id ?? pkg.name}
              pkg={pkg}
              onEdit={openEditDialog}
              onDelete={setDeletingPkg}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={!!editingPkg} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle>
              {editingPkg?.id ? `Chỉnh sửa: ${editingPkg.name}` : 'Thêm mới'}
            </DialogTitle>
            <DialogDescription>
              {form.category === 'PLATFORM_FEE'
                ? 'Cấu hình phí sàn theo chu kỳ thu.'
                : 'Cấu hình gói dịch vụ, hạn mức tài nguyên và tính năng.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-4 min-h-0">
            {/* Category selector (only for create) */}
            {!editingPkg?.id && (
              <div>
                <Label>Loại gói</Label>
                <div className="mt-1.5 flex gap-2">
                  {(['STANDARD', 'PLATFORM_FEE'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => updateForm('category', cat)}
                      className={cn(
                        'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                        form.category === cat
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-input text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {cat === 'STANDARD' ? '📦 Gói dịch vụ' : '💸 Phí sàn'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="pkg-name">Tên gói</Label>
              <Input
                id="pkg-name"
                type="text"
                className="mt-1.5"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder={form.category === 'PLATFORM_FEE' ? 'Ví dụ: Phí sàn tháng' : 'Ví dụ: Enterprise, Basic...'}
              />
            </div>

            <div>
              <Label htmlFor="pkg-price">Giá tiền (VND / tháng)</Label>
              <Input
                id="pkg-price"
                type="number"
                className="mt-1.5"
                value={form.price}
                onChange={(e) => updateForm('price', e.target.value)}
              />
            </div>

            {form.category === 'STANDARD' && (
              <>
                <div>
                  <Label htmlFor="pkg-ai-credits">AI Credits (mỗi tháng)</Label>
                  <Input
                    id="pkg-ai-credits"
                    type="number"
                    className="mt-1.5"
                    value={form.aiCredits}
                    onChange={(e) => updateForm('aiCredits', e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pkg-jobs">Số lượng tin đăng tuyển</Label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="unlimited-jobs"
                        checked={form.unlimitedJobs}
                        onChange={(e) => updateForm('unlimitedJobs', e.target.checked)}
                        className="size-3.5 cursor-pointer rounded border-input"
                      />
                      <Label htmlFor="unlimited-jobs" className="cursor-pointer select-none text-xs font-normal">
                        Không giới hạn
                      </Label>
                    </div>
                  </div>
                  {!form.unlimitedJobs && (
                    <Input
                      id="pkg-jobs"
                      type="number"
                      className="mt-1.5"
                      value={form.jobLimit}
                      onChange={(e) => updateForm('jobLimit', e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pkg-cvs">Số lượng CV tối đa</Label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="unlimited-cvs"
                        checked={form.unlimitedCvs}
                        onChange={(e) => updateForm('unlimitedCvs', e.target.checked)}
                        className="size-3.5 cursor-pointer rounded border-input"
                      />
                      <Label htmlFor="unlimited-cvs" className="cursor-pointer select-none text-xs font-normal">
                        Không giới hạn
                      </Label>
                    </div>
                  </div>
                  {!form.unlimitedCvs && (
                    <Input
                      id="pkg-cvs"
                      type="number"
                      className="mt-1.5"
                      value={form.cvLimit}
                      onChange={(e) => updateForm('cvLimit', e.target.value)}
                    />
                  )}
                </div>
              </>
            )}

            <div>
              <Label>Tính năng bổ sung</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="new-feature-input"
                  placeholder="Ví dụ: Hỗ trợ ưu tiên"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature() } }}
                />
                <Button type="button" onClick={handleAddFeature}>Thêm</Button>
              </div>
              <ul className="mt-2 max-h-36 overflow-y-auto space-y-1 rounded-md border border-input p-2 bg-muted/30">
                {form.features.length === 0 ? (
                  <span className="text-xs text-muted-foreground block text-center py-2">Chưa có tính năng nào</span>
                ) : (
                  form.features.map((feature, index) => (
                    <li key={index} className="flex items-center justify-between gap-2 rounded bg-background p-1.5 text-xs border border-border">
                      <span className="truncate flex-1">{feature}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(index)}
                        className="text-destructive hover:text-destructive/80 shrink-0 p-1"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {form.category === 'STANDARD' && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="pkg-featured"
                  checked={form.featured}
                  onChange={(e) => updateForm('featured', e.target.checked)}
                  className="size-4 cursor-pointer rounded border-input text-primary focus:ring-primary/20"
                />
                <Label htmlFor="pkg-featured" className="cursor-pointer select-none text-sm font-semibold">
                  Đặt làm gói nổi bật (Phổ biến nhất)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t border-border gap-2">
            <Button variant="outline" onClick={closeDialog}>Hủy</Button>
            <Button disabled={isSaving} onClick={handleSave}>
              {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {editingPkg?.id ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingPkg} onOpenChange={(open) => !open && setDeletingPkg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa gói</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa gói <span className="font-bold text-foreground">"{deletingPkg?.name}"</span>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingPkg(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
