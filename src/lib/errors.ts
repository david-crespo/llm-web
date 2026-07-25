export type ErrorSource = 'render' | 'window' | 'unhandledrejection' | 'navigation'

export type ReportedError = {
  message: string
  stack?: string
  /** Where it came from, so a report distinguishes a render crash from a stray
   * rejected promise. */
  source: ErrorSource
}

export function toReportedError(error: unknown, source: ReportedError['source']): ReportedError {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack, source }
  }
  if (typeof error === 'string') return { message: error, source }
  try {
    return { message: JSON.stringify(error), source }
  } catch {
    return { message: String(error), source }
  }
}
