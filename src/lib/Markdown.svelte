<script lang="ts">
	import { marked } from 'marked';

	interface Props {
		content: string;
		class?: string;
	}

	let { content, class: className }: Props = $props();
	let html = $state('');

	let divClass = $derived(`prose prose-sm max-w-none${className ? ' ' + className : ''}`);

	// Configure marked to open links in new tabs
	$effect(() => {
		// Configure marked renderer to add target="_blank" to links
		const renderer = new marked.Renderer();
		const originalLink = renderer.link.bind(renderer);
		renderer.link = (token) => {
			const link = originalLink(token);
			return link.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
		};

		html = marked.parse(content, { renderer }) as string;
	});
</script>

<div class={divClass}>
	{@html html}
</div>

<style>
	/* Custom styles for markdown content */
	.prose :global(pre) {
		background-color: #f8f9fa;
		border-radius: 6px;
		padding: 1rem;
		overflow-x: auto;
		max-width: 100%;
		word-wrap: break-word;
		white-space: pre-wrap;
	}

	.prose :global(code) {
		background-color: #f1f3f4;
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-size: 0.875em;
	}

	.prose :global(pre code) {
		background-color: transparent;
		padding: 0;
	}

	.prose :global(blockquote) {
		border-left: 4px solid #e5e7eb;
		padding-left: 1rem;
		margin: 1rem 0;
		color: #6b7280;
	}

	.prose :global(blockquote:last-child) {
		margin-bottom: 0;
	}

	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5),
	.prose :global(h6) {
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
		font-weight: 600;
	}

	.prose :global(p) {
		margin-bottom: 0.75rem;
	}

	.prose :global(p:last-child) {
		margin-bottom: 0;
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin-bottom: 0.75rem;
		padding-left: 1.5rem;
	}

	.prose :global(ul:last-child),
	.prose :global(ol:last-child) {
		margin-bottom: 0;
	}

	.prose :global(li) {
		margin-bottom: 0.25rem;
	}

	.prose :global(table) {
		border-collapse: collapse;
		width: 100%;
		margin-bottom: 1rem;
		max-width: 100%;
		overflow-x: auto;
		display: block;
	}

	.prose :global(table:last-child) {
		margin-bottom: 0;
	}

	.prose :global(th),
	.prose :global(td) {
		border: 1px solid #e5e7eb;
		padding: 0.5rem;
		text-align: left;
	}

	.prose :global(th) {
		background-color: #f9fafb;
		font-weight: 600;
	}

	.prose :global(a) {
		color: #2563eb;
		text-decoration: underline;
	}

	.prose :global(a:hover) {
		color: #1d4ed8;
	}
</style>
