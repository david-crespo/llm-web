<script lang="ts">
  let openaiKey = $state('')
  let anthropicKey = $state('')
  let googleKey = $state('')
  let saveStatus = $state('')

  // Load existing keys on mount
  async function loadKeys() {
    openaiKey = localStorage.getItem('openai_api_key') || ''
    anthropicKey = localStorage.getItem('anthropic_api_key') || ''
    googleKey = localStorage.getItem('google_api_key') || ''
  }

  async function saveKeys() {
    try {
      // Save to localStorage
      if (openaiKey) localStorage.setItem('openai_api_key', openaiKey)
      else localStorage.removeItem('openai_api_key')

      if (anthropicKey) localStorage.setItem('anthropic_api_key', anthropicKey)
      else localStorage.removeItem('anthropic_api_key')

      if (googleKey) localStorage.setItem('google_api_key', googleKey)
      else localStorage.removeItem('google_api_key')

      saveStatus = 'Keys saved successfully!'
      setTimeout(() => (saveStatus = ''), 3000)
    } catch (error) {
      saveStatus = 'Error saving keys'
      console.error('Error saving keys:', error)
    }
  }

  // Load keys on mount
  loadKeys()
</script>

<div class="mx-auto max-w-md p-4">
  <h1 class="mb-4 text-xl font-medium">API Keys</h1>

  {#if saveStatus}
    <div
      class="mb-4 rounded p-3 {saveStatus.includes('Error')
        ? 'bg-red-100 text-red-800'
        : 'bg-green-100 text-green-800'}"
    >
      {saveStatus}
    </div>
  {/if}

  <div class="space-y-4">
    <div>
      <label for="openai-key" class="mb-1 block text-sm font-medium">OpenAI API Key</label>
      <input
        id="openai-key"
        bind:value={openaiKey}
        placeholder="sk-..."
        class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
    </div>

    <div>
      <label for="anthropic-key" class="mb-1 block text-sm font-medium">Anthropic API Key</label>
      <input
        id="anthropic-key"
        bind:value={anthropicKey}
        placeholder="sk-ant-..."
        class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
    </div>

    <div>
      <label for="google-key" class="mb-1 block text-sm font-medium">Gemini API Key</label>
      <input
        id="google-key"
        bind:value={googleKey}
        placeholder="AIza..."
        class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
    </div>

    <button
      onclick={saveKeys}
      class="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
    >
      Save Keys
    </button>

    <div
      class="rounded border border-gray-300 bg-gray-100 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
    >
      Only providers with keys set will appear in the model picker.
    </div>
  </div>

  <div class="mt-6">
    <a href="/" class="text-sm text-blue-600 hover:text-blue-800">← Back to Chat</a>
  </div>
</div>
