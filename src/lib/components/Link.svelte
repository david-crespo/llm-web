<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    href: string
    children: Snippet
  }

  let { href, children }: Props = $props()
</script>

<a
  {href}
  target="_blank"
  rel="noopener noreferrer"
  class="text-link underline hover:text-link-hover"
>
  {@render children()}
</a>
