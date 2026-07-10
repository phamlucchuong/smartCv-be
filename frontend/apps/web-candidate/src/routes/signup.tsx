import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input } from '@smart-cv/ui'
import { ArrowRight, Lock, Mail, Phone, Sparkles, UserRound, Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { useTranslation } from '@smart-cv/i18n'
import { jwtDecode } from 'jwt-decode'
import { toast } from 'sonner'
import { useRegisterCandidate, useAuthenticateWithGoogle } from '@smart-cv/api'

import { hasCandidateRole, useAuthStore } from '../store/useAuthStore'
import { OtpVerificationForm } from '../components/OtpVerificationForm'

interface JwtPayload {
  scope?: string
}

type GoogleAccounts = {
  id: {
    initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void
    renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
  }
}

function loadGoogleIdentityScript() {
  return new Promise<void>((resolve, reject) => {
    const googleWindow = window as Window & { google?: { accounts?: GoogleAccounts } }
    if (googleWindow.google?.accounts?.id) {
      resolve()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity script')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity script'))
    document.head.appendChild(script)
  })
}

export const Route = createFileRoute('/signup')({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) throw redirect({ to: '/' })
  },
  component: SignUpComponent,
})



function SignUpComponent() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const signIn = useAuthStore((s) => s.signIn)

  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [otpOpen, setOtpOpen] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Google Login configuration
  const googleButtonRef = React.useRef<HTMLDivElement | null>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  const googleLogin = useAuthenticateWithGoogle()

  React.useEffect(() => {
    if (otpOpen || !googleClientId || !googleButtonRef.current) return

    let cancelled = false
    loadGoogleIdentityScript()
      .then(() => {
        const googleWindow = window as Window & { google?: { accounts?: GoogleAccounts } }
        const googleAccounts = googleWindow.google?.accounts
        if (cancelled || !googleAccounts || !googleButtonRef.current) return

        googleButtonRef.current.innerHTML = ''
        googleAccounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            if (!credential) {
              toast.error('Google sign-in failed. Please try again.')
              return
            }
            try {
              const result = await googleLogin.mutateAsync({
                data: { idToken: credential, role: 'CANDIDATE' },
              })
              const accessToken = result.data?.token
              const refreshToken = result.data?.refreshToken
              if (!accessToken || !refreshToken) throw new Error('Invalid token response')
              const payload = jwtDecode<JwtPayload>(accessToken)
              if (!hasCandidateRole(payload.scope)) {
                throw new Error('This account does not have candidate access.')
              }
              signIn(accessToken, refreshToken)
              toast.success(t('login'))
              navigate({ to: '/' })
            } catch (err: unknown) {
              const e = err as { response?: { data?: { message?: string } }; message?: string }
              toast.error(e?.response?.data?.message ?? e?.message ?? 'Google sign-in failed.')
            }
          },
        })
        googleAccounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          width: 320,
        })
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t('google_signin_unavailable'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [googleClientId, googleLogin, navigate, otpOpen, signIn, t])

  const [fromSignin] = React.useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('auth_prev_route') === '/signin',
  )

  React.useEffect(() => {
    document.title = t('page_title_signup')
    sessionStorage.setItem('auth_prev_route', '/signup')
  }, [t])

  function openOtpPanel() {
    setOtpOpen(true)
  }

  const register = useRegisterCandidate()

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Full name is required'
    if (!email.trim()) e.email = 'Email is required'
    if (!phone.trim()) e.phone = 'Phone number is required'
    if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (password !== confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      await register.mutateAsync({
        data: {
          fullname: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          preferredVerification: 'EMAIL', // initial default
          role: 'CANDIDATE',
        },
      })
      openOtpPanel()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: number; message?: string } } }
      const code = e?.response?.data?.code
      if (code === 3003) {
        openOtpPanel()
      } else if (code === 3001) {
        setErrors((prev) => ({ ...prev, email: 'Email already registered' }))
      } else {
        toast.error(e?.response?.data?.message ?? 'Registration failed. Please try again.')
      }
    }
  }

  function handleOtpSuccess() {
    setOtpOpen(false)
    toast.success('Account verified! Please log in.')
    navigate({ to: '/signin' })
  }

  return (
    <>

      <section className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 md:grid-cols-2 md:px-6">
        <Link to="/" className="absolute left-4 top-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors z-10">
          <ChevronLeft className="h-4 w-4" />
          {t('candidate_back_to_home')}
        </Link>
        <div className={`flex h-full items-center justify-center ${fromSignin ? 'auth-swap-to-left' : ''}`}>
          <Card className="w-full card-surface">
              <CardHeader className="text-left">
                <CardTitle className="text-2xl">{otpOpen ? 'Verify your account' : t('signup_title')}</CardTitle>
                <CardDescription>
                  {otpOpen
                    ? 'Confirm your details to activate your account.'
                    : 'Start applying jobs in minutes with your SmartCV profile.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {otpOpen ? (
                  <OtpVerificationForm
                    email={email}
                    phone={phone}
                    onSuccess={handleOtpSuccess}
                    onClose={() => setOtpOpen(false)}
                  />
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <div className="relative">
                        <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('full_name')} className="h-10 border-input bg-background pl-9" />
                      </div>
                      {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
                    </div>
                    <div>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} className="h-10 border-input bg-background pl-9" />
                      </div>
                      {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="h-10 border-input bg-background pl-9" />
                      </div>
                      {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
                    </div>
                    <div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('password')} className="h-10 border-input bg-background pl-9 pr-10" />
                        <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
                    </div>
                    <div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type={showConfirmPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="h-10 border-input bg-background pl-9 pr-10" />
                        <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.confirm && <p className="mt-1 text-xs text-destructive">{errors.confirm}</p>}
                    </div>
                    {/* <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Receive OTP via</Label>
                      <div className="flex gap-4">
                        {(['EMAIL', 'SMS'] as RegisterRequestPreferredVerification[]).map((v) => (
                          <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="channel"
                              value={v}
                              checked={channel === v}
                              onChange={() => setChannel(v)}
                              className="accent-primary"
                            />
                            {v === 'EMAIL' ? 'Email' : 'SMS'}
                          </label>
                        ))}
                      </div>
                    </div> */}

                    <Button type="submit" className="h-10 w-full gap-2" disabled={register.isPending}>
                      {register.isPending ? 'Creating account...' : <>{t('create_account')} <ArrowRight className="h-4 w-4" /></>}
                    </Button>
                    {googleClientId ? (
                      <>
                        <div className="relative text-center text-xs uppercase tracking-[0.2em] text-muted-foreground my-2">
                          <span className="bg-card px-3">or</span>
                        </div>
                        <div className="relative w-[320px] mx-auto h-10 overflow-hidden rounded-md border border-input shadow-sm transition-colors hover:bg-accent cursor-pointer">
                          {/* Custom Button UI */}
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background text-sm font-medium text-foreground">
                            <svg className="h-4 w-4" viewBox="0 0 24 24">
                              <path
                                fill="#EA4335"
                                d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.14 3.58-8.74z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 24c3.24 0 5.97-1.08 7.96-2.92l-3.86-3c-1.08.72-2.45 1.16-4.1 1.16-3.15 0-5.81-2.13-6.76-5.01H1.37v3.1A11.99 11.99 0 0 0 12 24z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.24 14.23a7.22 7.22 0 0 1 0-4.46v-3.1H1.37a11.99 11.99 0 0 0 0 10.66l3.87-3.1z"
                              />
                              <path
                                fill="#4285F4"
                                d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.94 11.94 0 0 0 12 0 11.99 11.99 0 0 0 1.37 6.67l3.87 3.1c.95-2.88 3.61-5 6.76-5z"
                              />
                            </svg>
                            <span>Tiếp tục với Google</span>
                          </div>
                          {/* Invisible GSI button container */}
                          <div ref={googleButtonRef} className="absolute inset-0 opacity-0 cursor-pointer z-10 [&_iframe]:w-full [&_iframe]:h-full" />
                        </div>
                      </>
                    ) : null}
                  </form>
                )}
              </CardContent>
              <CardFooter className="justify-center border-t border-border text-sm text-muted-foreground">
                {t('already_have_account')} <Link to="/signin" className="ml-1 font-semibold text-primary hover:underline">{t('login')}</Link>
              </CardFooter>
            </Card>
        </div>

        <div className={`hidden rounded-3xl border border-border bg-card p-10 md:flex md:flex-col md:justify-center ${fromSignin ? 'auth-swap-to-right' : ''}`}>
          <Badge className="mb-4 border border-ai/20 bg-ai-soft text-ai w-fit flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 animate-pulse text-ai" /> Build your profile</Badge>
          <h1 className="hero-title mb-5 text-5xl font-bold leading-tight lg:text-6xl">{t('signup_welcome').replace('SmartCV', '').trim()} <span className="hero-gradient">SmartCV</span></h1>
          <p className="mb-8 max-w-md text-lg leading-8 text-muted-foreground">Create your candidate profile and unlock jobs with transparent salary, growth path, and modern engineering culture.</p>
          <ul className="space-y-3 text-base text-muted-foreground">
            <li>• Build a standout CV in a few minutes</li>
            <li>• Get alerts for matching jobs instantly</li>
            <li>• Apply quickly with one-click workflow</li>
          </ul>
        </div>
      </section>
    </>
  )
}
