import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Rolldown (Vite 8) corrupts lone surrogates in string literals when it
  // concatenates temml's tokenRegex fragments, rewriting \uD800/\uDBFF/etc.
  // to U+FFFD. The corrupted regex then lexes `\partial` as `\p`,`a`,`r`,...
  // and the symbol lookup never sees the real command. The patch under
  // patches/temml*.patch replaces the lone-surrogate escapes with `\\uD800`
  // forms, which Rolldown passes through untouched. optimizeDeps.exclude
  // bypasses the same bundler in the dev pre-bundle pass.
  optimizeDeps: { exclude: ['temml'] },
})
