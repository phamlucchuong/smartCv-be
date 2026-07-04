import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@smart-cv/ui'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customInstance } from '@smart-cv/api'
import { toast } from 'sonner'
import {
  Activity,
  AlertTriangle,
  Brain,
  Coins,
  Cpu,
  CreditCard,
  Globe,
  Key,
  Plus,
  Settings,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

export const Route = createFileRoute('/admin/ai-config')({ component: AIConfigPage })

type TimeRange = 'day' | 'week' | 'month' | 'year'
type ProviderKey = 'AZURE_OPENAI' | 'GEMINI' | 'GROQ' | 'LLAMA_3'

type ApiResponse<T> = {
  data?: T
  message?: string
}

type UsageItem = {
  date: string
  promptTokens: number
  completionTokens: number
  cost: number
}

type AIModelConfig = {
  id: string
  name: string
  provider: ProviderKey
  model: string
  baseUrl?: string
  deploymentName?: string
  apiVersion?: string
  active: boolean
  configured: boolean
  updatedAt?: string
}

type CreateModelPayload = {
  name: string
  provider: ProviderKey
  model: string
  apiKey?: string
  baseUrl?: string
  deploymentName?: string
  apiVersion?: string
}

const MODEL_QUERY_KEY = ['admin-ai-models']
const PROVIDER_OPTIONS: Array<{ value: ProviderKey; label: string }> = [
  { value: 'GROQ', label: 'Groq' },
  { value: 'GEMINI', label: 'Google Gemini' },
  { value: 'AZURE_OPENAI', label: 'Azure OpenAI' },
  { value: 'LLAMA_3', label: 'Llama 3' },
]

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  AZURE_OPENAI: 'Azure OpenAI',
  GEMINI: 'Google Gemini',
  GROQ: 'Groq',
  LLAMA_3: 'Llama 3',
}

const fetchAiUsageReport = async (timeframe: TimeRange) => {
  const res = await customInstance<ApiResponse<UsageItem[]>>({
    url: '/ai/api/ai/admin/usage-report',
    method: 'GET',
    params: { timeframe },
  })
  return res.data ?? []
}

const fetchAiModels = async () => {
  const res = await customInstance<ApiResponse<AIModelConfig[]>>({
    url: '/ai/api/ai/admin/models',
    method: 'GET',
  })
  return res.data ?? []
}

const createAiModel = async (payload: CreateModelPayload) => {
  const res = await customInstance<ApiResponse<AIModelConfig>>({
    url: '/ai/api/ai/admin/models',
    method: 'POST',
    data: payload,
  })
  return res.data
}

const activateAiModel = async (id: string) => {
  const res = await customInstance<ApiResponse<AIModelConfig>>({
    url: `/ai/api/ai/admin/models/${id}/activate`,
    method: 'PUT',
  })
  return res.data
}

const deleteAiModel = async (id: string) => {
  await customInstance<ApiResponse<void>>({
    url: `/ai/api/ai/admin/models/${id}`,
    method: 'DELETE',
  })
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const maybeResponse = error as { response?: { data?: { message?: string } } }
    return maybeResponse.response?.data?.message ?? fallback
  }
  return fallback
}

function maskConfiguredSecret() {
  return '••••••••••••••••'
}

