<script lang="ts">
  import { onMount } from 'svelte'
  import Link from '$lib/components/Link.svelte'
  import { settings } from '$lib/settings.svelte'

  const inputClass = 'w-full rounded border border-edge bg-surface-elevated px-3 py-2 text-fg'

  let storageUsage = $state<{ used: string; quota: string } | null>(null)

  onMount(() => {
    void navigator.storage.estimate().then((estimate) => {
      const used = estimate.usage ?? 0
      const quota = estimate.quota ?? 0
      storageUsage = {
        used: (used / 1024 / 1024).toFixed(2),
        quota: (quota / 1024 / 1024 / 1024).toFixed(1),
      }
    })
  })
</script>

<div class="mx-auto max-w-md p-4">
  <h1 class="mb-4 text-xl font-medium">API Keys</h1>

  <div class="space-y-4">
    <div>
      <label for="openai-key" class="mb-1 block text-sm font-medium">OpenAI</label>
      <input
        id="openai-key"
        value={settings.getKey('openai')}
        oninput={(e) => settings.setKey('openai', e.currentTarget.value)}
        placeholder="sk-..."
        class={inputClass}
      />
    </div>

    <div>
      <label for="anthropic-key" class="mb-1 block text-sm font-medium">Anthropic</label>
      <input
        id="anthropic-key"
        value={settings.getKey('anthropic')}
        oninput={(e) => settings.setKey('anthropic', e.currentTarget.value)}
        placeholder="sk-ant-..."
        class={inputClass}
      />
    </div>

    <div>
      <label for="google-key" class="mb-1 block text-sm font-medium">Gemini</label>
      <input
        id="google-key"
        value={settings.getKey('google')}
        oninput={(e) => settings.setKey('google', e.currentTarget.value)}
        placeholder="AIza..."
        class={inputClass}
      />
    </div>

    <div class="rounded border border-edge bg-surface-alt p-3 text-sm text-fg-muted">
      Keys are saved automatically as you type. Only providers with keys set will appear in the
      model picker.
    </div>
  </div>

  <h2 class="mt-8 mb-2 text-xl font-medium">Storage</h2>
  {#if storageUsage}
    <div>
      <div>{storageUsage.used} MB used of {storageUsage.quota} GB quota</div>
    </div>
    <div class="mt-2 text-sm text-fg-muted">
      Chats are stored in <Link
        href="https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API">IndexedDB</Link
      >. Usage comes from
      <Link href="https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate"
        >StorageManager.estimate()</Link
      >.
    </div>
  {/if}

  <div class="mt-6">
    <a href="/" class="text-sm text-link hover:text-link-hover">← Back to Chat</a>
  </div>
</div>
