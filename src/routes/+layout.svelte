<script lang="ts">
  import '../app.css'
  import favicon from '#lib/assets/favicon.svg'
  import ErrorReport from '#lib/components/ErrorReport.svelte'
  import { toReportedError, type ReportedError } from '#lib/errors.ts'

  let { children } = $props()
  let lastError = $state<ReportedError | null>(null)

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

{@render children?.()}

<!-- Render crashes go through handleError (hooks.client.ts) to the boundary
     SvelteKit puts around each page, which renders +error.svelte. Errors from
     event handlers and async work never reach a boundary, so they surface as an
     overlay on top of a page that is still standing. -->
{#if lastError}
  {@const error = lastError}
  <div class="fixed inset-x-0 top-0 z-60 p-3">
    <div class="mx-auto max-w-2xl shadow-lg">
      <ErrorReport {error} onDismiss={() => (lastError = null)} />
    </div>
  </div>
{/if}
