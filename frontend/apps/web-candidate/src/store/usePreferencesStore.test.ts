import { describe, expect, it, vi } from 'vitest'

async function loadStore() {
  vi.resetModules()
  return import('./usePreferencesStore')
}

describe('usePreferencesStore', () => {
  it('defaults language to VI and theme to light when no local preferences exist', async () => {
    const { usePreferencesStore } = await loadStore()

    expect(usePreferencesStore.getState().language).toBe('VI')
    expect(usePreferencesStore.getState().theme).toBe('light')
  })

  it('trusts legacy explicit localStorage keys over pre-versioned persisted zustand values', async () => {
    localStorage.setItem('smartcv_lang', 'en')
    localStorage.setItem('smartcv_theme', 'dark')
    localStorage.setItem('smartcv_preferences', JSON.stringify({
      state: { language: 'VI', theme: 'light' },
      version: 0,
    }))

    const { usePreferencesStore } = await loadStore()

    expect(usePreferencesStore.getState().language).toBe('EN')
    expect(usePreferencesStore.getState().theme).toBe('dark')
  })

  it('normalizes pre-versioned persisted defaults when explicit localStorage keys are missing', async () => {
    localStorage.setItem('smartcv_preferences', JSON.stringify({
      state: { language: 'EN', theme: 'dark' },
      version: 0,
    }))

    const { usePreferencesStore } = await loadStore()

    expect(usePreferencesStore.getState().language).toBe('VI')
    expect(usePreferencesStore.getState().theme).toBe('light')
  })

  it('can apply authenticated preferences without writing anonymous localStorage keys', async () => {
    const { usePreferencesStore } = await loadStore()

    usePreferencesStore.getState().applyAuthenticatedPreferences({ language: 'EN', theme: 'dark' })

    expect(usePreferencesStore.getState().language).toBe('EN')
    expect(usePreferencesStore.getState().theme).toBe('dark')
    expect(localStorage.getItem('smartcv_lang')).toBeNull()
    expect(localStorage.getItem('smartcv_theme')).toBeNull()
  })
})
