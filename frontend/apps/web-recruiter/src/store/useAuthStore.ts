import { create } from 'zustand'
import Cookies from 'js-cookie'
import { jwtDecode } from 'jwt-decode'
import { hasRecruiterRole } from '../lib/recruiterAuth'

const ACCESS_COOKIE = 'smart_cv_r_token'
const REFRESH_COOKIE = 'smart_cv_r_refresh'

interface JwtPayload {
  sub?: string
  email?: string
  scope?: string
  [key: string]: unknown
}

interface AuthState {
  userId: string | null
  email: string | null
  role: string | null
  fullName: string | null
  avatarUrl: string | null
  isAuthenticated: boolean
  signIn: (accessToken: string, refreshToken: string) => void
  signOut: () => void
  setFullName: (name: string) => void
  setAvatarUrl: (url: string | null) => void
}

function decodeJwt(token: string): Pick<AuthState, 'userId' | 'email' | 'role'> {
  try {
    const payload = jwtDecode<JwtPayload>(token)
    return {
      userId: payload.sub ?? null,
      email: payload.email ?? null,
      role: payload.scope ?? null,
    }
  } catch {
    return { userId: null, email: null, role: null }
  }
}

function initFromCookie(): Pick<AuthState, 'userId' | 'email' | 'role' | 'fullName' | 'avatarUrl' | 'isAuthenticated'> {
  const token = Cookies.get(ACCESS_COOKIE)
  if (!token || !hasRecruiterRole(token)) {
    Cookies.remove(ACCESS_COOKIE, { path: '/' })
    Cookies.remove(REFRESH_COOKIE, { path: '/' })
    return {
      userId: null,
      email: null,
      role: null,
      fullName: null,
      avatarUrl: null,
      isAuthenticated: false,
    }
  }

  return { ...decodeJwt(token), fullName: null, avatarUrl: null, isAuthenticated: true }
}

export const useAuthStore = create<AuthState>()((set) => ({
  ...initFromCookie(),

  signIn: (accessToken, refreshToken) => {
    Cookies.set(ACCESS_COOKIE, accessToken, { expires: 1, path: '/', sameSite: 'Lax' })
    Cookies.set(REFRESH_COOKIE, refreshToken, { expires: 1, path: '/', sameSite: 'Lax' })
    set({ ...decodeJwt(accessToken), fullName: null, avatarUrl: null, isAuthenticated: true })
  },

  signOut: () => {
    Cookies.remove(ACCESS_COOKIE, { path: '/' })
    Cookies.remove(REFRESH_COOKIE, { path: '/' })
    set({ userId: null, email: null, role: null, fullName: null, avatarUrl: null, isAuthenticated: false })
  },

  setFullName: (name) => set({ fullName: name }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
}))
