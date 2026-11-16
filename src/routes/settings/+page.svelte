<script lang="ts">
  import { onMount } from 'svelte'
  import Link from '#lib/components/Link.svelte'
  import { settings } from '#lib/settings.svelte.ts'
  import { storage } from '#lib/storage.ts'
  import { backupFileName, parseBackup, planImport, toBackupJson } from '#lib/backup.ts'

  const inputClass = 'w-full rounded border border-edge bg-surface-elevated px-3 py-2 text-fg'
  const buttonClass =
    'rounded border border-edge bg-surface-alt px-3 py-2 text-sm text-fg hover:bg-surface-hover'

  let backupStatus = $state<{ text: string; error: boolean } | null>(null)

  async function exportChats() {
    backupStatus = null
    const chats = await storage.getAllChats()
    const file = new File([toBackupJson(chats)], backupFileName(), { type: 'application/json' })
    // A home-screen app on iOS has nowhere to download to, so phones get the
    // share sheet, which has Save to Files.
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // A download has nowhere to go here, so don't fall back to one. This
        // happens when the tap's activation expired during the database read,
        // or a share sheet is already open.
        backupStatus = { text: "Couldn't open the share sheet. Tap Export again.", error: true }
      }
      return
    }
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function importChats(input: HTMLInputElement) {
    const file = input.files?.[0]
    input.value = '' // so picking the same file again still fires change
    if (!file) return
    try {
      const imported = parseBackup(await file.text())
      const { added, updated } = planImport(await storage.getAllChats(), imported)
      await storage.saveImport(added, updated)
      const chats = (n: number) => `${n} ${n === 1 ? 'chat' : 'chats'}`
      const unchanged = imported.length - added.length - updated.length
      backupStatus = {
        text: [
          `Added ${chats(added.length)}`,
          updated.length > 0 && `updated ${updated.length} with newer messages`,
          unchanged > 0 && `${unchanged} already up to date`,
        ]
          .filter(Boolean)
          .join(', ') + '.',
        error: false,
      }
    } catch (error) {
      backupStatus = {
        text: error instanceof Error ? error.message : 'Import failed.',
        error: true,
      }
    }
  }

  let storageUsage = $state<{ used: string; quota: string } | null>(null)

  onMount(() => {
    // Not every browser has the Storage API — notably the Linux WebKit build
    // Playwright runs in CI — and throwing here would take the whole app down
    // through the error page. Without it, usage is just hidden.
    void navigator.storage?.estimate().then((estimate) => {
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

  <h2 class="mt-8 mb-2 text-xl font-medium">Chats</h2>
  <div class="flex gap-2">
    <button class={buttonClass} onclick={exportChats}>Export</button>
    <!-- No accept filter: iOS maps it to file types, and a JSON file that went
         through the share sheet may not be typed as one. Import checks the
         contents instead. -->
    <label class={[buttonClass, 'cursor-pointer focus-within:ring-2']}>
      Import
      <input type="file" class="sr-only" onchange={(e) => importChats(e.currentTarget)} />
    </label>
  </div>
  {#if backupStatus}
    <div class={['mt-2 text-sm', backupStatus.error ? 'text-danger' : 'text-fg-muted']}>
      {backupStatus.text}
    </div>
  {/if}
  <div class="mt-2 text-sm text-fg-muted">
    Export saves every chat to a JSON file, without API keys. Import adds the chats from an
    export that aren't already here, and updates ones that have newer messages in the file. Use
    it to move your history to the home-screen app, which has its own storage on iOS.
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
