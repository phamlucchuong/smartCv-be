import { describe, expect, it } from 'vitest'
import {
  toBackendLanguage,
  toBackendTheme,
  toFrontendLanguage,
  toFrontendTheme,
} from './candidatePreferences'

describe('candidatePreferences mapping', () => {
  it('maps backend preferences to frontend store values', () => {
    expect(toFrontendLanguage('EN')).toBe('EN')
    expect(toFrontendLanguage('VI')).toBe('VI')
    expect(toFrontendLanguage(undefined)).toBe('VI')
    expect(toFrontendTheme('DARK')).toBe('dark')
    expect(toFrontendTheme('LIGHT')).toBe('light')
    expect(toFrontendTheme(undefined)).toBe('light')
  })

  it('maps frontend values to backend enum values', () => {
    expect(toBackendLanguage('EN')).toBe('EN')
    expect(toBackendLanguage('VI')).toBe('VI')
    expect(toBackendTheme('dark')).toBe('DARK')
    expect(toBackendTheme('light')).toBe('LIGHT')
  })
})
