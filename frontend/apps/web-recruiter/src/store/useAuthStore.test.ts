import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from './useAuthStore'

const initialState = useAuthStore.getState()

function createJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

afterEach(() => {
  useAuthStore.setState(initialState, true)
  document.cookie = 'smart_cv_r_token=; Max-Age=0; path=/'
  document.cookie = 'smart_cv_r_refresh=; Max-Age=0; path=/'
  vi.resetModules()
})

describe('useAuthStore', () => {
  it('stores cookies and decoded recruiter identity on sign in', () => {
    const accessToken = createJwt({
      sub: 'u1',
      email: 'hr@company.com',
      scope: 'ROLE_RECRUITER recruiter:write',
    })

    useAuthStore.getState().signIn(accessToken, 'refresh-token')

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.userId).toBe('u1')
    expect(state.email).toBe('hr@company.com')
    expect(state.role).toBe('ROLE_RECRUITER recruiter:write')
    expect(document.cookie).toContain('smart_cv_r_token=')
    expect(document.cookie).toContain('smart_cv_r_refresh=refresh-token')
  })

  it('clears cookies and auth state on sign out', () => {
    const accessToken = createJwt({
      sub: 'u1',
      email: 'hr@company.com',
      scope: 'ROLE_RECRUITER',
    })

    useAuthStore.getState().signIn(accessToken, 'refresh-token')
    useAuthStore.getState().signOut()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.userId).toBeNull()
    expect(state.email).toBeNull()
    expect(state.role).toBeNull()
  })

  it('does not bootstrap an authenticated recruiter session from a non-recruiter token', async () => {
    const candidateToken = createJwt({
      sub: 'u1',
      email: 'candidate@company.com',
      scope: 'ROLE_CANDIDATE',
    })

    document.cookie = `smart_cv_r_token=${candidateToken}; path=/`
    document.cookie = 'smart_cv_r_refresh=refresh-token; path=/'

    vi.resetModules()
    const { useAuthStore: reloadedStore } = await import('./useAuthStore')
    const state = reloadedStore.getState()

    expect(state.isAuthenticated).toBe(false)
    expect(state.role).toBeNull()
    expect(document.cookie).not.toContain('smart_cv_r_token=')
  })
})
