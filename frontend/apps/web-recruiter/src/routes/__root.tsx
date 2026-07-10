import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { registerSignOutHandler } from '@smart-cv/api'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from '@smart-cv/i18n'
import { useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { Toaster } from 'sonner'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
})

function RootComponent() {
  useEffect(() => {
    registerSignOutHandler(() => useAuthStore.getState().signOut())
  }, [])

  return (
    <>
      <Outlet />
      <Toaster richColors />
    </>
  )
}

function NotFoundPage() {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    const savedTheme = localStorage.getItem('smartcv_theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', isDark)

    const savedLang = localStorage.getItem('smartcv_lang')
    if (savedLang === 'en' || savedLang === 'vi') {
      i18n.changeLanguage(savedLang)
    }
  }, [i18n])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-2xl text-center">
        <p className="text-8xl font-black leading-none tracking-tight text-foreground md:text-9xl">{t('not_found_title')}</p>
        <h1 className="mt-4 text-xl font-bold text-foreground">{t('not_found_heading')}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{t('not_found_desc')}</p>
        <Link
          to="/employer"
          className="mt-8 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide !text-white shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>svg]:!text-white"
        >
          <ArrowLeft className="size-4" />
          {t('not_found_back_home')}
        </Link>
      </div>
    </div>
  )
}
