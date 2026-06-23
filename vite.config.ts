import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { PluginOption } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// The app's CSP sets `upgrade-insecure-requests`, which WebKit (unlike Chromium)
// honors even on localhost — so over plain http the dev server's module scripts
// get upgraded to https and fail with a TLS error. The deployed site is https,
// so the e2e tests serve over https too (self-signed) when PW_HTTPS is set.
const plugins: PluginOption[] = [tailwindcss(), sveltekit()]
if (process.env.PW_HTTPS === '1') plugins.push(basicSsl())

export default defineConfig({
  plugins,
  // Rolldown (Vite 8) corrupts lone surrogates in string literals when it
  // concatenates temml's tokenRegex fragments, rewriting \uD800/\uDBFF/etc.
  // to U+FFFD. The corrupted regex then lexes `\partial` as `\p`,`a`,`r`,...
  // and the symbol lookup never sees the real command. The patch under
  // patches/temml*.patch replaces the lone-surrogate escapes with `\\uD800`
  // forms, which Rolldown passes through untouched. optimizeDeps.exclude
  // bypasses the same bundler in the dev pre-bundle pass.
  optimizeDeps: { exclude: ['temml'] },
  // The Playwright e2e specs live in tests/e2e and use *.spec.ts names that
  // match vitest's default glob, so exclude them — they run via `test:e2e`.
  test: { exclude: [...configDefaults.exclude, 'tests/e2e/**'] },
})
