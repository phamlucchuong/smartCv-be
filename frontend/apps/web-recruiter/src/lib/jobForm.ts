export type CreateJobFormValues = {
  title: string
  description: string
  companyName: string
  location: string
  jobType: string
  category: string
  experienceLevel: string
  salaryMin: string
  salaryMax: string
  isNegotiable: boolean
  skills: string[]
  requirementsText: string
  benefitsText: string
  deadline: string
  openings: string
  qualifiedThreshold: number
  rejectThreshold: number
  autoRejectEnabled: boolean
  requiredTest: string
}

export type CreateJobFormErrors = Partial<
  Record<'title' | 'location' | 'jobType' | 'description' | 'experienceLevel', string>
>

export type CreateJobPayload = {
  title: string
  description: string
  company: string
  location: string
  jobType?: 'FULL_TIME' | 'PART_TIME' | 'REMOTE' | 'CONTRACT' | 'INTERNSHIP'
  category?: string
  experienceLevel?: 'INTERN' | 'JUNIOR' | 'MIDDLE' | 'SENIOR' | 'LEAD'
  salaryMin?: number
  salaryMax?: number
  skills: string[]
  requirements: string[]
  benefits: string[]
  deadline?: string
  openings?: number
  qualifiedThreshold: number
  rejectThreshold: number
  autoRejectEnabled: boolean
  requiredTest?: string
}

function splitMultiline(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toOptionalNumber(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function validateCreateJobStep(step: number, values: Pick<CreateJobFormValues, 'title' | 'location' | 'jobType' | 'description' | 'experienceLevel'>): CreateJobFormErrors {
  const errors: CreateJobFormErrors = {}

  if (step === 0) {
    if (!values.title.trim()) errors.title = 'Vui lòng nhập vị trí tuyển dụng'
    if (!values.location.trim()) errors.location = 'Vui lòng nhập địa điểm làm việc'
    if (!values.jobType.trim()) errors.jobType = 'Vui lòng chọn loại hình công việc'
  }

  if (step === 1) {
    if (!values.description.trim()) errors.description = 'Vui lòng nhập mô tả công việc'
    if (!values.experienceLevel.trim()) errors.experienceLevel = 'Vui lòng chọn mức kinh nghiệm'
  }

  return errors
}

export function validateDraftJob(values: Pick<CreateJobFormValues, 'title' | 'location' | 'jobType' | 'description' | 'experienceLevel'>): CreateJobFormErrors {
  const errors: CreateJobFormErrors = {}

  if (!values.title.trim()) {
    errors.title = 'Vui lòng nhập vị trí tuyển dụng'
  }

  return errors
}

export function buildCreateJobPayload(values: CreateJobFormValues): CreateJobPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    company: values.companyName.trim(),
    location: values.location.trim(),
    ...(values.jobType.trim()
      ? { jobType: values.jobType as NonNullable<CreateJobPayload['jobType']> }
      : {}),
    ...(values.category.trim()
      ? { category: values.category }
      : {}),
    ...(values.experienceLevel.trim()
      ? { experienceLevel: values.experienceLevel as NonNullable<CreateJobPayload['experienceLevel']> }
      : {}),
    salaryMin: values.isNegotiable ? undefined : toOptionalNumber(values.salaryMin),
    salaryMax: values.isNegotiable ? undefined : toOptionalNumber(values.salaryMax),
    skills: values.skills,
    requirements: splitMultiline(values.requirementsText),
    benefits: splitMultiline(values.benefitsText),
    deadline: values.deadline || undefined,
    openings: (() => { const n = toOptionalNumber(values.openings); return n != null && n > 0 ? n : undefined; })(),
    qualifiedThreshold: values.qualifiedThreshold,
    rejectThreshold: values.rejectThreshold,
    autoRejectEnabled: values.autoRejectEnabled,
    requiredTest: values.requiredTest === 'Không' ? undefined : values.requiredTest,
  }
}

export function getTomorrowDateInputValue(now = new Date()) {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
