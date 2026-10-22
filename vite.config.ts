import adapter from '@sveltejs/adapter-static'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { PluginOption } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

const kit = sveltekit({
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

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
      'default-src': ['self'],
      'base-uri': ['none'],
      'object-src': ['none'],
      'form-action': ['self'],
      'frame-ancestors': ['none'],
      'script-src': ['self'],
      'style-src': ['self', 'unsafe-inline'], // Svelte requires unsafe-inline for styles currently
      'img-src': ['self', 'data:', 'blob:'],
      'font-src': ['self'],
      'connect-src': [
        'self',
        'https://api.openai.com',
        'https://api.anthropic.com',
        'https://generativelanguage.googleapis.com',
      ],
      'manifest-src': ['self'],
      'worker-src': ['self'],
      'upgrade-insecure-requests': true,
    },
  },
})

// The app's CSP sets `upgrade-insecure-requests`, which WebKit (unlike Chromium)
// honors even on localhost — so over plain http the dev server's module scripts
// get upgraded to https and fail with a TLS error. The deployed site is https,
// so the e2e preview server uses https too (self-signed) when PW_HTTPS is set.
const plugins: PluginOption[] = [tailwindcss(), kit]
if (process.env.PW_HTTPS === '1') plugins.push(basicSsl())

export default defineConfig({
  plugins,
  // The Playwright e2e specs live in tests/e2e and use *.spec.ts names that
  // match vitest's default glob, so exclude them — they run via `test:e2e`.
  test: { exclude: [...configDefaults.exclude, 'tests/e2e/**'] },
})
