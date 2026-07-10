import { createFileRoute, redirect } from '@tanstack/react-router'
import Cookies from 'js-cookie'
import { jwtDecode } from 'jwt-decode'
import { useAuthStore } from '@/store/auth'
import { AdminLayout } from '@/components/layouts/AdminLayout'

const ADMIN_COOKIE = 'smart_cv_a_token'

export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    const token = Cookies.get(ADMIN_COOKIE)
    if (!token) throw redirect({ to: '/signin' })

    let scope: string | undefined
    try {
      scope = jwtDecode<{ scope?: string }>(token).scope
    } catch {
      useAuthStore.getState().clearAuth()
      throw redirect({ to: '/signin' })
    }

    if (!scope?.includes('ROLE_ADMIN')) {
      useAuthStore.getState().clearAuth()
      throw redirect({ to: '/signin' })
    }
  },
  component: AdminLayout,
})
