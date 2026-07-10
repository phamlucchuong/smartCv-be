import { create } from 'zustand'
import Cookies from 'js-cookie'
import { jwtDecode } from 'jwt-decode'

const ACCESS_COOKIE = 'smart_cv_a_token'
const REFRESH_COOKIE = 'smart_cv_a_refresh'

interface AuthUser {
  id: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  setAuth: (payload: { token: string; refreshToken: string }) => void
  clearAuth: () => void
}

interface JwtPayload {
  sub: string
  email?: string
  scope?: string
}

function decodeUser(token: string): AuthUser | null {
  try {
    const decoded = jwtDecode<JwtPayload>(token)
    return { id: decoded.sub, email: decoded.email ?? '' }
  } catch {
    return null
  }
}

function initUser(): AuthUser | null {
  const token = Cookies.get(ACCESS_COOKIE)
  if (!token) return null
  return decodeUser(token)
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: initUser(),

  setAuth: ({ token, refreshToken }) => {
    Cookies.set(ACCESS_COOKIE, token, { expires: 1, path: '/', sameSite: 'Lax' })
    Cookies.set(REFRESH_COOKIE, refreshToken, { expires: 1, path: '/', sameSite: 'Lax' })
    set({ user: decodeUser(token) })
  },

  clearAuth: () => {
    Cookies.remove(ACCESS_COOKIE, { path: '/' })
    Cookies.remove(REFRESH_COOKIE, { path: '/' })
    set({ user: null })
  },
}))
