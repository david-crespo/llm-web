<script lang="ts">
  import { sourceMeta, sourceTitle } from '#lib/citations.ts'
  import type { Source } from '#lib/types.ts'

  interface Props {
    sources?: Source[]
    searchQueries?: string[]
  }

  let { sources = [], searchQueries = [] }: Props = $props()

  const citedSources = $derived(sources.filter((s) => s.cited))
  const extraSources = $derived(sources.filter((s) => !s.cited))
  let showExtra = $state(false)

  function compactAge(age: string): string {
    const match = /^(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago$/i.exec(age.trim())
    if (!match) return age
    const unit = match[2].toLowerCase()
    const short = unit === 'month' ? 'mo' : unit[0]
    return `${match[1]}${short}`
  }

  function rowMeta(source: Source): string {
    return source.age ? `${source.domain} · ${compactAge(source.age)}` : source.domain
  }
</script>

{#if citedSources.length > 0 || extraSources.length > 0 || searchQueries.length > 0}
  <div class="mt-3 border-t border-edge-muted pt-2.5" data-sources>
    <div class="flex items-center gap-1.5 text-xs text-fg-muted">
      {#if citedSources.length > 0}
        <span class="shrink-0 font-medium">Sources</span>
      {:else if extraSources.length > 0}
        <button
          type="button"
          onclick={() => (showExtra = !showExtra)}
          aria-expanded={showExtra}
          class="shrink-0 font-medium text-fg-muted hover:text-fg"
        >
          {showExtra ? 'Hide' : 'Show'} {extraSources.length} search {extraSources.length === 1
            ? 'result'
            : 'results'}
        </button>
      {/if}
      {#if searchQueries.length > 0}
        {#if citedSources.length > 0 || extraSources.length > 0}
          <span class="shrink-0 text-fg-faint">·</span>
        {/if}
        <span class="min-w-0 flex-1 truncate text-fg-faint" title={searchQueries.join(', ')}>
          Searched {searchQueries.map((q) => `“${q}”`).join(', ')}
        </span>
      {/if}
    </div>

    {#if citedSources.length > 0}
      <ol class="mt-1 space-y-0.5">
        {#each citedSources as source, i (source.url)}
          <li>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              class="group -mx-1.5 flex items-baseline gap-2 rounded px-1.5 py-1 hover:bg-surface-hover"
            >
              <span class="w-4 shrink-0 text-right text-xs tabular-nums text-fg-faint">
                {i + 1}
              </span>
              {#if source.title}
                <span class="min-w-0 flex-1 truncate text-sm text-fg group-hover:text-link">
                  {source.title}
                </span>
                <span class="max-w-[44%] shrink-0 truncate text-xs text-fg-muted">
                  {rowMeta(source)}
                </span>
              {:else}
                <span class="shrink-0 text-sm text-fg group-hover:text-link">
                  {sourceTitle(source)}
                </span>
                <span class="min-w-0 flex-1 truncate text-xs text-fg-muted">
                  {sourceMeta(source)}
                </span>
              {/if}
            </a>
          </li>
        {/each}
      </ol>
    {/if}

    {#if citedSources.length > 0 && extraSources.length > 0}
      <button
        type="button"
        onclick={() => (showExtra = !showExtra)}
        aria-expanded={showExtra}
        class="mt-1 text-xs text-fg-muted hover:text-fg"
      >
        {showExtra
          ? 'Hide extra search results'
          : `+ ${extraSources.length} more search ${extraSources.length === 1 ? 'result' : 'results'}`}
      </button>
    {/if}

    {#if showExtra && extraSources.length > 0}
      <ol class="mt-1 space-y-0.5" start={citedSources.length + 1}>
        {#each extraSources as source, i (source.url)}
          <li>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              class="group -mx-1.5 flex items-baseline gap-2 rounded px-1.5 py-1 hover:bg-surface-hover"
            >
              <span class="w-4 shrink-0 text-right text-xs tabular-nums text-fg-faint">
                {citedSources.length + i + 1}
              </span>
              {#if source.title}
                <span class="min-w-0 flex-1 truncate text-sm text-fg group-hover:text-link">
                  {source.title}
                </span>
                <span class="max-w-[44%] shrink-0 truncate text-xs text-fg-muted">
                  {rowMeta(source)}
                </span>
              {:else}
                <span class="shrink-0 text-sm text-fg group-hover:text-link">
                  {sourceTitle(source)}
                </span>
                <span class="min-w-0 flex-1 truncate text-xs text-fg-muted">
                  {sourceMeta(source)}
                </span>
              {/if}
            </a>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
{/if}
