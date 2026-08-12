<script lang="ts">
  import type { ReportedError } from '$lib/errors'

  interface Props {
    error: ReportedError
    /** Recreate the boundary contents. Absent for window-level errors, where
     * the UI is still standing and there is nothing to re-render. */
    onReset?: () => void
    /** Dismiss the report. Absent when the error took the whole page down. */
    onDismiss?: () => void
  }

  let { error, onReset, onDismiss }: Props = $props()

  let copyState = $state<'idle' | 'copied' | 'failed'>('idle')
  let detailsOpen = $state(false)

  const copyLabels = { idle: 'Copy report', copied: 'Copied', failed: 'Copy failed' }

  // Copying is the point of this component: on a phone there is no console to
  // read the stack out of, so the report has to be something you can paste.
  async function copyReport() {
    const report = [
      error.message,
      `source: ${error.source}`,
      `url: ${location.href}`,
      `ua: ${navigator.userAgent}`,
      error.stack ?? '(no stack)',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(report)
      copyState = 'copied'
    } catch {
      // A denied clipboard write would otherwise leave the button doing nothing
      // visible, so expand the stack for selecting by hand instead.
      copyState = 'failed'
      detailsOpen = true
    }
    setTimeout(() => (copyState = 'idle'), 2000)
  }

  const buttonClass =
    'rounded border border-edge bg-surface-alt px-3 py-1.5 text-sm hover:bg-surface-hover'
</script>

<div
  class="space-y-3 rounded border border-danger bg-surface-danger p-4 text-left"
  role="alert"
>
  <h2 class="font-medium text-danger">
    {error.source === 'abnormal-exit' ? 'Previous page ended unexpectedly' : 'Something broke'}
  </h2>
  <p class="text-sm break-words">{error.message}</p>
  {#if error.stack}
    <details class="text-xs text-fg-muted" bind:open={detailsOpen}>
      <summary class="cursor-pointer">Details</summary>
      <pre class="mt-2 overflow-x-auto rounded bg-surface-alt p-2 text-xs">{error.stack}</pre>
    </details>
  {/if}
  <div class="flex flex-wrap gap-2">
    <button class={buttonClass} onclick={copyReport}>{copyLabels[copyState]}</button>
    {#if onReset}
      <button class={buttonClass} onclick={onReset}>Try again</button>
    {/if}
    <button class={buttonClass} onclick={() => location.reload()}>Reload</button>
    {#if onDismiss}
      <button class={buttonClass} onclick={onDismiss}>Dismiss</button>
    {/if}
  </div>
</div>