function DeleteConfirmDialog({
  model,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  model: AIModelConfig
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-danger/10 p-2.5">
              <AlertTriangle className="size-6 text-danger" />
            </div>
            <div>
              <h3 id="delete-dialog-title" className="text-base font-semibold text-foreground">
                Xác nhận xóa model
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Hành động này không thể hoàn tác</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="mb-5 rounded-xl border border-border bg-muted/50 p-4">
            <p className="mb-2 text-sm text-muted-foreground">Model sẽ bị xóa:</p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-foreground">{model.name}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {PROVIDER_LABELS[model.provider]}
              </span>
            </div>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Bạn có chắc chắn muốn xóa <strong className="text-foreground">{model.name}</strong> không?
          </p>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isDeleting}>
              Hủy bỏ
            </Button>
            <Button
              className="flex-1 bg-danger text-white hover:bg-danger/90"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              <Trash2 className="mr-1.5 size-4" />
              {isDeleting ? 'Đang xóa...' : 'Xóa model'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AIConfigPage() {
  const queryClient = useQueryClient()
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const [newModelName, setNewModelName] = useState('')
  const [newModelProvider, setNewModelProvider] = useState<ProviderKey>('GROQ')
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [deploymentName, setDeploymentName] = useState('')
  const [apiVersion, setApiVersion] = useState('')

  const { data: usageData = [] } = useQuery({
    queryKey: ['admin-ai-usage', timeRange],
    queryFn: () => fetchAiUsageReport(timeRange),
    staleTime: 30 * 1000,
  })

  const { data: models = [], isLoading: isModelsLoading } = useQuery({
    queryKey: MODEL_QUERY_KEY,
    queryFn: fetchAiModels,
  })

  useEffect(() => {
    if (models.length === 0) {
      setSelectedModelId('')
      return
    }
    const stillExists = models.some((model) => model.id === selectedModelId)
    if (stillExists) return
    setSelectedModelId(models.find((model) => model.active)?.id ?? models[0].id)
  }, [models, selectedModelId])

  const createMutation = useMutation({
    mutationFn: createAiModel,
    onSuccess: (created) => {
      toast.success('Thêm model mới thành công')
      queryClient.invalidateQueries({ queryKey: MODEL_QUERY_KEY })
      setSelectedModelId(created?.id ?? '')
      setNewModelName('')
      setApiKey('')
      setEndpoint('')
      setDeploymentName('')
      setApiVersion('')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Không thể tạo model AI'))
    },
  })

  const activateMutation = useMutation({
    mutationFn: activateAiModel,
    onSuccess: () => {
      toast.success('Đã chuyển model hoạt động')
      queryClient.invalidateQueries({ queryKey: MODEL_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Không thể kích hoạt model'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAiModel,
    onSuccess: () => {
      toast.success('Đã xóa model')
      queryClient.invalidateQueries({ queryKey: MODEL_QUERY_KEY })
      setDeleteTargetId(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Không thể xóa model'))
    },
  })

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null
  const activeModel = models.find((model) => model.active) ?? null
  const deleteTarget = deleteTargetId ? models.find((model) => model.id === deleteTargetId) ?? null : null

  const totalPromptTokens = useMemo(
    () => usageData.reduce((sum, item) => sum + item.promptTokens, 0),
    [usageData]
  )
  const totalCompletionTokens = useMemo(
    () => usageData.reduce((sum, item) => sum + item.completionTokens, 0),
    [usageData]
  )
  const totalTokens = totalPromptTokens + totalCompletionTokens
  const totalCost = useMemo(() => usageData.reduce((sum, item) => sum + item.cost, 0), [usageData])
  const averageCost = usageData.length > 0 ? totalCost / usageData.length : 0

  const providerRequiresApiKey = newModelProvider !== 'LLAMA_3'
  const isAzureProvider = newModelProvider === 'AZURE_OPENAI'
  const isLlamaProvider = newModelProvider === 'LLAMA_3'

  const handleProviderChange = (provider: ProviderKey) => {
    setNewModelProvider(provider)
    setApiKey('')
    setEndpoint('')
    setDeploymentName('')
    setApiVersion('')
  }

  const handleAddModel = (e: FormEvent) => {
    e.preventDefault()

    if (!newModelName.trim()) {
      toast.error('Vui lòng nhập tên hiển thị')
      return
    }
    if (providerRequiresApiKey && !apiKey.trim()) {
      toast.error('Vui lòng cung cấp API key')
      return
    }
    if (isAzureProvider && (!endpoint.trim() || !deploymentName.trim() || !apiVersion.trim())) {
      toast.error('Azure OpenAI cần endpoint, deployment name và API version')
      return
    }

    createMutation.mutate({
      name: newModelName.trim(),
      provider: newModelProvider,
      model: newModelName.trim(),
      apiKey: apiKey.trim() || undefined,
      baseUrl: endpoint.trim() || undefined,
      deploymentName: deploymentName.trim() || undefined,
      apiVersion: apiVersion.trim() || undefined,
    })
  }

  const handleActivateSelectedModel = () => {
    if (!selectedModel) return
    if (selectedModel.active) {
      toast.info('Model này đang hoạt động')
      return
    }
    activateMutation.mutate(selectedModel.id)
  }

  const handleDeleteModel = (id: string) => {
    setDeleteTargetId(id)
  }

  return (
    <div className="w-full space-y-6 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Brain className="size-6 text-primary" /> Cấu hình AI
        </h1>
        <p className="text-sm text-muted-foreground">
          Quản lý model AI đang cấu hình thực tế trên hệ thống và thống kê sử dụng token.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-surface space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Plus className="size-5 text-primary" /> Thêm model mới
          </h2>

          <form onSubmit={handleAddModel} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Tên hiển thị</label>
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="Groq Fast, Gemini Main..."
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nhà cung cấp</label>
                <select
                  value={newModelProvider}
                  onChange={(e) => handleProviderChange(e.target.value as ProviderKey)}
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium"
                >
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>


            <div>
              <label className="text-sm font-medium">
                API Key {providerRequiresApiKey && <span className="text-danger">*</span>}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={isLlamaProvider ? 'Không bắt buộc nếu self-hosted' : 'Nhập API key'}
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
                />
                <Key className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {isAzureProvider && (
              <div className="space-y-4 border-t border-border/40 pt-2">
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Settings className="size-3.5" /> Azure OpenAI Settings
                </div>
                <div>
                  <label className="text-sm font-medium">Endpoint</label>
                  <input
                    type="url"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://your-resource.openai.azure.com/"
                    className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Deployment Name</label>
                    <input
                      type="text"
                      value={deploymentName}
                      onChange={(e) => setDeploymentName(e.target.value)}
                      placeholder="gpt-4o-deployment"
                      className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">API Version</label>
                    <input
                      type="text"
                      value={apiVersion}
                      onChange={(e) => setApiVersion(e.target.value)}
                      placeholder="2024-02-15-preview"
                      className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {isLlamaProvider && (
              <div>
                <label className="text-sm font-medium">Base URL / Endpoint</label>
                <div className="relative">
                  <input
                    type="url"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="mt-1.5 h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
                  />
                  <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo...' : 'Thêm model'}
            </Button>
          </form>
        </div>

        <div className="card-surface flex flex-col justify-between p-6">
          <div className="space-y-4">
            <h2 className="flex items-center justify-between text-lg font-semibold">
              <span className="flex items-center gap-2">
                <Cpu className="size-5 text-primary" /> Model đang cấu hình
              </span>
              {selectedModel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                  onClick={() => handleDeleteModel(selectedModel.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </h2>

            <div>
              <label className="text-sm font-medium">Danh sách model đã lưu</label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold"
                disabled={isModelsLoading || models.length === 0}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({PROVIDER_LABELS[model.provider]})
                  </option>
                ))}
              </select>
            </div>

            {selectedModel ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Tên hiển thị:</span>
                  <span className="font-semibold">{selectedModel.name}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-semibold">{PROVIDER_LABELS[selectedModel.provider]}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Model ID:</span>
                  <span className="font-mono text-xs">{selectedModel.model}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Credential:</span>
                  <span className="font-mono text-xs">{selectedModel.configured ? maskConfiguredSecret() : 'Chưa cấu hình'}</span>
                </div>
                {selectedModel.provider === 'AZURE_OPENAI' && (
                  <>
                    <div className="flex justify-between border-b border-border/60 pb-2">
                      <span className="text-muted-foreground">Endpoint:</span>
                      <span className="max-w-[220px] truncate font-mono text-xs" title={selectedModel.baseUrl}>
                        {selectedModel.baseUrl ?? '—'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-2">
                      <span className="text-muted-foreground">Deployment:</span>
                      <span className="font-semibold">{selectedModel.deploymentName ?? '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-2">
                      <span className="text-muted-foreground">API Version:</span>
                      <span className="font-semibold">{selectedModel.apiVersion ?? '—'}</span>
                    </div>
                  </>
                )}
                {selectedModel.provider === 'LLAMA_3' && (
                  <div className="flex justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Base URL:</span>
                    <span className="font-mono text-xs">{selectedModel.baseUrl ?? 'http://localhost:11434/v1'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      selectedModel.active
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {selectedModel.active ? 'Đang hoạt động' : 'Chưa kích hoạt'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                {isModelsLoading ? 'Đang tải danh sách model...' : 'Chưa có model nào được cấu hình.'}
              </div>
            )}
          </div>

          <div className="pt-4">
            <Button
              className="w-full"
              disabled={!selectedModel || selectedModel.active || activateMutation.isPending}
              onClick={handleActivateSelectedModel}
            >
              {activateMutation.isPending ? 'Đang chuyển model...' : `Kích hoạt ${selectedModel?.name ?? 'model'}`}
            </Button>
            {activeModel && (
              <p className="mt-2 text-xs text-muted-foreground">
                Model hoạt động hiện tại: <span className="font-semibold text-foreground">{activeModel.name}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-surface flex items-center gap-4 p-5">
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            <Activity className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tổng Token Đã Dùng</p>
            <h3 className="mt-1 text-2xl font-bold">{totalTokens.toLocaleString()}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Prompt: {totalPromptTokens.toLocaleString()} • Completion: {totalCompletionTokens.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="card-surface flex items-center gap-4 p-5">
          <div className="rounded-lg bg-success/10 p-3 text-success">
            <CreditCard className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tổng chi phí</p>
            <h3 className="mt-1 text-2xl font-bold text-success">${totalCost.toFixed(2)} USD</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Ước lượng theo thời gian đã chọn</p>
          </div>
        </div>

        <div className="card-surface flex items-center gap-4 p-5">
          <div className="rounded-lg bg-warning/10 p-3 text-warning">
            <Coins className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Chi phí trung bình</p>
            <h3 className="mt-1 text-2xl font-bold">${averageCost.toFixed(2)} / kỳ</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Tính theo số mốc trong bộ lọc</p>
          </div>
        </div>
      </div>

      <div className="card-surface space-y-4 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="size-5 text-primary" /> Biểu đồ mức sử dụng Token
            </h2>
            <p className="text-xs text-muted-foreground">Theo dõi lượng prompt và completion token tiêu thụ</p>
          </div>

          <div className="flex self-start rounded-lg border border-border bg-muted/60 p-1 sm:self-auto">
            {(['day', 'week', 'month', 'year'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  timeRange === range
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range === 'day' ? 'Ngày' : range === 'week' ? 'Tuần' : range === 'month' ? 'Tháng' : 'Năm'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={usageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="promptColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="completionColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="date" className="fill-muted-foreground text-xs" />
              <YAxis className="fill-muted-foreground text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Area
                name="Prompt Tokens"
                type="monotone"
                dataKey="promptTokens"
                stroke="#4f46e5"
                fillOpacity={1}
                fill="url(#promptColor)"
              />
              <Area
                name="Completion Tokens"
                type="monotone"
                dataKey="completionTokens"
                stroke="#06b6d4"
                fillOpacity={1}
                fill="url(#completionColor)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmDialog
          model={deleteTarget}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTargetId(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
