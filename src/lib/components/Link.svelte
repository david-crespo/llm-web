<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    href: string
    children: Snippet
    darkMode?: boolean
  }

  let { href, children, darkMode = false }: Props = $props()

  const baseClasses = 'text-blue-600 underline hover:text-blue-800'
  const darkClasses = 'dark:text-blue-400 dark:hover:text-blue-300'
  const classes = darkMode ? `${baseClasses} ${darkClasses}` : baseClasses
</script>

<a {href} target="_blank" rel="noopener noreferrer" class={classes}>
  {@render children()}
</a>
