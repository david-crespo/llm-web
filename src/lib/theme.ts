export type ThemeMode = 'light' | 'dark' | 'system'

let currentMode: ThemeMode = 'system'
let media: MediaQueryList | null = null

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  media ||= window.matchMedia('(prefers-color-scheme: dark)')
  return media.matches
}

function loadStoredMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system'
  const raw = localStorage.getItem('theme')
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

function saveStoredMode(mode: ThemeMode) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', mode)
  } catch (e: unknown) {
    console.error('Error saving theme', e)
  }
}

function apply(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const dark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark())
  root.classList.toggle('dark', dark)
  // Hint to the UA for form controls, etc.
  root.style.colorScheme = dark ? 'dark' : 'light'
}

function notify(mode: ThemeMode) {
  if (typeof window === 'undefined') return
  const event = new CustomEvent('theme-change', {
    detail: {
      mode,
      effectiveDark: mode === 'dark' || (mode === 'system' && getSystemPrefersDark()),
    },
  })
  window.dispatchEvent(event)
}

export function initTheme() {
  // Only run in browser
  if (typeof window === 'undefined') return
  currentMode = loadStoredMode()
  apply(currentMode)
  // Watch system changes when in system mode
  media ||= window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (currentMode === 'system') {
      apply(currentMode)
      notify(currentMode)
    }
  }
  media.addEventListener?.('change', onChange)
}

export function getThemeMode(): ThemeMode {
  if (typeof window !== 'undefined' && !media) {
    // Ensure initialized in case consumer didn't call init
    initTheme()
  }
  return currentMode
}

export function setThemeMode(mode: ThemeMode) {
  currentMode = mode
  saveStoredMode(mode)
  apply(mode)
  notify(mode)
}

export function cycleThemeMode(): ThemeMode {
  const next: ThemeMode =
    currentMode === 'light' ? 'dark' : currentMode === 'dark' ? 'system' : 'light'
  setThemeMode(next)
  return next
}
