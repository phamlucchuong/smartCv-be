import { afterEach } from 'vitest'

afterEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  document.cookie = 'smart_cv_token=; Max-Age=0; path=/'
  document.cookie = 'smart_cv_refresh=; Max-Age=0; path=/'
  document.documentElement.className = ''
})
