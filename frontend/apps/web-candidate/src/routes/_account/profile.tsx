import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Button, Card, CardContent, Input } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { Briefcase, Camera, Eye, MapPin, Github, Linkedin, Globe } from 'lucide-react'
import { toast } from 'sonner'
import {
  useGetCandidateProfile, useUpdateCandidate, useUpdateUser, useUploadCandidateAvatar,
  useGetMyWishlists, useGetMyApplications,
  getCandidateProfileQueryKey, getGetCurrentUserQueryKey,
  UserModels,
} from '@smart-cv/api'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/useAuthStore'
import { usePreferencesStore } from '../../store/usePreferencesStore'

export const Route = createFileRoute('/_account/profile')({
  component: ProfilePage,
})

function toInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

// ── Date format helpers ──────────────────────────────────────────
// Parse "YYYY-MM-DD" and format to "Tháng M/YYYY" or "Month YYYY"
function formatMonthYear(dateStr: string | undefined, lang: string): string {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-')
  if (!year) return ''
  if (!month || month === '00') return year
  const MONTHS_SHORT = [
    { vi: 'Tháng 1', en: 'Jan' }, { vi: 'Tháng 2', en: 'Feb' },
    { vi: 'Tháng 3', en: 'Mar' }, { vi: 'Tháng 4', en: 'Apr' },
    { vi: 'Tháng 5', en: 'May' }, { vi: 'Tháng 6', en: 'Jun' },
    { vi: 'Tháng 7', en: 'Jul' }, { vi: 'Tháng 8', en: 'Aug' },
    { vi: 'Tháng 9', en: 'Sep' }, { vi: 'Tháng 10', en: 'Oct' },
    { vi: 'Tháng 11', en: 'Nov' }, { vi: 'Tháng 12', en: 'Dec' },
  ]
  const idx = parseInt(month, 10) - 1
  const label = MONTHS_SHORT[idx]
  if (!label) return year
  return lang === 'VI' ? `${label.vi} ${year}` : `${label.en} ${year}`
}

function formatExpDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  isCurrent: boolean | undefined,
  lang: string,
): string {
  const start = formatMonthYear(startDate, lang)
  const end = isCurrent
    ? (lang === 'VI' ? 'Hiện tại' : 'Present')
    : formatMonthYear(endDate, lang)
  if (!start && !end) return ''
  if (!end) return start
  if (!start) return end
  return `${start} – ${end}`
}

function formatEduDateRange(startYear: number | undefined, endYear: number | undefined, lang: string): string {
  if (!startYear && !endYear) return ''
  if (!endYear) return lang === 'VI' ? `${startYear} – Hiện tại` : `${startYear} – Present`
  if (!startYear) return String(endYear)
  return `${startYear} – ${endYear}`
}

type ExpForm = {
  title: string; company: string
  startMonth: string; startYear: string
  endMonth: string; endYear: string
  isCurrent: boolean; achievements: string[]
}
type EduForm = {
  school: string; degree: string
  startMonth: string; startYear: string
  endMonth: string; endYear: string
  isCurrent: boolean
}
type CertForm = {
  name: string; issuer: string
  issueMonth: string; issueYear: string
  credentialUrl: string
}

// ── Month data ──────────────────────────────────────────────────
const MONTHS = [
  { value: '01', vi: 'Tháng 1',  en: 'January' },
  { value: '02', vi: 'Tháng 2',  en: 'February' },
  { value: '03', vi: 'Tháng 3',  en: 'March' },
  { value: '04', vi: 'Tháng 4',  en: 'April' },
  { value: '05', vi: 'Tháng 5',  en: 'May' },
  { value: '06', vi: 'Tháng 6',  en: 'June' },
  { value: '07', vi: 'Tháng 7',  en: 'July' },
  { value: '08', vi: 'Tháng 8',  en: 'August' },
  { value: '09', vi: 'Tháng 9',  en: 'September' },
  { value: '10', vi: 'Tháng 10', en: 'October' },
  { value: '11', vi: 'Tháng 11', en: 'November' },
  { value: '12', vi: 'Tháng 12', en: 'December' },
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 30 }, (_, i) => String(CURRENT_YEAR - i))

// ── Custom scrollable select ──────────────────────────────────────
type ScrollSelectOption = { value: string; label: string }

