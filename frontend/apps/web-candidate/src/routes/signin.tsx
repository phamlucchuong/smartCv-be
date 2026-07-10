import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input } from '@smart-cv/ui'
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles, ChevronLeft } from 'lucide-react'
import { useTranslation } from '@smart-cv/i18n'
import { jwtDecode } from 'jwt-decode'
import { toast } from 'sonner'
import { useAuthenticateWithGoogle, useLoginCandidate } from '@smart-cv/api'
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



export const Route = createFileRoute('/signin')({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) throw redirect({ to: '/' })
  },
  component: SignInComponent,
})

function SignInComponent() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const signIn = useAuthStore((s) => s.signIn)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState('')
  const [otpOpen, setOtpOpen] = React.useState(false)
  const [unverifiedPhone, setUnverifiedPhone] = React.useState('')
  const googleButtonRef = React.useRef<HTMLDivElement | null>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()


  const [fromSignup] = React.useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('auth_prev_route') === '/signup',
  )

  React.useEffect(() => {
    document.title = t('page_title_signin')
    sessionStorage.setItem('auth_prev_route', '/signin')
  }, [t])

  function openOtpPanel() {
    setOtpOpen(true)
  }

  const login = useLoginCandidate()
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

  async function attemptLogin(emailVal: string, passwordVal: string) {
    const result = await login.mutateAsync({ data: { email: emailVal, password: passwordVal } })
    const accessToken = result.data?.token
    const refreshToken = result.data?.refreshToken
    if (!accessToken || !refreshToken) throw new Error('Invalid token response')
    const payload = jwtDecode<JwtPayload>(accessToken)
    if (!hasCandidateRole(payload.scope)) {
      throw new Error('This account does not have candidate access.')
    }
    signIn(accessToken, refreshToken)
    navigate({ to: '/' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      const msg = 'Please enter both email and password.'
      setError(msg)
      toast.error(msg)
      return
    }
    setError('')
    try {
      await attemptLogin(email, password)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: number; message?: string; data?: { phone?: string } } }; message?: string }
      if (e?.response?.data?.code === 3003) {
        const phoneVal = e?.response?.data?.data?.phone ?? ''
        setUnverifiedPhone(phoneVal)
        openOtpPanel()
      } else {
        const errorMsg = e?.response?.data?.message ?? e?.message ?? 'Invalid email or password.'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    }
  }

  async function handleOtpSuccess() {
    setOtpOpen(false)
    toast.success('Account verified!')
    try {
      await attemptLogin(email, password)
    } catch {
      toast.error('Verification succeeded but login failed. Please try signing in again.')
      navigate({ to: '/signin' })
    }
  }

  return (
    <>
      <section className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 md:grid-cols-2 md:px-6">
        <Link to="/" className="absolute left-4 top-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors z-10">
          <ChevronLeft className="h-4 w-4" />
          {t('candidate_back_to_home')}
        </Link>
        <div className={`hidden rounded-3xl border border-border bg-card p-10 md:flex md:flex-col md:justify-center ${fromSignup ? 'auth-swap-to-left' : ''}`}>
          <Badge className="mb-4 border border-ai/20 bg-ai-soft text-ai w-fit flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 animate-pulse text-ai" /> Smart matching</Badge>
          <h1 className="hero-title mb-5 text-5xl font-bold leading-tight lg:text-6xl">{t('signin_welcome').replace('SmartCV', '').trim()} <span className="hero-gradient">SmartCV</span></h1>
          <p className="mb-8 max-w-md text-lg leading-8 text-muted-foreground">Continue your hiring journey with personalized jobs, salary insights, and one-click applications.</p>
          <ul className="space-y-3 text-base text-muted-foreground">
            <li>• Curated jobs from verified companies</li>
            <li>• Track applications in one dashboard</li>
            <li>• Built-in CV and interview resources</li>
          </ul>
        </div>

        <div className={`flex h-full items-center justify-center ${fromSignup ? 'auth-swap-to-right' : ''}`}>
          <Card className="w-full max-w-md card-surface">
            <CardHeader className="text-left">
              <CardTitle className="text-2xl">{otpOpen ? 'Verify your account' : t('signin_title')}</CardTitle>
              <CardDescription>
                {otpOpen ? 'Confirm your details to activate your account.' : 'Use your account to access candidate features.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {otpOpen ? (
                <OtpVerificationForm
                  email={email}
                  phone={unverifiedPhone}
                  onSuccess={handleOtpSuccess}
                  onClose={() => setOtpOpen(false)}
                />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 border-input bg-background pl-9" />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showPassword ? 'text' : 'password'} placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 border-input bg-background pl-9 pr-10" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <Button type="submit" className="h-10 w-full gap-2" disabled={login.isPending}>
                    {login.isPending ? 'Signing in...' : <>{t('login')} <ArrowRight className="h-4 w-4" /></>}
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
              {t('new_to_smartcv')} <Link to="/signup" className="ml-1 font-semibold text-primary hover:underline">{t('create_account')}</Link>
            </CardFooter>
          </Card>
        </div>
      </section>
    </>
  )
}
