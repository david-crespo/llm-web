<script lang="ts">
	import { marked } from 'marked';
	// Use highlight.js core and explicitly register only needed languages
	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';
	import typescript from 'highlight.js/lib/languages/typescript';
	import bash from 'highlight.js/lib/languages/bash';
	import rust from 'highlight.js/lib/languages/rust';

	// Register a minimal set of languages to keep bundle size small
	hljs.registerLanguage('javascript', javascript);
	hljs.registerLanguage('typescript', typescript);
	hljs.registerLanguage('bash', bash);
	hljs.registerLanguage('rust', rust);

	interface Props {
		content: string;
		class?: string;
	}

	let { content, class: className }: Props = $props();
	let html = $state('');

	let divClass = $derived(`prose prose-sm max-w-none${className ? ' ' + className : ''}`);

  // Simple highlight.js integration via custom code renderer

		// Configure marked to open links in new tabs and render
		$effect(() => {
			const renderer = new marked.Renderer();
		const originalLink = renderer.link.bind(renderer);
		renderer.link = (token) => {
			const link = originalLink(token);
			return link.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
		};


		    // Render code blocks with highlight.js
		    renderer.code = (token: any) => {
		      const lang = token.lang ?? '';
		      let inner = token.text as string;
		      try {
		        if (lang && hljs.getLanguage(lang)) inner = hljs.highlight(inner, { language: lang }).value;
		        else inner = hljs.highlightAuto(inner).value;
		      } catch {
		        inner = inner
		          .replace(/&/g, '&amp;')
		          .replace(/</g, '&lt;')
		          .replace(/>/g, '&gt;')
		          .replace(/"/g, '&quot;');
		      }
		      const cls = `hljs${lang ? ` language-${lang}` : ''}`;
		      return `<pre><code class=\"${cls}\">${inner}\n</code></pre>`;
		    };

		    (async () => {
	      html = await marked.parse(content, { renderer });
	    })();
		});
</script>

<div class={divClass}>
	{@html html}
</div>

<style>
    /* Custom styles for markdown content */
    .prose :global(pre) {
        /* Let the highlight theme style the code block visuals */
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 100%;
        white-space: pre;
        word-break: normal;
        -webkit-overflow-scrolling: touch;
        margin-bottom: 0.75rem;
    }

	.prose :global(pre:last-child) {
		margin-bottom: 0;
	}

	.prose :global(code) {
		background-color: #f1f3f4;
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-size: 0.875em;
	}

    .prose :global(pre code) {
        white-space: pre;
    }
    /* Slightly more padding for code blocks */
    .prose :global(pre code.hljs) {
      padding: 1.1em 1.25em;
    }
    /* Code block visuals: background + subtle border */
    .prose :global(pre code.hljs) {
      background-color: #f6f8fa; /* lighter than default */
      border: 1px solid #e5e7eb; /* light border */
    }
    :global(.dark .prose pre code.hljs) {
      background-color: #161b22; /* slightly lighter than main bg */
      border: 1px solid #30363d; /* subtle light border on dark */
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

	.prose :global(ul) {
		margin-bottom: 0.75rem;
		padding-left: 1.5rem;
		list-style-type: disc;
	}

	.prose :global(ol) {
		margin-bottom: 0.75rem;
		padding-left: 1.5rem;
		list-style-type: decimal;
	}

	.prose :global(ul:last-child) {
		margin-bottom: 0;
	}

	.prose :global(ol:last-child) {
		margin-bottom: 0;
	}

	.prose :global(li) {
		margin-bottom: 0.25rem;
	}

	/* Nested list styling */
	.prose :global(ul ul) {
		list-style-type: circle;
		margin-bottom: 0;
	}

	.prose :global(ul ul ul) {
		list-style-type: square;
		margin-bottom: 0;
	}

	.prose :global(ol ol) {
		list-style-type: lower-alpha;
		margin-bottom: 0;
	}

	.prose :global(ol ol ol) {
		list-style-type: lower-roman;
		margin-bottom: 0;
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

  /* Dark mode overrides for markdown (non-code elements) */
  :global(.dark .prose :not(pre) > code) {
    background-color: #0f172a;
    color: #e5e7eb;
  }
  :global(.dark .prose blockquote) {
    border-left-color: #374151; /* gray-700 */
    color: #9ca3af; /* gray-400 */
  }
  :global(.dark .prose th),
  :global(.dark .prose td) {
    border-color: #374151; /* gray-700 */
  }
  :global(.dark .prose th) {
    background-color: #111827; /* gray-900 */
  }
  :global(.dark .prose a) {
    color: #93c5fd; /* blue-300 */
  }
  :global(.dark .prose a:hover) {
    color: #bfdbfe; /* blue-200 */
  }
  /* Default to compact sizing */
  .prose :global(p),
  .prose :global(li),
  .prose :global(td),
  .prose :global(th) {
    font-size: 0.9375em;
    line-height: 1.35;
  }

  /* Inline code slightly smaller */
  .prose :global(code) {
    font-size: 0.85em;
  }

  /* Code blocks a notch smaller + tighter line-height */
  .prose :global(pre),
  .prose :global(pre code) {
    font-size: 0.9em;
    line-height: 1.3;
  }

  .prose :global(h1),
  .prose :global(h2),
  .prose :global(h3) {
    font-size: 0.95em;
  }
</style>