function ScrollSelect({
  value, onChange, options, placeholder, disabled, error,
}: {
  value: string
  onChange: (v: string) => void
  options: ScrollSelectOption[]
  placeholder: string
  disabled?: boolean
  error?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [placement, setPlacement] = React.useState<'bottom' | 'top'>('bottom')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const buttonRef    = React.useRef<HTMLButtonElement>(null)
  const DROPDOWN_H   = 200 // px — approximate max height of open list
  const selected = options.find((o) => o.value === value)

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    if (disabled) return
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setPlacement(spaceBelow >= DROPDOWN_H || spaceBelow >= spaceAbove ? 'bottom' : 'top')
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`border-input bg-background flex h-9 w-full items-center justify-between rounded-md border pl-2 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/30'
        } ${error ? 'border-destructive focus:ring-2 focus:ring-destructive/40' : ''}`}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className={`border-border bg-popover absolute left-0 z-50 w-full rounded-md border shadow-lg ${
          placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          <ul className="max-h-48 overflow-y-auto py-1 text-sm" role="listbox">
            <li
              role="option"
              aria-selected={value === ''}
              onClick={() => { onChange(''); setOpen(false) }}
              className={`cursor-pointer px-3 py-1.5 text-muted-foreground hover:bg-muted/60 ${
                value === '' ? 'bg-muted/40 font-medium' : ''
              }`}
            >
              {placeholder}
            </li>
            {options.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={value === opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`cursor-pointer px-3 py-1.5 hover:bg-muted/60 ${
                  value === opt.value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                }`}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Reusable selects ─────────────────────────────────────────────
function MonthSelect({
  value, onChange, disabled, lang, error,
}: { value: string; onChange: (v: string) => void; disabled?: boolean; lang: string; error?: boolean }) {
  const placeholder = lang === 'VI' ? 'Tháng' : 'Month'
  const options = MONTHS.map((m) => ({ value: m.value, label: lang === 'VI' ? m.vi : m.en }))
  return <ScrollSelect value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} error={error} />
}

function YearSelect({
  value, onChange, disabled, lang, error,
}: { value: string; onChange: (v: string) => void; disabled?: boolean; lang: string; error?: boolean }) {
  const placeholder = lang === 'VI' ? 'Năm' : 'Year'
  const options = YEARS.map((y) => ({ value: y, label: y }))
  return <ScrollSelect value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} error={error} />
}

// ── DateRangeRow ─────────────────────────────────────────────────
function DateRangeRow({
  startMonth, startYear, endMonth, endYear, isCurrent,
  onStartMonth, onStartYear, onEndMonth, onEndYear, onCurrentChange,
  lang, startLabel, endLabel, currentLabel,
  startMonthError, startYearError, endMonthError, endYearError,
}: {
  startMonth: string; startYear: string; endMonth: string; endYear: string; isCurrent: boolean
  onStartMonth: (v: string) => void; onStartYear: (v: string) => void
  onEndMonth: (v: string) => void; onEndYear: (v: string) => void
  onCurrentChange: (v: boolean) => void
  lang: string; startLabel: string; endLabel: string; currentLabel: string
  startMonthError?: string; startYearError?: string; endMonthError?: string; endYearError?: string
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{startLabel}</p>
        <div className="grid grid-cols-2 gap-1">
          <MonthSelect value={startMonth} onChange={onStartMonth} lang={lang} error={!!startMonthError} />
          <YearSelect value={startYear} onChange={onStartYear} lang={lang} error={!!startYearError} />
        </div>
        {(startMonthError || startYearError) && (
          <p className="text-[10px] text-destructive leading-tight">{startMonthError || startYearError}</p>
        )}
      </div>

      <span className="pb-1 text-xs text-muted-foreground">→</span>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{endLabel}</p>
          <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => onCurrentChange(e.target.checked)}
              className="accent-primary"
            />
            {currentLabel}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <MonthSelect value={endMonth} onChange={onEndMonth} disabled={isCurrent} lang={lang} error={!!endMonthError} />
          <YearSelect value={endYear} onChange={onEndYear} disabled={isCurrent} lang={lang} error={!!endYearError} />
        </div>
        {!isCurrent && (endMonthError || endYearError) && (
          <p className="text-[10px] text-destructive leading-tight">{endMonthError || endYearError}</p>
        )}
      </div>
    </div>
  )
}

function buildCandidateRequest(p: UserModels.CandidateResponse): UserModels.CandidateRequest {
  return {
    address:           p.address,
    title:             p.title,
    bio:               p.bio,
    avatarUrl:         p.avatarUrl,
    skills:            p.skills ?? [],
    yearsOfExperience: p.yearsOfExperience,
    experiences:       p.experiences ?? [],
    educations:        p.educations ?? [],
    certifications:    p.certifications ?? [],
    languages:         p.languages ?? [],
    jobType:           p.jobType,
    preferredLocation: p.preferredLocation,
    expectedSalaryMin: p.expectedSalaryMin,
    expectedSalaryMax: p.expectedSalaryMax,
    portfolioUrl:      p.portfolioUrl,
    githubUrl:         p.githubUrl,
    linkedinUrl:       p.linkedinUrl,
  }
}

// ── Main page ────────────────────────────────────────────────────
function ProfilePage() {
  const { t } = useTranslation()
  const { isAuthenticated, userId, setAvatarUrl } = useAuthStore()
  const lang = usePreferencesStore((s) => s.language) // 'EN' | 'VI'
  const { data, isLoading, isError } = useGetCandidateProfile({ query: { enabled: isAuthenticated } })
  const profile = data?.data
  const candidateId = profile?.id

  const { data: wishlistsData } = useGetMyWishlists({ query: { enabled: isAuthenticated } })
  const { data: applicationsData } = useGetMyApplications(undefined, { query: { enabled: isAuthenticated } })
  
  const wishlistsCount = wishlistsData?.data?.length ?? 0
  const applicationsCount = applicationsData?.data?.items?.length ?? 0


  const queryClient = useQueryClient()
  const updateCandidateMutation = useUpdateCandidate()
  const updateUserMutation = useUpdateUser()
  const uploadAvatarMutation = useUploadCandidateAvatar()

  React.useEffect(() => { document.title = t('page_title_profile') }, [t])

  const fullName      = profile?.fullName    ?? ''
  const email         = profile?.email       ?? ''
  const phone         = profile?.phone       ?? ''
  const bio           = profile?.bio         ?? ''
  const title         = profile?.title       ?? ''
  const address       = profile?.address     ?? ''
  const linkedinUrl   = profile?.linkedinUrl  ?? ''
  const githubUrl     = profile?.githubUrl    ?? ''
  const portfolioUrl  = profile?.portfolioUrl ?? ''
  const experiences: UserModels.WorkExperience[] = profile?.experiences   ?? []
  const educations: UserModels.Education[]        = profile?.educations    ?? []
  const certifications: UserModels.Certification[] = profile?.certifications ?? []
  const initials   = toInitials(fullName)

  const [editMode, setEditMode] = React.useState(false)
  const [draft, setDraft] = React.useState({
    name: '', email: '', phone: '', location: '', title: '', bio: '',
    linkedinUrl: '', githubUrl: '', portfolioUrl: ''
  })

  const [editingExpId,  setEditingExpId]  = React.useState<string | null>(null)
  const [editingEduId,  setEditingEduId]  = React.useState<string | null>(null)
  const [editingCertId, setEditingCertId] = React.useState<string | null>(null)

  const [showAddExp, setShowAddExp] = React.useState(false)
  const [showAddEdu, setShowAddEdu] = React.useState(false)
  const [showAddCert, setShowAddCert] = React.useState(false)

  const [expForm, setExpForm] = React.useState<ExpForm>({
    title: '', company: '', startMonth: '', startYear: '', endMonth: '', endYear: '', isCurrent: false, achievements: [],
  })
  const [eduForm, setEduForm] = React.useState<EduForm>({
    school: '', degree: '', startMonth: '', startYear: '', endMonth: '', endYear: '', isCurrent: false,
  })
  const [certForm, setCertForm] = React.useState<CertForm>({
    name: '', issuer: '', issueMonth: '', issueYear: '', credentialUrl: '',
  })

  const [basicErrors, setBasicErrors] = React.useState<Record<string, string>>({})
  const [expErrors, setExpErrors] = React.useState<Record<string, string>>({})
  const [eduErrors, setEduErrors] = React.useState<Record<string, string>>({})
  const [certErrors, setCertErrors] = React.useState<Record<string, string>>({})

  const displayValues = {
    name: fullName,
    email,
    phone,
    location: address,
    title,
    linkedinUrl,
    githubUrl,
    portfolioUrl,
  }

  const handleEditClick = () => {
    setDraft({
      name: fullName,
      email,
      phone,
      location: address,
      title,
      bio,
      linkedinUrl,
      githubUrl,
      portfolioUrl,
    })
    setBasicErrors({})
    setEditMode(true)
  }

  const handleSave = () => {
    if (!profile || !candidateId || !userId) return
    const errors: Record<string, string> = {}
    if (!draft.name.trim()) errors.name = t('validation_required')
    if (!draft.location.trim()) errors.location = t('validation_required')
    if (Object.keys(errors).length > 0) {
      setBasicErrors(errors)
      return
    }
    Promise.all([
      updateCandidateMutation.mutateAsync({
        id: candidateId,
        data: {
          ...buildCandidateRequest(profile),
          address: draft.location,
          title: draft.title,
          bio: draft.bio,
          linkedinUrl: draft.linkedinUrl,
          githubUrl: draft.githubUrl,
          portfolioUrl: draft.portfolioUrl,
        },
      }),
      updateUserMutation.mutateAsync({ userId, data: { fullName: draft.name } }),
    ]).then(() => {
      queryClient.invalidateQueries({ queryKey: getCandidateProfileQueryKey() })
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
      setEditMode(false)
      toast.success(t('profile_saved') || 'Profile saved')
    }).catch(() => toast.error('Failed to save profile'))
  }

  const handleSaveExp = () => {
    if (!profile || !candidateId) return
    const errors: Record<string, string> = {}
    if (!expForm.title.trim()) errors.title = t('validation_required')
    if (!expForm.company.trim()) errors.company = t('validation_required')
    if (!expForm.startMonth) errors.startMonth = t('validation_required')
    if (!expForm.startYear) errors.startYear = t('validation_required')
    if (!expForm.isCurrent) {
      if (!expForm.endMonth) errors.endMonth = t('validation_required')
      if (!expForm.endYear) errors.endYear = t('validation_required')
    }
    if (Object.keys(errors).length > 0) {
      setExpErrors(errors)
      return
    }
    const newExp: UserModels.WorkExperience = {
      title:     expForm.title || undefined,
      company:   expForm.company || undefined,
      startDate: expForm.startYear ? `${expForm.startYear}-${expForm.startMonth || '01'}-01` : undefined,
      endDate:   expForm.isCurrent ? undefined : (expForm.endYear ? `${expForm.endYear}-${expForm.endMonth || '01'}-01` : undefined),
      current:   expForm.isCurrent,
      description: expForm.achievements.length ? expForm.achievements.join('\n') : undefined,
    }
    const updatedExps = editingExpId !== null
      ? experiences.map((e, i) => (String(i) === editingExpId ? newExp : e))
      : [...experiences, newExp]
    updateCandidateMutation.mutate(
      { id: candidateId, data: { ...buildCandidateRequest(profile), experiences: updatedExps } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getCandidateProfileQueryKey() }); resetExpForm(); toast.success('Experience saved') },
        onError: () => toast.error('Failed to save experience'),
      }
    )
  }

  const handleDeleteExp = (idx: number) => {
    if (!profile || !candidateId) return
    updateCandidateMutation.mutate(
      { id: candidateId, data: { ...buildCandidateRequest(profile), experiences: experiences.filter((_, i) => i !== idx) } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getCandidateProfileQueryKey() }); toast.success('Experience deleted') },
        onError: () => toast.error('Failed to delete experience'),
      }
    )
  }

  const handleSaveEdu = () => {
    if (!profile || !candidateId) return
    const errors: Record<string, string> = {}
    if (!eduForm.school.trim()) errors.school = t('validation_required')
    if (!eduForm.degree.trim()) errors.degree = t('validation_required')
    if (!eduForm.startYear) errors.startYear = t('validation_required')
    if (!eduForm.isCurrent && !eduForm.endYear) errors.endYear = t('validation_required')
    if (Object.keys(errors).length > 0) {
      setEduErrors(errors)
      return
    }
    const newEdu: UserModels.Education = {
      institution: eduForm.school || undefined,
      degree:      eduForm.degree || undefined,
      startYear:   Number(eduForm.startYear) || undefined,
      endYear:     eduForm.isCurrent ? undefined : (Number(eduForm.endYear) || undefined),
    }
    const updatedEdus = editingEduId !== null
      ? educations.map((e, i) => (String(i) === editingEduId ? newEdu : e))
      : [...educations, newEdu]
    updateCandidateMutation.mutate(
      { id: candidateId, data: { ...buildCandidateRequest(profile), educations: updatedEdus } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getCandidateProfileQueryKey() }); resetEduForm(); toast.success('Education saved') },
        onError: () => toast.error('Failed to save education'),
      }
    )
  }

  const handleDeleteEdu = (idx: number) => {
    if (!profile || !candidateId) return
    updateCandidateMutation.mutate(
      { id: candidateId, data: { ...buildCandidateRequest(profile), educations: educations.filter((_, i) => i !== idx) } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getCandidateProfileQueryKey() }); toast.success('Education deleted') },
        onError: () => toast.error('Failed to delete education'),
      }
    )
  }

  const handleSaveCert = () => {
    if (!profile || !candidateId) return
    const errors: Record<string, string> = {}
    if (!certForm.name.trim()) errors.name = t('validation_required')
    if (!certForm.issuer.trim()) errors.issuer = t('validation_required')
    if (!certForm.issueMonth) errors.issueMonth = t('validation_required')
    if (!certForm.issueYear) errors.issueYear = t('validation_required')
    if (Object.keys(errors).length > 0) {
      setCertErrors(errors)
      return
    }
    const newCert: UserModels.Certification = {
      name:          certForm.name || undefined,
      issuer:        certForm.issuer || undefined,
      issuedDate:    certForm.issueYear ? `${certForm.issueYear}-${certForm.issueMonth || '01'}-01` : undefined,
      credentialUrl: certForm.credentialUrl || undefined,
    }
    const updatedCerts = editingCertId !== null
      ? certifications.map((c, i) => (String(i) === editingCertId ? newCert : c))
      : [...certifications, newCert]
    updateCandidateMutation.mutate(
      { id: candidateId, data: { ...buildCandidateRequest(profile), certifications: updatedCerts } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getCandidateProfileQueryKey() }); resetCertForm(); toast.success('Certification saved') },
        onError: () => toast.error('Failed to save certification'),
      }
    )
  }

  const handleDeleteCert = (idx: number) => {
    if (!profile || !candidateId) return
    updateCandidateMutation.mutate(
      { id: candidateId, data: { ...buildCandidateRequest(profile), certifications: certifications.filter((_, i) => i !== idx) } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getCandidateProfileQueryKey() }); toast.success('Certification deleted') },
        onError: () => toast.error('Failed to delete certification'),
      }
    )
  }

  const avatarInputRef = React.useRef<HTMLInputElement>(null)

  const handleAvatarChange = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error(lang === 'VI' ? 'Chỉ hỗ trợ file ảnh (JPG, PNG, WEBP)' : 'Only image files are supported'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error(lang === 'VI' ? 'Ảnh phải nhỏ hơn 5MB' : 'Image must be smaller than 5MB'); return }

    const toastId = toast.loading(lang === 'VI' ? 'Đang tải ảnh lên...' : 'Uploading avatar...')

    uploadAvatarMutation.mutate(
      { data: { file } },
      {
        onSuccess: (res) => {
          const newUrl = res.data
          if (newUrl) {
            setAvatarUrl(newUrl)
            queryClient.invalidateQueries({ queryKey: getCandidateProfileQueryKey() })
            toast.success(lang === 'VI' ? 'Cập nhật ảnh đại diện thành công!' : 'Avatar updated successfully!', { id: toastId })
          } else {
            toast.error(lang === 'VI' ? 'Không nhận được URL ảnh mới.' : 'Failed to receive new avatar URL.', { id: toastId })
          }
        },
        onError: (err) => {
          console.error(err)
          toast.error(lang === 'VI' ? 'Tải ảnh lên thất bại.' : 'Failed to upload avatar.', { id: toastId })
        },
      }
    )
  }

  const displayAvatarUrl = profile?.avatarUrl ?? null

  const resetExpForm  = () => { setEditingExpId(null);  setShowAddExp(false);  setExpForm({ title: '', company: '', startMonth: '', startYear: '', endMonth: '', endYear: '', isCurrent: false, achievements: [] }); setExpErrors({}) }
  const resetEduForm  = () => { setEditingEduId(null);  setShowAddEdu(false);  setEduForm({ school: '', degree: '', startMonth: '', startYear: '', endMonth: '', endYear: '', isCurrent: false }); setEduErrors({}) }
  const resetCertForm = () => { setEditingCertId(null); setShowAddCert(false); setCertForm({ name: '', issuer: '', issueMonth: '', issueYear: '', credentialUrl: '' }); setCertErrors({}) }

  const basicInfoFields: [string, keyof typeof displayValues][] = [
    [t('profile_full_name'), 'name'],
    [t('profile_email'),     'email'],
    [t('profile_phone'),     'phone'],
    [t('profile_address'),   'location'],
    [t('profile_job_title'), 'title'],
    [t('profile_linkedin'),  'linkedinUrl'],
    [t('profile_github'),    'githubUrl'],
    [t('profile_portfolio'), 'portfolioUrl'],
  ]

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{lang === 'VI' ? 'Đang tải hồ sơ...' : 'Loading profile...'}</div>
  if (isError)   return <div className="p-8 text-center text-destructive">{lang === 'VI' ? 'Không thể tải hồ sơ.' : 'Failed to load profile.'}</div>

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

        {/* ─── Sidebar ─── */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="space-y-4 p-6">
            {/* Avatar upload */}
            <div className="relative w-fit">
              {displayAvatarUrl ? (
                <img
                  src={displayAvatarUrl}
                  alt={fullName}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">{initials}</div>
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:bg-primary/80"
                title={lang === 'VI' ? 'Thay ảnh đại diện' : 'Change avatar'}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{fullName}</h1>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{address}</p>
              {(linkedinUrl || githubUrl || portfolioUrl) && (
                <div className="mt-3 flex items-center gap-3">
                  {linkedinUrl && (
                    <a
                      href={linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="LinkedIn"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                  {githubUrl && (
                    <a
                      href={githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="GitHub"
                    >
                      <Github className="h-4 w-4" />
                    </a>
                  )}
                  {portfolioUrl && (
                    <a
                      href={portfolioUrl.startsWith('http') ? portfolioUrl : `https://${portfolioUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Portfolio"
                    >
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
            <hr className="border-border" />
            <div className="space-y-2 text-sm">
              <p className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" />{t('profile_applied')}</span><span className="font-semibold text-foreground">{applicationsCount}</span></p>
              <p className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-muted-foreground">♡ {t('profile_saved')}</span><span className="font-semibold text-foreground">{wishlistsCount}</span></p>
              <p className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-muted-foreground"><Eye className="h-4 w-4" />{t('profile_views')}</span><span className="font-semibold text-foreground">34</span></p>
            </div>
            <hr className="border-border" />
            {!editMode ? (
              <Button variant="outline" className="w-full" onClick={handleEditClick}>{t('profile_edit')}</Button>
            ) : (
              <div className="flex gap-2">
                <Button className="w-full" disabled={updateCandidateMutation.isPending || updateUserMutation.isPending} onClick={handleSave}>{t('profile_save')}</Button>
                <Button variant="outline" className="w-full" onClick={() => { setEditMode(false); setBasicErrors({}); }}>{t('profile_cancel')}</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">

          {/* ─── Basic Info ─── */}
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{t('profile_basic_info')}</h2>
              {basicInfoFields.map(([label, key]) => (
                <div key={key} className="flex items-start gap-3 border-b border-border py-2 text-sm last:border-0">
                  <span className="w-32 shrink-0 font-medium text-muted-foreground">{label}</span>
                  {editMode
                    ? (
                      <div className="flex-1">
                        <Input
                          value={draft[key as keyof typeof draft] as string}
                          onChange={(e) => {
                            setDraft((p) => ({ ...p, [key]: e.target.value }));
                            if (basicErrors[key]) setBasicErrors((errs) => ({ ...errs, [key]: '' }));
                          }}
                          readOnly={key === 'email' || key === 'phone'}
                          className={`${key === 'email' || key === 'phone' ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-80' : ''} ${
                            basicErrors[key] ? 'border-destructive focus-visible:ring-destructive' : ''
                          }`}
                        />
                        {basicErrors[key] && (
                          <p className="mt-1 text-xs text-destructive">{basicErrors[key]}</p>
                        )}
                      </div>
                    )
                    : (
                      key.endsWith('Url') && displayValues[key] ? (
                        <a
                          href={displayValues[key].startsWith('http') ? displayValues[key] : `https://${displayValues[key]}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {displayValues[key]}
                        </a>
                      ) : (
                        <span className="text-foreground">{displayValues[key]}</span>
                      )
                    )
                  }
                </div>
              ))}
              <div className="mt-3">
                <p className="mb-2 text-sm font-medium text-muted-foreground">{t('profile_bio')}</p>
                {editMode
                  ? <textarea className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm" value={draft.bio} onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))} />
                  : <p className="text-sm text-foreground">{bio}</p>
                }
              </div>
            </CardContent>
          </Card>

          {/* ─── Work Experience ─── */}
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{t('profile_work_exp')}</h2>
              {experiences.map((item, idx) => {
                const isEditingThis = editingExpId === String(idx);
                return (
                  <div key={idx} className="rounded-xl border border-border p-4">
                    {isEditingThis ? (
                      <div className="space-y-4">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <Input
                              value={expForm.title}
                              onChange={(e) => {
                                setExpForm((p) => ({ ...p, title: e.target.value }));
                                if (expErrors.title) setExpErrors((errs) => ({ ...errs, title: '' }));
                              }}
                              placeholder={t('profile_job_position')}
                              className={expErrors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            {expErrors.title && <p className="mt-1 text-xs text-destructive">{expErrors.title}</p>}
                          </div>
                          <div>
                            <Input
                              value={expForm.company}
                              onChange={(e) => {
                                setExpForm((p) => ({ ...p, company: e.target.value }));
                                if (expErrors.company) setExpErrors((errs) => ({ ...errs, company: '' }));
                              }}
                              placeholder={t('profile_company')}
                              className={expErrors.company ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            {expErrors.company && <p className="mt-1 text-xs text-destructive">{expErrors.company}</p>}
                          </div>
                        </div>
                        <DateRangeRow
                          startMonth={expForm.startMonth} startYear={expForm.startYear}
                          endMonth={expForm.endMonth}     endYear={expForm.endYear}
                          isCurrent={expForm.isCurrent}
                          onStartMonth={(v) => {
                            setExpForm((p) => ({ ...p, startMonth: v }));
                            if (expErrors.startMonth) setExpErrors((errs) => ({ ...errs, startMonth: '' }));
                          }}
                          onStartYear={(v)  => {
                            setExpForm((p) => ({ ...p, startYear:  v }));
                            if (expErrors.startYear) setExpErrors((errs) => ({ ...errs, startYear: '' }));
                          }}
                          onEndMonth={(v)   => {
                            setExpForm((p) => ({ ...p, endMonth:   v }));
                            if (expErrors.endMonth) setExpErrors((errs) => ({ ...errs, endMonth: '' }));
                          }}
                          onEndYear={(v)    => {
                            setExpForm((p) => ({ ...p, endYear:    v }));
                            if (expErrors.endYear) setExpErrors((errs) => ({ ...errs, endYear: '' }));
                          }}
                          onCurrentChange={(v) => {
                            setExpForm((p) => ({ ...p, isCurrent: v, endMonth: '', endYear: '' }));
                            setExpErrors((errs) => ({ ...errs, endMonth: '', endYear: '' }));
                          }}
                          lang={lang}
                          startLabel={t('profile_start')} endLabel={t('profile_end')} currentLabel={t('profile_current')}
                          startMonthError={expErrors.startMonth}
                          startYearError={expErrors.startYear}
                          endMonthError={expErrors.endMonth}
                          endYearError={expErrors.endYear}
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={updateCandidateMutation.isPending} onClick={handleSaveExp}>
                            {t('profile_save')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={resetExpForm}>{t('profile_cancel')}</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">{item.company}</p>
                          {(item.startDate || item.endDate || item.current) && (
                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                              {formatExpDateRange(item.startDate, item.endDate, item.current, lang)}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditingExpId(String(idx))
                            const startParts = item.startDate?.split('-') ?? []
                            const endParts   = item.endDate?.split('-')   ?? []
                            setExpForm({
                              title: item.title ?? '', company: item.company ?? '',
                              startMonth: startParts[1] ?? '', startYear: startParts[0] ?? '',
                              endMonth:   endParts[1]   ?? '', endYear:   endParts[0]   ?? '',
                              isCurrent: item.current ?? false, achievements: [],
                            })
                          }}>{t('profile_edit_btn')}</Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteExp(idx)}>{t('profile_delete_btn')}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {showAddExp ? (
                <div className="space-y-4 rounded-xl border border-border border-dashed p-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <Input
                        value={expForm.title}
                        onChange={(e) => {
                          setExpForm((p) => ({ ...p, title: e.target.value }));
                          if (expErrors.title) setExpErrors((errs) => ({ ...errs, title: '' }));
                        }}
                        placeholder={t('profile_job_position')}
                        className={expErrors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                      {expErrors.title && <p className="mt-1 text-xs text-destructive">{expErrors.title}</p>}
                    </div>
                    <div>
                      <Input
                        value={expForm.company}
                        onChange={(e) => {
                          setExpForm((p) => ({ ...p, company: e.target.value }));
                          if (expErrors.company) setExpErrors((errs) => ({ ...errs, company: '' }));
                        }}
                        placeholder={t('profile_company')}
                        className={expErrors.company ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                      {expErrors.company && <p className="mt-1 text-xs text-destructive">{expErrors.company}</p>}
                    </div>
                  </div>
                  <DateRangeRow
                    startMonth={expForm.startMonth} startYear={expForm.startYear}
                    endMonth={expForm.endMonth}     endYear={expForm.endYear}
                    isCurrent={expForm.isCurrent}
                    onStartMonth={(v) => {
                      setExpForm((p) => ({ ...p, startMonth: v }));
                      if (expErrors.startMonth) setExpErrors((errs) => ({ ...errs, startMonth: '' }));
                    }}
                    onStartYear={(v)  => {
                      setExpForm((p) => ({ ...p, startYear:  v }));
                      if (expErrors.startYear) setExpErrors((errs) => ({ ...errs, startYear: '' }));
                    }}
                    onEndMonth={(v)   => {
                      setExpForm((p) => ({ ...p, endMonth:   v }));
                      if (expErrors.endMonth) setExpErrors((errs) => ({ ...errs, endMonth: '' }));
                    }}
                    onEndYear={(v)    => {
                      setExpForm((p) => ({ ...p, endYear:    v }));
                      if (expErrors.endYear) setExpErrors((errs) => ({ ...errs, endYear: '' }));
                    }}
                    onCurrentChange={(v) => {
                      setExpForm((p) => ({ ...p, isCurrent: v, endMonth: '', endYear: '' }));
                      setExpErrors((errs) => ({ ...errs, endMonth: '', endYear: '' }));
                    }}
                    lang={lang}
                    startLabel={t('profile_start')} endLabel={t('profile_end')} currentLabel={t('profile_current')}
                    startMonthError={expErrors.startMonth}
                    startYearError={expErrors.startYear}
                    endMonthError={expErrors.endMonth}
                    endYearError={expErrors.endYear}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={updateCandidateMutation.isPending} onClick={handleSaveExp}>
                      {t('profile_save')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetExpForm}>{t('profile_cancel')}</Button>
                  </div>
                </div>
              ) : (
                editingExpId === null && (
                  <Button variant="outline" size="sm" className="w-full border-dashed py-5 hover:bg-accent/40 text-muted-foreground hover:text-foreground flex items-center justify-center gap-2" onClick={() => setShowAddExp(true)}>
                    + {t('profile_add_exp')}
                  </Button>
                )
              )}
            </CardContent>
          </Card>

          {/* ─── Education ─── */}
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{t('profile_education')}</h2>
              {educations.map((item, idx) => {
                const isEditingThis = editingEduId === String(idx);
                return (
                  <div key={idx} className="rounded-xl border border-border p-4">
                    {isEditingThis ? (
                      <div className="space-y-4">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <Input
                              value={eduForm.school}
                              onChange={(e) => {
                                setEduForm((p) => ({ ...p, school: e.target.value }));
                                if (eduErrors.school) setEduErrors((errs) => ({ ...errs, school: '' }));
                              }}
                              placeholder={t('profile_school')}
                              className={eduErrors.school ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            {eduErrors.school && <p className="mt-1 text-xs text-destructive">{eduErrors.school}</p>}
                          </div>
                          <div>
                            <Input
                              value={eduForm.degree}
                              onChange={(e) => {
                                setEduForm((p) => ({ ...p, degree: e.target.value }));
                                if (eduErrors.degree) setEduErrors((errs) => ({ ...errs, degree: '' }));
                              }}
                              placeholder={t('profile_degree')}
                              className={eduErrors.degree ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            {eduErrors.degree && <p className="mt-1 text-xs text-destructive">{eduErrors.degree}</p>}
                          </div>
                        </div>
                        <DateRangeRow
                          startMonth={eduForm.startMonth} startYear={eduForm.startYear}
                          endMonth={eduForm.endMonth}     endYear={eduForm.endYear}
                          isCurrent={eduForm.isCurrent}
                          onStartMonth={(v) => setEduForm((p) => ({ ...p, startMonth: v }))}
                          onStartYear={(v)  => {
                            setEduForm((p) => ({ ...p, startYear:  v }));
                            if (eduErrors.startYear) setEduErrors((errs) => ({ ...errs, startYear: '' }));
                          }}
                          onEndMonth={(v)   => setEduForm((p) => ({ ...p, endMonth:   v }))}
                          onEndYear={(v)    => {
                            setEduForm((p) => ({ ...p, endYear:    v }));
                            if (eduErrors.endYear) setEduErrors((errs) => ({ ...errs, endYear: '' }));
                          }}
                          onCurrentChange={(v) => {
                            setEduForm((p) => ({ ...p, isCurrent: v, endMonth: '', endYear: '' }));
                            setEduErrors((errs) => ({ ...errs, endYear: '' }));
                          }}
                          lang={lang}
                          startLabel={t('profile_start')} endLabel={t('profile_end')} currentLabel={t('profile_current')}
                          startYearError={eduErrors.startYear}
                          endYearError={eduErrors.endYear}
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={updateCandidateMutation.isPending} onClick={handleSaveEdu}>
                            {t('profile_save')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={resetEduForm}>{t('profile_cancel')}</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{item.institution}</p>
                          <p className="text-sm text-muted-foreground">{item.degree}</p>
                          {(item.startYear || item.endYear) && (
                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                              {formatEduDateRange(item.startYear, item.endYear, lang)}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditingEduId(String(idx))
                            setEduForm({
                              school: item.institution ?? '', degree: item.degree ?? '',
                              startMonth: '', startYear: item.startYear ? String(item.startYear) : '',
                              endMonth:   '', endYear:   item.endYear   ? String(item.endYear)   : '',
                              isCurrent: !item.endYear,
                            })
                          }}>{t('profile_edit_btn')}</Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteEdu(idx)}>{t('profile_delete_btn')}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {showAddEdu ? (
                <div className="space-y-4 rounded-xl border border-border border-dashed p-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <Input
                        value={eduForm.school}
                        onChange={(e) => {
                          setEduForm((p) => ({ ...p, school: e.target.value }));
                          if (eduErrors.school) setEduErrors((errs) => ({ ...errs, school: '' }));
                        }}
                        placeholder={t('profile_school')}
                        className={eduErrors.school ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                      {eduErrors.school && <p className="mt-1 text-xs text-destructive">{eduErrors.school}</p>}
                    </div>
                    <div>
                      <Input
                        value={eduForm.degree}
                        onChange={(e) => {
                          setEduForm((p) => ({ ...p, degree: e.target.value }));
                          if (eduErrors.degree) setEduErrors((errs) => ({ ...errs, degree: '' }));
                        }}
                        placeholder={t('profile_degree')}
                        className={eduErrors.degree ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                      {eduErrors.degree && <p className="mt-1 text-xs text-destructive">{eduErrors.degree}</p>}
                    </div>
                  </div>
                  <DateRangeRow
                    startMonth={eduForm.startMonth} startYear={eduForm.startYear}
                    endMonth={eduForm.endMonth}     endYear={eduForm.endYear}
                    isCurrent={eduForm.isCurrent}
                    onStartMonth={(v) => setEduForm((p) => ({ ...p, startMonth: v }))}
                    onStartYear={(v)  => {
                      setEduForm((p) => ({ ...p, startYear:  v }));
                      if (eduErrors.startYear) setEduErrors((errs) => ({ ...errs, startYear: '' }));
                    }}
                    onEndMonth={(v)   => setEduForm((p) => ({ ...p, endMonth:   v }))}
                    onEndYear={(v)    => {
                      setEduForm((p) => ({ ...p, endYear:    v }));
                      if (eduErrors.endYear) setEduErrors((errs) => ({ ...errs, endYear: '' }));
                    }}
                    onCurrentChange={(v) => {
                      setEduForm((p) => ({ ...p, isCurrent: v, endMonth: '', endYear: '' }));
                      setEduErrors((errs) => ({ ...errs, endYear: '' }));
                    }}
                    lang={lang}
                    startLabel={t('profile_start')} endLabel={t('profile_end')} currentLabel={t('profile_current')}
                    startYearError={eduErrors.startYear}
                    endYearError={eduErrors.endYear}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={updateCandidateMutation.isPending} onClick={handleSaveEdu}>
                      {t('profile_save')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetEduForm}>{t('profile_cancel')}</Button>
                  </div>
                </div>
              ) : (
                editingEduId === null && (
                  <Button variant="outline" size="sm" className="w-full border-dashed py-5 hover:bg-accent/40 text-muted-foreground hover:text-foreground flex items-center justify-center gap-2" onClick={() => setShowAddEdu(true)}>
                    + {t('profile_add_edu')}
                  </Button>
                )
              )}
            </CardContent>
          </Card>

          {/* ─── Certifications ─── */}
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{t('profile_certifications')}</h2>
              {certifications.map((item, idx) => {
                const isEditingThis = editingCertId === String(idx);
                return (
                  <div key={idx} className="rounded-xl border border-border p-4">
                    {isEditingThis ? (
                      <div className="space-y-4">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <Input
                              value={certForm.name}
                              onChange={(e) => {
                                setCertForm((p) => ({ ...p, name: e.target.value }));
                                if (certErrors.name) setCertErrors((errs) => ({ ...errs, name: '' }));
                              }}
                              placeholder={t('profile_cert_name')}
                              className={certErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            {certErrors.name && <p className="mt-1 text-xs text-destructive">{certErrors.name}</p>}
                          </div>
                          <div>
                            <Input
                              value={certForm.issuer}
                              onChange={(e) => {
                                setCertForm((p) => ({ ...p, issuer: e.target.value }));
                                if (certErrors.issuer) setCertErrors((errs) => ({ ...errs, issuer: '' }));
                              }}
                              placeholder={t('profile_cert_issuer')}
                              className={certErrors.issuer ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            {certErrors.issuer && <p className="mt-1 text-xs text-destructive">{certErrors.issuer}</p>}
                          </div>
                          <div className="md:col-span-2">
                            <Input value={certForm.credentialUrl} onChange={(e) => setCertForm((p) => ({ ...p, credentialUrl: e.target.value }))} placeholder={t('profile_cert_url')} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">{t('profile_cert_issue_date')}</p>
                          <div className="grid grid-cols-2 gap-2 md:w-1/2">
                            <div>
                              <MonthSelect
                                value={certForm.issueMonth}
                                onChange={(v) => {
                                  setCertForm((p) => ({ ...p, issueMonth: v }));
                                  if (certErrors.issueMonth) setCertErrors((errs) => ({ ...errs, issueMonth: '' }));
                                }}
                                lang={lang}
                                error={!!certErrors.issueMonth}
                              />
                            </div>
                            <div>
                              <YearSelect
                                value={certForm.issueYear}
                                onChange={(v) => {
                                  setCertForm((p) => ({ ...p, issueYear: v }));
                                  if (certErrors.issueYear) setCertErrors((errs) => ({ ...errs, issueYear: '' }));
                                }}
                                lang={lang}
                                error={!!certErrors.issueYear}
                              />
                            </div>
                          </div>
                          {(certErrors.issueMonth || certErrors.issueYear) && (
                            <p className="text-[10px] text-destructive leading-tight">{certErrors.issueMonth || certErrors.issueYear}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={updateCandidateMutation.isPending} onClick={handleSaveCert}>
                            {t('profile_save')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={resetCertForm}>{t('profile_cancel')}</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.issuer}</p>
                          {item.issuedDate && (
                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                              {formatMonthYear(item.issuedDate, lang)}
                            </p>
                          )}
                          {item.credentialUrl && (
                            <a href={item.credentialUrl} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-primary hover:underline">
                              {item.credentialUrl}
                            </a>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditingCertId(String(idx))
                            const parts = item.issuedDate?.split('-') ?? []
                            setCertForm({
                              name: item.name ?? '', issuer: item.issuer ?? '',
                              issueMonth: parts[1] ?? '', issueYear: parts[0] ?? '',
                              credentialUrl: item.credentialUrl ?? '',
                            })
                          }}>{t('profile_edit_btn')}</Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteCert(idx)}>{t('profile_delete_btn')}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {showAddCert ? (
                <div className="space-y-4 rounded-xl border border-border border-dashed p-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <Input
                        value={certForm.name}
                        onChange={(e) => {
                          setCertForm((p) => ({ ...p, name: e.target.value }));
                          if (certErrors.name) setCertErrors((errs) => ({ ...errs, name: '' }));
                        }}
                        placeholder={t('profile_cert_name')}
                        className={certErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                      {certErrors.name && <p className="mt-1 text-xs text-destructive">{certErrors.name}</p>}
                    </div>
                    <div>
                      <Input
                        value={certForm.issuer}
                        onChange={(e) => {
                          setCertForm((p) => ({ ...p, issuer: e.target.value }));
                          if (certErrors.issuer) setCertErrors((errs) => ({ ...errs, issuer: '' }));
                        }}
                        placeholder={t('profile_cert_issuer')}
                        className={certErrors.issuer ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                      {certErrors.issuer && <p className="mt-1 text-xs text-destructive">{certErrors.issuer}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <Input value={certForm.credentialUrl} onChange={(e) => setCertForm((p) => ({ ...p, credentialUrl: e.target.value }))} placeholder={t('profile_cert_url')} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{t('profile_cert_issue_date')}</p>
                    <div className="grid grid-cols-2 gap-2 md:w-1/2">
                      <div>
                        <MonthSelect
                          value={certForm.issueMonth}
                          onChange={(v) => {
                            setCertForm((p) => ({ ...p, issueMonth: v }));
                            if (certErrors.issueMonth) setCertErrors((errs) => ({ ...errs, issueMonth: '' }));
                          }}
                          lang={lang}
                          error={!!certErrors.issueMonth}
                        />
                      </div>
                      <div>
                        <YearSelect
                          value={certForm.issueYear}
                          onChange={(v) => {
                            setCertForm((p) => ({ ...p, issueYear: v }));
                            if (certErrors.issueYear) setCertErrors((errs) => ({ ...errs, issueYear: '' }));
                          }}
                          lang={lang}
                          error={!!certErrors.issueYear}
                        />
                      </div>
                    </div>
                    {(certErrors.issueMonth || certErrors.issueYear) && (
                      <p className="text-[10px] text-destructive leading-tight">{certErrors.issueMonth || certErrors.issueYear}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={updateCandidateMutation.isPending} onClick={handleSaveCert}>
                      {t('profile_save')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetCertForm}>{t('profile_cancel')}</Button>
                  </div>
                </div>
              ) : (
                editingCertId === null && (
                  <Button variant="outline" size="sm" className="w-full border-dashed py-5 hover:bg-accent/40 text-muted-foreground hover:text-foreground flex items-center justify-center gap-2" onClick={() => setShowAddCert(true)}>
                    + {t('profile_add_cert')}
                  </Button>
                )
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
