<script lang="ts">
  import { settings } from '$lib/settings.svelte'

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
</script>

<div class="mx-auto max-w-md p-4">
  <h1 class="mb-4 text-xl font-medium">API Keys</h1>

  <div class="space-y-4">
    <div>
      <label for="openai-key" class="mb-1 block text-sm font-medium">OpenAI</label>
      <input
        id="openai-key"
        bind:value={settings.openaiKey}
        placeholder="sk-..."
        class={inputClass}
      />
    </div>

    <div>
      <label for="anthropic-key" class="mb-1 block text-sm font-medium">Anthropic</label>
      <input
        id="anthropic-key"
        bind:value={settings.anthropicKey}
        placeholder="sk-ant-..."
        class={inputClass}
      />
    </div>

    <div>
      <label for="google-key" class="mb-1 block text-sm font-medium">Gemini</label>
      <input
        id="google-key"
        bind:value={settings.googleKey}
        placeholder="AIza..."
        class={inputClass}
      />
    </div>

    <div
      class="rounded border border-gray-300 bg-gray-100 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
    >
      Keys are saved automatically as you type. Only providers with keys set will appear in the
      model picker.
    </div>
  </div>

  <div class="mt-6">
    <a href="/" class="text-sm text-blue-600 hover:text-blue-800">← Back to Chat</a>
  </div>
</div>
