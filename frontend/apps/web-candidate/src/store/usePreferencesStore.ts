import { create } from 'zustand'

export type Theme = 'dark' | 'light'
export type Language = 'EN' | 'VI'

const LEGACY_LANGUAGE_KEY = 'smartcv_lang'
const LEGACY_THEME_KEY = 'smartcv_theme'
const PREFERENCES_KEY = 'smartcv_preferences'
const PREFERENCES_VERSION = 1

export interface PreferencesState {
  theme: Theme
  language: Language
  preferenceSavePending: boolean
  setLanguage: (language: Language) => void
  setTheme: (theme: Theme) => void
  setPreferenceSavePending: (pending: boolean) => void
  toggleTheme: () => void
  toggleLanguage: () => void
  applyAuthenticatedPreferences: (preferences: Partial<Pick<PreferencesState, 'theme' | 'language'>>) => void
  restoreAnonymousPreferences: () => void
  syncLanguageFromI18n: (language: string | undefined) => void
}

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light'
}

function isLanguage(value: string | null): value is 'en' | 'vi' {
  return value === 'en' || value === 'vi'
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const explicitTheme = localStorage.getItem(LEGACY_THEME_KEY)
  return isTheme(explicitTheme) ? explicitTheme : 'light'
}

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'VI'
  const explicitLanguage = localStorage.getItem(LEGACY_LANGUAGE_KEY)
  return isLanguage(explicitLanguage) ? (explicitLanguage.toUpperCase() as Language) : 'VI'
}

function persistAnonymousPreferences(language: Language, theme: Theme) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LEGACY_LANGUAGE_KEY, language.toLowerCase())
  localStorage.setItem(LEGACY_THEME_KEY, theme)
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    state: {
      language,
      theme,
      explicitLocalChoice: true,
    },
    version: PREFERENCES_VERSION,
  }))
}

export const usePreferencesStore = create<PreferencesState>()((set, get) => ({
  theme: getInitialTheme(),
  language: getInitialLanguage(),
  preferenceSavePending: false,

  setLanguage: (language) => {
    persistAnonymousPreferences(language, get().theme)
    set({ language })
  },

  setTheme: (theme) => {
    persistAnonymousPreferences(get().language, theme)
    set({ theme })
  },

  setPreferenceSavePending: (pending) => set({ preferenceSavePending: pending }),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    persistAnonymousPreferences(get().language, next)
    set({ theme: next })
  },

  toggleLanguage: () => {
    const next = get().language === 'EN' ? 'VI' : 'EN'
    persistAnonymousPreferences(next, get().theme)
    set({ language: next })
  },

  applyAuthenticatedPreferences: (preferences) => {
    set((state) => ({
      language: preferences.language ?? state.language,
      theme: preferences.theme ?? state.theme,
    }))
  },

  restoreAnonymousPreferences: () =>
    set({
      language: getInitialLanguage(),
      theme: getInitialTheme(),
    }),

  syncLanguageFromI18n: (language) =>
    set({ language: language?.toUpperCase() === 'EN' ? 'EN' : 'VI' }),
}))
