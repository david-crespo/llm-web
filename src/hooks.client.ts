import type { HandleClientError } from '@sveltejs/kit'
import { toReportedError } from '$lib/errors'

// Errors thrown while SvelteKit loads a route module or navigates are caught by
// SvelteKit, so they reach neither the boundary in +layout.svelte nor the window
// listeners in errors.svelte.ts. Without this they render as SvelteKit's bare
// error page — no stack, nothing to copy, which is the whole problem on a phone.
// A stale route chunk after a deploy is the realistic way to hit this.
//
// The return value lands on `page.error` for +error.svelte to render, so the
// shape here is the App.Error declared in app.d.ts.
export const handleError: HandleClientError = ({ error }) => {
  console.error('Error (navigation):', error)
  return toReportedError(error, 'navigation')
}
