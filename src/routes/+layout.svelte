<script lang="ts">
  import '../app.css'
  import favicon from '$lib/assets/favicon.svg'
  import ErrorReport from '$lib/components/ErrorReport.svelte'
  import { toReportedError, type ReportedError } from '$lib/errors'
  import { dismissUnexpectedExitReport, startCrashDiagnostics } from '$lib/crash-diagnostics'

  let { children } = $props()
  let lastError = $state<ReportedError | null>(startCrashDiagnostics())

  function showError(error: unknown, source: ReportedError['source']) {
    console.error(`Error (${source}):`, error)
    // Later errors are usually fallout from the first.
    lastError ??= toReportedError(error, source)
  }

  function showWindowError(event: Event) {
    const { error, message } = event as ErrorEvent
    showError(error ?? message, 'window')
  }
</script>

<svelte:window
  onerror={showWindowError}
  onunhandledrejection={(event) => showError(event.reason, 'unhandledrejection')}
/>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>llm-web</title>
</svelte:head>

<svelte:boundary onerror={(error) => console.error('Error (render):', error)}>
  {@render children?.()}

  <!-- Errors from event handlers and async work never reach the boundary, so
       they surface as an overlay on top of a page that is still standing. It
       lives inside the boundary so that a later render crash takes it down
       along with the rest of the boundary's content, leaving just `failed`. -->
  {#if lastError}
    {@const error = lastError}
    <div class="fixed inset-x-0 top-0 z-60 p-3">
      <div class="mx-auto max-w-2xl shadow-lg">
        <ErrorReport
          {error}
          onDismiss={() => {
            if (error.source === 'abnormal-exit') dismissUnexpectedExitReport()
            lastError = null
          }}
        />
      </div>
    </div>
  {/if}

  {#snippet failed(error, reset)}
    <div class="flex min-h-dvh items-center justify-center p-4">
      <div class="w-full max-w-md">
        <ErrorReport
          error={toReportedError(error, 'render')}
          onReset={() => {
            lastError = null
            reset()
          }}
        />
      </div>
    </div>
  {/snippet}
</svelte:boundary>
