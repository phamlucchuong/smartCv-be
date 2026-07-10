import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '../../store/useAuthStore'
import { CandidateDashboardLayout } from '../../components/layouts/CandidateDashboardLayout'

export const Route = createFileRoute('/_account')({
  beforeLoad: () => {
    if (!useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: '/signin' })
    }
  },
  component: CandidateDashboardLayout,
})
