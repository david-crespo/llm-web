import type { ReportedError } from './errors'

export const DIAGNOSTICS_TAB_KEY = 'llm-web-diagnostics-tab-v1'
export const DIAGNOSTICS_RUN_PREFIX = 'llm-web-diagnostics-run-v1:'
export const DIAGNOSTICS_REPORT_PREFIX = 'llm-web-diagnostics-report-v1:'

const MAX_EVENTS = 60
const HEARTBEAT_MS = 5000
const RUNTIME_KEY = '__llmWebCrashDiagnosticsV1'

type DiagnosticValue = string | number | boolean | null | undefined

export type DiagnosticEvent = {
  at: string
  name: string
  details?: Record<string, DiagnosticValue>
}

export type DiagnosticRun = {
  version: 1
  runId: string
  startedAt: string
  updatedAt: string
  navigationType: string
  url: string
  userAgent: string
  events: DiagnosticEvent[]
}

type Runtime = {
  tabId: string
  run: DiagnosticRun
  reportRun: DiagnosticRun | null
  active: boolean
}

type DiagnosticWindow = Window & { [RUNTIME_KEY]?: Runtime }

function isDiagnosticRun(value: unknown): value is DiagnosticRun {
  if (!value || typeof value !== 'object') return false
  const run = value as Partial<DiagnosticRun>
  return (
    run.version === 1 &&
    typeof run.runId === 'string' &&
    typeof run.startedAt === 'string' &&
    typeof run.updatedAt === 'string' &&
    typeof run.navigationType === 'string' &&
    typeof run.url === 'string' &&
    typeof run.userAgent === 'string' &&
    Array.isArray(run.events)
  )
}

function readRun(key: string): DiagnosticRun | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    return isDiagnosticRun(value) ? value : null
  } catch {
    return null
  }
}

function writeRun(key: string, run: DiagnosticRun): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(run))
    return true
  } catch {
    return false
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Diagnostics must never make a storage-restricted page fail to boot.
  }
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function getNavigationType(): string {
  return performance.getEntriesByType('navigation')[0]?.toJSON?.().type ?? 'unknown'
}

function runtimeSnapshot(): Record<string, DiagnosticValue> {
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number }
    }
  ).memory
  return {
    visibility: document.visibilityState,
    domNodes: document.getElementsByTagName('*').length,
    scrollY: Math.round(window.scrollY),
    scrollHeight: document.documentElement.scrollHeight,
    // Chromium exposes these non-standard counters. Safari leaves them null;
    // keeping the fields in the report makes that limitation explicit.
    usedJSHeapBytes: memory?.usedJSHeapSize ?? null,
    totalJSHeapBytes: memory?.totalJSHeapSize ?? null,
    jsHeapLimitBytes: memory?.jsHeapSizeLimit ?? null,
  }
}

function getRuntime(): Runtime | undefined {
  return typeof window === 'undefined' ? undefined : (window as DiagnosticWindow)[RUNTIME_KEY]
}

export function reportForUnexpectedExit(run: DiagnosticRun | null): ReportedError | null {
  if (!isDiagnosticRun(run)) return null
  return {
    source: 'abnormal-exit',
    message:
      'The previous document disappeared without a pagehide event. Safari may have terminated its WebContent process; memory pressure is one possible cause.',
    stack: `Abnormal page exit diagnostic\n${JSON.stringify(run, null, 2)}`,
  }
}

/**
 * Start a per-tab journal. A normal navigation removes the active marker in a
 * synchronous pagehide handler. If the browser kills the WebContent process,
 * that handler cannot run, so the next document turns the abandoned marker into
 * a report that remains available until dismissed.
 */
export function startCrashDiagnostics(): ReportedError | null {
  if (typeof window === 'undefined') return null

  const existing = getRuntime()
  if (existing) return reportForUnexpectedExit(existing.reportRun)

  let tabId: string
  try {
    tabId = sessionStorage.getItem(DIAGNOSTICS_TAB_KEY) ?? makeId()
    sessionStorage.setItem(DIAGNOSTICS_TAB_KEY, tabId)
  } catch {
    return null
  }

  const runKey = `${DIAGNOSTICS_RUN_PREFIX}${tabId}`
  const reportKey = `${DIAGNOSTICS_REPORT_PREFIX}${tabId}`
  const abandonedRun = readRun(runKey)
  const priorReport = readRun(reportKey)
  const reportRun = abandonedRun ?? priorReport
  if (abandonedRun) writeRun(reportKey, abandonedRun)

  const now = new Date().toISOString()
  const run: DiagnosticRun = {
    version: 1,
    runId: makeId(),
    startedAt: now,
    updatedAt: now,
    navigationType: getNavigationType(),
    url: location.href,
    userAgent: navigator.userAgent,
    events: [],
  }
  const runtime: Runtime = { tabId, run, reportRun, active: true }
  ;(window as DiagnosticWindow)[RUNTIME_KEY] = runtime
  recordDiagnosticEvent('page-start')

  window.addEventListener('pagehide', (event) => {
    recordDiagnosticEvent('pagehide', { persisted: event.persisted })
    runtime.active = false
    remove(runKey)
  })
  window.addEventListener('pageshow', (event) => {
    // A BFCache restore resumes the same document after pagehide removed its
    // marker, so make it active again.
    if (event.persisted) {
      runtime.active = true
      recordDiagnosticEvent('pageshow', { persisted: true })
    }
  })
  document.addEventListener('visibilitychange', () => {
    recordDiagnosticEvent('visibilitychange', { visibility: document.visibilityState })
  })
  window.setInterval(() => recordDiagnosticEvent('heartbeat'), HEARTBEAT_MS)

  return reportForUnexpectedExit(reportRun)
}

export function recordDiagnosticEvent(
  name: string,
  details: Record<string, DiagnosticValue> = {},
): void {
  const runtime = getRuntime()
  if (!runtime?.active) return

  const at = new Date().toISOString()
  runtime.run.updatedAt = at
  runtime.run.url = location.href
  runtime.run.events.push({ at, name, details: { ...runtimeSnapshot(), ...details } })
  if (runtime.run.events.length > MAX_EVENTS) {
    runtime.run.events.splice(0, runtime.run.events.length - MAX_EVENTS)
  }
  writeRun(`${DIAGNOSTICS_RUN_PREFIX}${runtime.tabId}`, runtime.run)
}

export function dismissUnexpectedExitReport(): void {
  const runtime = getRuntime()
  if (!runtime) return
  runtime.reportRun = null
  remove(`${DIAGNOSTICS_REPORT_PREFIX}${runtime.tabId}`)
}
