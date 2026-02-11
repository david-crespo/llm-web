export type ThemeMode = 'light' | 'dark' | 'system'

let currentMode = $state<ThemeMode>('system')
let media: MediaQueryList | null = null
let initialized = false

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
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function initTheme() {
  if (typeof window === 'undefined' || initialized) return
  initialized = true
  currentMode = loadStoredMode()
  apply(currentMode)
  media ||= window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener?.('change', () => {
    if (currentMode === 'system') apply(currentMode)
  })
}

export function getThemeMode(): ThemeMode {
  return currentMode
}

export function setThemeMode(mode: ThemeMode) {
  currentMode = mode
  saveStoredMode(mode)
  apply(mode)
}

export function cycleThemeMode(): ThemeMode {
  const next: ThemeMode =
    currentMode === 'light' ? 'dark' : currentMode === 'dark' ? 'system' : 'light'
  setThemeMode(next)
  return next
}
