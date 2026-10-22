import type { HandleClientError } from '@sveltejs/kit/hooks'
import { toReportedError } from '#lib/errors.ts'

// Errors thrown while rendering a page, loading a route module, or navigating
// are caught by SvelteKit, so they never reach the window listeners in
// +layout.svelte. Without this they render with only a message — no stack,
// nothing to copy, which is the whole problem on a phone. A stale route chunk
// after a deploy is the realistic way to hit this outside of a render bug.
//
// The return value lands on `page.error` for +error.svelte to render, so the
// shape here is the App.Error declared in app.d.ts.
export const handleError: HandleClientError = ({ kind, error, event }) => {
  // Errors SvelteKit raises itself, like a 404 for an unknown route, have a
  // safe message ("Not Found") and a stack into SvelteKit's internals. The
  // path is the useful part.
  if (kind === 'framework') return { message: `${error.message}: ${event.url.pathname}` }
  if (kind === 'app') return
  console.error('Error (sveltekit):', error)
  return toReportedError(error, 'sveltekit')
}
