import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Vite's pre-bundling mangles temml's symbol table, causing the browser build
  // to reject commands like \partial, \frac, \Rightarrow.
  optimizeDeps: { exclude: ['temml'] },
})
