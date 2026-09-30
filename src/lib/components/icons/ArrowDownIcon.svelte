<script lang="ts">
  let { width = 18, height = 18 }: { width?: number; height?: number } = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  {width}
  {height}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M12 5v14m-6-6 6 6 6-6" />
</svg>
