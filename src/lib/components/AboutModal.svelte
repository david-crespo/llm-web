<script lang="ts">
  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    role="button"
    tabindex="0"
    aria-label="Close modal overlay"
    onclick={(e) => e.currentTarget === e.target && onClose()}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
  >
    <div class="w-96 max-w-[90vw] rounded-lg bg-white shadow-lg">
      <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h3 class="text-lg font-medium">About this app</h3>
        <button onclick={onClose} class="text-gray-400 hover:text-gray-600" aria-label="Close modal">✕</button>
      </div>
      <div class="p-6">
        <div class="mb-6 space-y-3 text-sm text-gray-600">
          <p>
            This is a fully client-side LLM chat client built as a static site with
            <a href="https://svelte.dev/docs/kit/introduction" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800" target="_blank">SvelteKit</a>.
            API keys and chat history are stored locally in this browser only. Keys are only sent to model providers.
          </p>
          <p>
            The app is designed to be hackable rather than configurable: if you want different models or different behavior, fork the repo, change how it works, and deploy your own copy.
          </p>
        </div>
        <div>
          <a href="https://github.com/david-crespo/llm-web" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800">View on GitHub →</a>
        </div>
      </div>
    </div>
  </div>
{/if}
