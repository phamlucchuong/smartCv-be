import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(() => undefined),
    set: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(() => ({ sub: 'admin-1', email: 'admin@gmail.com', scope: 'ROLE_ADMIN' })),
}))

import Cookies from 'js-cookie'
import { useAuthStore } from './auth'

afterEach(() => {
  useAuthStore.setState({ user: null })
  vi.clearAllMocks()
})

describe('useAuthStore', () => {
  it('sets user state from decoded JWT on setAuth', () => {
    useAuthStore.getState().setAuth({ token: 'test-jwt', refreshToken: 'refresh-jwt' })

    expect(Cookies.set).toHaveBeenCalledWith('smart_cv_a_token', 'test-jwt', expect.any(Object))
    expect(Cookies.set).toHaveBeenCalledWith('smart_cv_a_refresh', 'refresh-jwt', expect.any(Object))
    expect(useAuthStore.getState().user?.id).toBe('admin-1')
    expect(useAuthStore.getState().user?.email).toBe('admin@gmail.com')
  })

  it('clears cookies and user state on clearAuth', () => {
    useAuthStore.setState({ user: { id: 'admin-1', email: 'admin@gmail.com' } })

    useAuthStore.getState().clearAuth()

    expect(Cookies.remove).toHaveBeenCalledWith('smart_cv_a_token', { path: '/' })
    expect(Cookies.remove).toHaveBeenCalledWith('smart_cv_a_refresh', { path: '/' })
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('returns null user when no cookie present', () => {
    expect(useAuthStore.getState().user).toBeNull()
  })
})
