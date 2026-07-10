import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { Button } from '@smart-cv/ui'
import { Lock, Mail, Sparkles, Eye, EyeOff } from 'lucide-react'
import { useLoginCandidate } from '@smart-cv/api'
import Cookies from 'js-cookie'
import { jwtDecode } from 'jwt-decode'
import { useAuthStore } from '@/store/auth'
import { useTranslation } from '@smart-cv/i18n'

export const Route = createFileRoute('/signin')({
  beforeLoad: () => {
    const token = Cookies.get('smart_cv_a_token')
    if (!token) return
    try {
      const { scope } = jwtDecode<{ scope?: string }>(token)
      if (scope?.includes('ROLE_ADMIN')) throw redirect({ to: '/admin' })
    } catch (e) {
      if ((e as { isRedirect?: boolean })?.isRedirect) throw e
    }
  },
  component: SigninPage,
})

function SigninPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { t } = useTranslation()
  const loginMutation = useLoginCandidate()
  const [error, setError] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await loginMutation.mutateAsync({
        data: {
          email: fd.get('email') as string,
          password: fd.get('password') as string,
        },
      })
      const token = res.data?.token ?? ''
      const refreshToken = res.data?.refreshToken ?? ''
      if (!token) throw new Error('No token received')
      setAuth({ token, refreshToken })
      navigate({ to: '/admin' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Invalid credentials. Please try again.')
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="px-6 lg:px-16 py-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Sparkles className="size-4" /></div>
          <span className="font-bold text-lg">SmartCV Admin</span>
        </Link>

        <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-20 space-y-4">
          <h1 className="text-3xl font-bold">{t('admin_signin_title')}</h1>
          <div>
            <label className="text-sm font-medium">{t('email')}</label>
            <div className="relative mt-1.5">
              <Mail className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input name="email" type="email" className="h-11 w-full rounded-md border border-input pl-9 pr-3 text-sm" defaultValue="admin@gmail.com" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('password')}</label>
              <a className="text-xs text-primary">{t('admin_forgot_password')}</a>
            </div>
            <div className="relative mt-1.5">
              <Lock className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="h-11 w-full rounded-md border border-input pl-9 pr-10 text-sm"
                defaultValue="admin123"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loginMutation.isPending} className="w-full h-11">
            {loginMutation.isPending ? 'Signing in…' : t('login')}
          </Button>
        </form>
      </div>
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-primary via-blue-600 to-violet-600 text-white p-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold">{t('admin_signin_visual_title')}</h2>
          <p className="mt-2 opacity-90">{t('admin_signin_visual_desc')}</p>
        </div>
      </div>
    </div>
  )
}
