import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // Static adapter for client-side only app
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true,
    }),
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'none'"],
        'object-src': ["'none'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"], // Svelte requires unsafe-inline for styles currently
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'"],
        'connect-src': [
          "'self'",
          'https://api.openai.com',
          'https://api.anthropic.com',
          'https://generativelanguage.googleapis.com',
        ],
        'manifest-src': ["'self'"],
        'worker-src': ["'self'"],
        'upgrade-insecure-requests': true,
      },
    },
  },
}

export default config
