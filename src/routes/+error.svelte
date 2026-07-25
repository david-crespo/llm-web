<script lang="ts">
  import { page } from '$app/state'
  import ErrorReport from '$lib/components/ErrorReport.svelte'
  import type { ReportedError } from '$lib/errors'

  // Unexpected errors come through handleError (hooks.client.ts) with a stack.
  // Errors SvelteKit raises itself — a 404 for an unknown route, say — skip that
  // hook and arrive as a status and message only.
  const error = $derived<ReportedError>({
    message: page.error?.message ?? `Error ${page.status}`,
    stack: page.error?.stack,
    source: page.error?.source ?? 'navigation',
  })
</script>

<div class="flex min-h-dvh items-center justify-center p-4">
  <div class="w-full max-w-md">
    <ErrorReport {error} />
  </div>
</div>
