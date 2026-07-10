import { describe, expect, it } from 'vitest'
import { getPrefixedUrl } from '../../../../packages/api/src/axios-instance'

describe('getPrefixedUrl', () => {
  it('rewrites recruiter profile requests to the user service gateway prefix', () => {
    expect(getPrefixedUrl('/api/recruiters/me')).toBe('/user/api/recruiters/me')
    expect(getPrefixedUrl('/api/recruiters/123')).toBe('/user/api/recruiters/123')
  })

  it('keeps already-prefixed gateway URLs unchanged', () => {
    expect(getPrefixedUrl('/user/api/recruiters/me')).toBe('/user/api/recruiters/me')
  })
})
