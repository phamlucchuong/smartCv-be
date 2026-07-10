import { jwtDecode } from 'jwt-decode'

interface JwtPayload {
  scope?: string
}

interface AuthEnvelope {
  data?: {
    token?: string
    refreshToken?: string
  }
}

interface RecruiterSignupValues {
  fullname: string
  email: string
  phone: string
  password?: string
}

interface RecruiterProfileSeed {
  fullname?: string | null
  fullName?: string | null
  email?: string | null
  phone?: string | null
}

interface RecruiterRecordLike {
  status?: string | null
}

interface ApiErrorLike {
  response?: {
    status?: number
  }
}

export type RecruiterAccessState =
  | 'missing'
  | 'draft'
  | 'pending'
  | 'rejected'
  | 'approved'

export function extractAuthTokens(result: AuthEnvelope) {
  const accessToken = result.data?.token
  const refreshToken = result.data?.refreshToken

  if (!accessToken || !refreshToken) {
    throw new Error('Invalid token response')
  }

  return { accessToken, refreshToken }
}

export function hasRecruiterRole(accessToken: string) {
  try {
    const payload = jwtDecode<JwtPayload>(accessToken)
    const scopes = payload.scope?.split(' ') ?? []
    return scopes.includes('ROLE_RECRUITER')
  } catch {
    return false
  }
}

export function isAuthError(error: unknown): boolean {
  const status = (error as ApiErrorLike | undefined)?.response?.status
  return status === 401
}

export function ensureRecruiterRole(accessToken: string) {
  if (!hasRecruiterRole(accessToken)) {
    throw new Error('This account does not have recruiter access.')
  }
}

export function buildRecruiterRegistrationPayload(values: RecruiterSignupValues) {
  return {
    fullname: values.fullname.trim(),
    email: values.email.trim(),
    password: values.password ?? '',
    phone: values.phone.trim(),
    preferredVerification: 'EMAIL' as const,
    role: 'RECRUITER',
  }
}

export function buildRecruiterProfilePayload(values: RecruiterProfileSeed) {
  const fullName = (values.fullName ?? values.fullname ?? '').trim()
  const email = (values.email ?? '').trim()
  const phone = (values.phone ?? '').trim()

  return {
    fullName,
    email,
    phone,
    contactName: fullName,
    contactEmail: email,
    contactPhone: phone,
    status: 'DRAFT' as const,
  }
}

export function getRecruiterAccessState(recruiter?: RecruiterRecordLike | null): RecruiterAccessState {
  if (!recruiter) {
    return 'missing'
  }

  switch (recruiter.status) {
    case 'APPROVED':
      return 'approved'
    case 'PENDING':
      return 'pending'
    case 'REJECTED':
      return 'rejected'
    case 'DRAFT':
    default:
      return 'draft'
  }
}
