<script lang="ts">
  interface Props {
    open: boolean
    title?: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void | Promise<void>
    onCancel: () => void
  }

  let {
    open,
    title = 'Confirm',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
  }: Props = $props()
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    role="button"
    tabindex="0"
    aria-label="Close dialog overlay"
    onclick={(e) => e.currentTarget === e.target && onCancel()}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onCancel()}
  >
    <div class="w-80 rounded-lg bg-white p-6 shadow-lg">
      <h3 class="mb-4 text-lg font-medium">{title}</h3>
      <p class="mb-6 text-sm text-gray-600">{message}</p>
      <div class="flex justify-end gap-3">
        <button
          onclick={onCancel}
          class="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >{cancelLabel}</button
        >
        <button
          onclick={onConfirm}
          class="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >{confirmLabel}</button
        >
      </div>
    </div>
  </div>
{/if}
