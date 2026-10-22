// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { ErrorSource } from '#lib/errors.ts'

declare global {
  namespace App {
    // SvelteKit-generated errors only have a status and message. Unexpected
    // errors returned by handleError include these report details.
    interface Error {
      stack?: string
      source?: ErrorSource
    }
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {}
