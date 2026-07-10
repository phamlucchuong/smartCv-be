import { describe, expect, it } from 'vitest'
import {
  buildRecruiterProfilePayload,
  buildRecruiterRegistrationPayload,
  hasRecruiterRole,
  ensureRecruiterRole,
  extractAuthTokens,
  getRecruiterAccessState,
} from '../lib/recruiterAuth'

function createJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

describe('recruiterAuth', () => {
  it('extracts access and refresh tokens from the API envelope', () => {
    const tokens = extractAuthTokens({
      data: {
        token: 'access-token',
        refreshToken: 'refresh-token',
      },
    })

    expect(tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
  })

  it('throws when the login or verification response does not include tokens', () => {
    expect(() => extractAuthTokens({ data: { token: 'access-token' } })).toThrow(
      'Invalid token response',
    )
  })

  it('rejects tokens that are not for recruiters', () => {
    const candidateToken = createJwt({
      sub: 'u1',
      email: 'candidate@company.com',
      scope: 'ROLE_CANDIDATE',
    })

    expect(() => ensureRecruiterRole(candidateToken)).toThrow(
      'This account does not have recruiter access.',
    )
  })

  it('accepts recruiter tokens', () => {
    const recruiterToken = createJwt({
      sub: 'u1',
      email: 'hr@company.com',
      scope: 'ROLE_RECRUITER recruiter:write',
    })

    expect(() => ensureRecruiterRole(recruiterToken)).not.toThrow()
    expect(hasRecruiterRole(recruiterToken)).toBe(true)
  })

  it('treats malformed or non-recruiter tokens as invalid recruiter sessions', () => {
    const candidateToken = createJwt({
      sub: 'u1',
      email: 'candidate@company.com',
      scope: 'ROLE_CANDIDATE',
    })

    expect(hasRecruiterRole(candidateToken)).toBe(false)
    expect(hasRecruiterRole('not-a-jwt')).toBe(false)
  })

  it('builds registration payload without company name', () => {
    expect(
      buildRecruiterRegistrationPayload({
        fullname: 'Recruiter User',
        email: 'hr@company.com',
        phone: '0901234567',
        password: 'password123',
      }),
    ).toEqual({
      fullname: 'Recruiter User',
      email: 'hr@company.com',
      phone: '0901234567',
      password: 'password123',
      preferredVerification: 'EMAIL',
      role: 'RECRUITER',
    })
  })

  it('builds a draft recruiter profile payload from signup values', () => {
    expect(
      buildRecruiterProfilePayload({
        fullname: 'Recruiter User',
        email: 'hr@company.com',
        phone: '0901234567',
      }),
    ).toEqual({
      fullName: 'Recruiter User',
      email: 'hr@company.com',
      phone: '0901234567',
      contactName: 'Recruiter User',
      contactEmail: 'hr@company.com',
      contactPhone: '0901234567',
      status: 'DRAFT',
    })
  })

  it('classifies recruiter access state from recruiter status', () => {
    expect(getRecruiterAccessState(null)).toBe('missing')
    expect(getRecruiterAccessState({ status: 'DRAFT' })).toBe('draft')
    expect(getRecruiterAccessState({ status: 'PENDING' })).toBe('pending')
    expect(getRecruiterAccessState({ status: 'REJECTED' })).toBe('rejected')
    expect(getRecruiterAccessState({ status: 'APPROVED' })).toBe('approved')
  })
})
