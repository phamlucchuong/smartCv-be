import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { configureCookieNames } from '@smart-cv/api'
import '@smart-cv/i18n'
import '@smart-cv/ui/src/globals.css'
import './index.css'
import { routeTree } from './routeTree.gen'

// Isolate this app's auth cookies from recruiter and admin apps running on the same localhost domain
configureCookieNames('smart_cv_c_token', 'smart_cv_c_refresh')

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
