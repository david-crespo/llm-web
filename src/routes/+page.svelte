<script lang="ts">
  import Sidebar from '#lib/components/Sidebar.svelte'
  import MessageList from '#lib/components/MessageList.svelte'
  import InputBar from '#lib/components/InputBar.svelte'
  import AboutModal from '#lib/components/AboutModal.svelte'
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte'
  import { initTheme } from '#lib/theme.svelte.ts'
  import {
    bootComplete,
    bootState,
    chatIdFromSearch,
    chatState,
    loadStoredHistory,
  } from '#lib/chat.svelte.ts'
  import { afterNavigate, goto } from '$app/navigation'
  import { page } from '$app/state'
  import { onMount, tick, untrack } from 'svelte'

  // Local UI state (not managed by ChatManager)
  let message = $state('')
  let inputBar = $state<InputBar>()
  let chatToDelete = $state<number | null>(null)
  let showAboutModal = $state(false)
  // The mobile composer is fixed, so the document-scrolled message list needs matching
  // bottom padding to keep the last message reachable as the textarea grows.
  let inputBarHeight = $state(0)
  let atBottom = $state(true)

  /**
   * Send message handler - clears input and delegates to ChatManager
   */
  async function handleSend() {
    const content = message
    message = '' // Clear input immediately for better UX
    await chatState.sendMessage(content)
  }

  /**
   * Fork handler - populates input with forked message content
   */
  async function handleFork(index: number) {
    const content = await chatState.fork(index)
    if (content) {
      message = content
    }
  }

  /**
   * Edit handler - pops the user message back into the input within the same chat
   */
  async function handleEdit(index: number) {
    const content = await chatState.editMessage(index)
    if (content) {
      message = content
      // Wait for the textarea to re-enable (lastMessageIsError flips) before focusing.
      await tick()
      inputBar?.focusInput()
    }
  }

  // Initialize theme on mount
  initTheme()

  // Keep the open chat in the URL so a reload reopens it (see boot). Opening
  // another chat pushes a history entry, so back returns to the previous one.
  // Leaving an entry with no chat behind it, like the bare `/` of a fresh load
  // or a chat just deleted, replaces that entry instead.
  function showCurrentInUrl() {
    const urlId = chatIdFromSearch(page.url.search)
    const { id } = chatState.current
    if (urlId === id) return
    const replace = !chatState.history.some((chat) => chat.id === urlId)
    void goto(`/?chat=${id}`, { replace, reset: false })
  }

  $effect(() => {
    if (bootState.current.status !== 'ready') return
    void chatState.current.id
    // Untracked so the effect doesn't depend on page.url. Otherwise back and
    // forward would rerun it while current is still the old chat, and it would
    // navigate back to that chat before afterNavigate opens the new one.
    untrack(showCurrentInUrl)
  })

  afterNavigate(({ type, to }) => {
    if (type !== 'popstate' || bootState.current.status !== 'ready') return
    const id = to && chatIdFromSearch(to.url.search)
    if (id && chatState.history.some((chat) => chat.id === id)) void chatState.selectChat(id)
    else showCurrentInUrl()
  })

  // Safari can discard a backgrounded tab without warning, so save the unsent
  // message when the page is hidden, and restore it on mount if the same chat
  // reopens. Clear it when the page is visible again, so a remount, like
  // returning from settings, doesn't restore a stale message.
  const DRAFT_KEY = 'unsent_message'

  function saveDraft() {
    if (bootState.current.status !== 'ready') return
    try {
      if (document.visibilityState === 'hidden' && message) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ chatId: chatState.current.id, message }))
      } else localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Storage full or unavailable; the draft is a convenience.
    }
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
      localStorage.removeItem(DRAFT_KEY)
      if (draft?.chatId === chatState.current.id) message = draft.message
    } catch {
      // Unreadable draft; start with an empty input.
    }
  }

  // Dev only: /?seed replaces sample chats in history. Production builds drop
  // the `if (seed)` branch and its import. Read at init, before the URL sync
  // replaces the query string with `?chat=<id>`.
  const seed = import.meta.env.DEV && new URLSearchParams(location.search).has('seed')

  onMount(() => {
    void (async () => {
      await bootComplete
      restoreDraft()
      await tick()
      chatState.restoreCurrentScroll()
      if (seed) {
        const { seedSampleChats } = await import('#lib/dev/seed.ts')
        await seedSampleChats()
      }
      await loadStoredHistory()
    })()
  })
</script>

<svelte:document onvisibilitychange={saveDraft} />

{#if bootState.current.status === 'error'}
  <div class="flex h-dvh items-center justify-center p-4">
    <div class="max-w-md space-y-4 text-center">
      <h1 class="text-lg font-medium text-danger">Failed to load</h1>
      <p class="text-sm text-fg-muted">{bootState.current.error || ''}</p>
      <p class="text-sm text-fg-muted">
        This can happen in private browsing mode or if storage is unavailable. Try refreshing the
        page.
      </p>
    </div>
  </div>
{:else if bootState.current.status === 'ready'}
  <div class="flex min-h-dvh overflow-x-hidden md:h-dvh md:overflow-y-hidden">
    <Sidebar
      onRequestDelete={(id) => (chatToDelete = id)}
      onOpenAbout={() => (showAboutModal = true)}
    />

    <ConfirmDialog
      open={chatToDelete !== null}
      title="Delete Chat"
      message="Are you sure you want to delete this chat? This action cannot be undone."
      cancelLabel="Cancel"
      confirmLabel="Delete"
      onCancel={() => (chatToDelete = null)}
      onConfirm={async () => {
        if (chatToDelete !== null) {
          await chatState.deleteChat(chatToDelete)
          chatToDelete = null
        }
      }}
    />

    <AboutModal open={showAboutModal} onClose={() => (showAboutModal = false)} />

    <div class="flex min-w-0 flex-1 flex-col">
      <MessageList
        composerHeight={inputBarHeight}
        onAtBottomChange={(value) => (atBottom = value)}
        onFork={handleFork}
        onEdit={handleEdit}
        onOpenAbout={() => (showAboutModal = true)}
      />

      <InputBar
        bind:this={inputBar}
        bind:message
        showJumpToBottom={!atBottom && chatState.current.messages.length > 0}
        onHeightChange={(height) => (inputBarHeight = height)}
        onSend={handleSend}
      />
    </div>
  </div>
{/if}
