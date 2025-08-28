<script lang="ts">
	import Markdown from './Markdown.svelte';
	import type { ChatMessage } from './types';

	interface Props {
		message: ChatMessage;
	}

	let { message }: Props = $props();

	function formatTime(ms: number): string {
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function formatCost(cost: number): string {
		return `$${cost.toFixed(5)}`;
	}

	function formatTokens(tokens: {
		input: number;
		input_cache_hit?: number;
		output: number;
	}): string {
		const cacheHit = tokens.input_cache_hit ? ` (${tokens.input_cache_hit})` : '';
		return `${tokens.input}${cacheHit} → ${tokens.output}`;
	}
</script>

<div class="mb-6">
	{#if message.role === 'assistant'}
		<!-- Assistant message header -->
		<div class="mb-2 flex items-center gap-2 text-sm text-gray-600">
			<span class="font-medium">{message.model}</span>
			<span>•</span>
			<span>{formatTime(message.timeMs)}</span>
			<span>•</span>
			<span>{formatCost(message.cost)}</span>
			<span>•</span>
			<span>Tokens: {formatTokens(message.tokens)}</span>
			{#if message.stop_reason && !['stop', 'end_turn', 'completed'].includes(message.stop_reason.toLowerCase())}
				<span>•</span>
				<span class="text-red-600">Stop: {message.stop_reason}</span>
			{/if}
		</div>

		<!-- Reasoning (if present) -->
		{#if message.reasoning}
			<details class="mb-3">
				<summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
					Reasoning
				</summary>
				<div class="mt-2 rounded border-l-4 border-gray-300 bg-gray-50 p-3 text-sm">
					<Markdown content={message.reasoning} />
				</div>
			</details>
		{/if}
	{:else}
		<!-- User message header -->
		<div class="mb-2 text-sm text-gray-600">
			<span class="font-medium">You</span>
		</div>
	{/if}

	<!-- Message content -->
	<div class="border-l-2 border-gray-200 pl-4">
		<Markdown content={message.content} />

		{#if message.role === 'user' && message.image_url}
			<div class="mt-3">
				<img src={message.image_url} alt="" class="max-w-md rounded border" />
			</div>
		{/if}
	</div>
</div>
