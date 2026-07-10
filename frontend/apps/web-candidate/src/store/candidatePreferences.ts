import * as React from 'react'
import { i18n } from '@smart-cv/i18n'
import {
  getGetSettingsQueryKey,
  useGetSettings,
  useUpdateCandidatePreferences,
  type UserModels,
} from '@smart-cv/api'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { hasCandidateRole, useAuthStore } from './useAuthStore'
import { type Language, type Theme, usePreferencesStore } from './usePreferencesStore'

type BackendLanguage = UserModels.PreferencesSettingsLanguage
type BackendTheme = UserModels.PreferencesSettingsTheme

export type CandidatePreferencesStatus =
  | 'anonymous-local'
  | 'authenticated-loading'
  | 'authenticated-loaded'
  | 'authenticated-error'

export function toFrontendLanguage(language: BackendLanguage | undefined): Language {
  return language === 'EN' ? 'EN' : 'VI'
}

export function toFrontendTheme(theme: BackendTheme | undefined): Theme {
  return theme === 'DARK' ? 'dark' : 'light'
}

export function toBackendLanguage(language: Language): BackendLanguage {
  return language
}

export function toBackendTheme(theme: Theme): BackendTheme {
  return theme === 'dark' ? 'DARK' : 'LIGHT'
}

export function useCandidatePreferences() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.userId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const language = usePreferencesStore((s) => s.language)
  const theme = usePreferencesStore((s) => s.theme)
  const applyAuthenticatedPreferences = usePreferencesStore((s) => s.applyAuthenticatedPreferences)
  const restoreAnonymousPreferences = usePreferencesStore((s) => s.restoreAnonymousPreferences)
  const setLanguage = usePreferencesStore((s) => s.setLanguage)
  const setTheme = usePreferencesStore((s) => s.setTheme)
  const preferenceSavePending = usePreferencesStore((s) => s.preferenceSavePending)
  const setPreferenceSavePending = usePreferencesStore((s) => s.setPreferenceSavePending)

  const settingsQueryKey = React.useMemo(
    () => [...getGetSettingsQueryKey(), userId ?? 'anonymous'] as const,
    [userId],
  )

  const settingsQuery = useGetSettings({
    query: {
      enabled: isAuthenticated && !!userId && hasCandidateRole(role),
      queryKey: settingsQueryKey,
    },
  })
  const updatePreferencesMutation = useUpdateCandidatePreferences()

  React.useEffect(() => {
    if (!isAuthenticated || !userId || !hasCandidateRole(role)) {
      restoreAnonymousPreferences()
      const restoredLanguage = usePreferencesStore.getState().language
      i18n.changeLanguage(restoredLanguage === 'EN' ? 'en' : 'vi')
      queryClient.removeQueries({ queryKey: getGetSettingsQueryKey() })
    }
  }, [isAuthenticated, queryClient, restoreAnonymousPreferences, role, userId])

  React.useEffect(() => {
    const preferences = settingsQuery.data?.data?.preferences
    if (!isAuthenticated || !userId || !hasCandidateRole(role) || !preferences) return

    const nextLanguage = toFrontendLanguage(preferences.language)
    const nextTheme = toFrontendTheme(preferences.theme)
    applyAuthenticatedPreferences({ language: nextLanguage, theme: nextTheme })
    i18n.changeLanguage(nextLanguage === 'EN' ? 'en' : 'vi')
  }, [applyAuthenticatedPreferences, isAuthenticated, role, settingsQuery.data, userId])

  const status: CandidatePreferencesStatus = !isAuthenticated
    ? 'anonymous-local'
    : settingsQuery.isLoading || settingsQuery.isFetching
      ? 'authenticated-loading'
      : settingsQuery.isError
        ? 'authenticated-error'
        : 'authenticated-loaded'

  const persistAuthenticatedPreferences = React.useCallback(
    (next: Partial<Pick<{ language: Language; theme: Theme }, 'language' | 'theme'>>) => {
      if (!isAuthenticated || !userId) {
        if (next.language) {
          setLanguage(next.language)
          i18n.changeLanguage(next.language === 'EN' ? 'en' : 'vi')
        }
        if (next.theme) setTheme(next.theme)
        return
      }

      if (status === 'authenticated-loading' || preferenceSavePending) return

      if (status === 'authenticated-error') {
        toast.error(language === 'VI' ? 'Không thể lưu tùy chọn lúc này' : 'Unable to save preferences right now')
        return
      }

      const previous = { language, theme }
      const nextLanguage = next.language ?? language
      const nextTheme = next.theme ?? theme
      applyAuthenticatedPreferences({ language: nextLanguage, theme: nextTheme })
      if (next.language) i18n.changeLanguage(nextLanguage === 'EN' ? 'en' : 'vi')
      setPreferenceSavePending(true)

      void (async () => {
        try {
          const response = await updatePreferencesMutation.mutateAsync({
            data: {
              language: next.language ? toBackendLanguage(next.language) : undefined,
              theme: next.theme ? toBackendTheme(next.theme) : undefined,
            },
          })

            const saved = response.data
            if (!saved) return
            const savedLanguage = toFrontendLanguage(saved.language)
            const savedTheme = toFrontendTheme(saved.theme)
            applyAuthenticatedPreferences({ language: savedLanguage, theme: savedTheme })
            i18n.changeLanguage(savedLanguage === 'EN' ? 'en' : 'vi')
            queryClient.invalidateQueries({ queryKey: settingsQueryKey })
        } catch {
          applyAuthenticatedPreferences(previous)
          i18n.changeLanguage(previous.language === 'EN' ? 'en' : 'vi')
          toast.error(previous.language === 'VI' ? 'Không thể lưu tùy chọn' : 'Failed to save preferences')
        } finally {
          setPreferenceSavePending(false)
        }
      })()
    },
    [
      applyAuthenticatedPreferences,
      isAuthenticated,
      language,
      preferenceSavePending,
      queryClient,
      setLanguage,
      setPreferenceSavePending,
      setTheme,
      settingsQueryKey,
      status,
      theme,
      updatePreferencesMutation,
      userId,
    ],
  )

  const toggleLanguage = React.useCallback(() => {
    persistAuthenticatedPreferences({ language: language === 'EN' ? 'VI' : 'EN' })
  }, [language, persistAuthenticatedPreferences])

  const toggleTheme = React.useCallback(() => {
    persistAuthenticatedPreferences({ theme: theme === 'dark' ? 'light' : 'dark' })
  }, [persistAuthenticatedPreferences, theme])

  return {
    language,
    theme,
    status,
    isLoading: status === 'authenticated-loading' || preferenceSavePending,
    setLanguage: (next: Language) => persistAuthenticatedPreferences({ language: next }),
    setTheme: (next: Theme) => persistAuthenticatedPreferences({ theme: next }),
    toggleLanguage,
    toggleTheme,
  }
}
