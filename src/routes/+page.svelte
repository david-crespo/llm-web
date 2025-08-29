<script lang="ts">
	import ChatMessage from '$lib/ChatMessage.svelte';
	import { storage, type ApiKeys } from '$lib/storage';
	import { models, getCost, systemBase } from '$lib/models';
	import { createMessage } from '$lib/adapters';
	import type { Chat, ChatMessage as ChatMessageType } from '$lib/types';

	let sidebarOpen = $state(false);
	let message = $state('');
	let currentChat = $state<Chat | null>(null);
	let chatHistory = $state<(Chat & { id: number })[]>([]);
	let selectedModel = $state(models.find((m) => m.default) || models[0]);
	let isLoading = $state(false);
	let webSearchEnabled = $state(false);
	let reasoningEnabled = $state(false);
	let chatToDelete = $state<number | null>(null);
	let showAboutModal = $state(false);
	let messagesContainer = $state<HTMLElement | null>(null);

	const openaiKey = localStorage.getItem('openai_api_key') || '';
	const anthropicKey = localStorage.getItem('anthropic_api_key') || '';
	const googleKey = localStorage.getItem('google_api_key') || '';
	const hasApiKeys = openaiKey || anthropicKey || googleKey;

	// Handle regeneration from a specific message
	async function handleRegen(messageIndex: number) {
		if (!currentChat || isLoading) return;

		// Find the user message to regenerate from
		const targetMessage = currentChat.messages[messageIndex];
		if (targetMessage.role !== 'user') return;

		// Create a new chat with messages up to the specified index
		const messagesUpToIndex = currentChat.messages.slice(0, messageIndex + 1);
		const truncatedChat: Chat = {
			...currentChat,
			messages: messagesUpToIndex
		};

		// Remove all messages after the specified index
		currentChat.messages = messagesUpToIndex;

		isLoading = true;

		try {
			const startTime = performance.now();
			const response = await createMessage(selectedModel.provider, {
				chat: truncatedChat,
				input: targetMessage.content,
				model: selectedModel,
				search: webSearchEnabled,
				think: reasoningEnabled
			});

			const timeMs = performance.now() - startTime;
			const cost = getCost(selectedModel, response.tokens);

			const assistantMessage: ChatMessageType = {
				role: 'assistant',
				model: selectedModel.id,
				content: response.content,
				reasoning: response.reasoning,
				tokens: response.tokens,
				stop_reason: response.stop_reason,
				cost,
				timeMs
			};

			currentChat.messages.push(assistantMessage);

			// Save updated chat
			if (currentChat.id) {
				await storage.updateChat(currentChat.id, currentChat);
			} else {
				const id = await storage.saveChat(currentChat);
				currentChat = { ...currentChat, id };
			}

			await loadChatHistory();
		} catch (error) {
			console.error('Error regenerating message:', error);
			// Add error message to chat
			const errorMessage: ChatMessageType = {
				role: 'assistant',
				model: selectedModel.id,
				content: `Error regenerating: ${error instanceof Error ? error.message : 'Unknown error'}`,
				tokens: { input: 0, output: 0 },
				stop_reason: 'error',
				cost: 0,
				timeMs: 0
			};
			currentChat.messages.push(errorMessage);
		} finally {
			isLoading = false;
		}
	}

	// Handle forking from a specific message
	async function handleFork(messageIndex: number) {
		if (!currentChat) return;

		// Find the message to fork from
		const targetMessage = currentChat.messages[messageIndex];
		if (targetMessage.role !== 'user') return;

		// Save current chat if it exists and has messages
		if (currentChat.messages.length > 0) {
			if (currentChat.id) {
				await storage.updateChat(currentChat.id, currentChat);
			} else {
				const id = await storage.saveChat(currentChat);
				currentChat = { ...currentChat, id };
			}
		}

		// Create a new chat with messages up to the specified index
		const messagesUpToIndex = currentChat.messages.slice(0, messageIndex);
		const newChat: Chat = {
			createdAt: new Date(),
			systemPrompt: currentChat.systemPrompt,
			messages: messagesUpToIndex
		};

		const id = await storage.saveChat(newChat);
		currentChat = { ...newChat, id };

		// Put the selected message content into the input field
		message = targetMessage.content;

		await loadChatHistory();
	}

	// Initialize storage and load chat history
	async function init() {
		await storage.init();
		await loadChatHistory();

		// Create new chat if none exist
		if (chatHistory.length === 0) {
			await createNewChat();
		} else {
			// Load the most recent chat
			currentChat = chatHistory[0];
		}
	}

	async function loadChatHistory() {
		chatHistory = await storage.getAllChats();
	}

	async function createNewChat() {
		// Save current chat if it exists and has messages
		if (currentChat && currentChat.messages.length > 0) {
			if (currentChat.id) {
				await storage.updateChat(currentChat.id, currentChat);
			} else {
				const id = await storage.saveChat(currentChat);
				currentChat = { ...currentChat, id };
			}
		}

		const newChat: Chat = {
			createdAt: new Date(),
			systemPrompt: systemBase,
			messages: []
		};

		const id = await storage.saveChat(newChat);
		currentChat = { ...newChat, id };
		await loadChatHistory();

		// Scroll to bottom for new chat
		setTimeout(scrollToBottom, 100);
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	async function sendMessage() {
		if (!message.trim() || !currentChat || isLoading) return;

		const userMessage: ChatMessageType = {
			role: 'user',
			content: message.trim()
		};

		currentChat.messages.push(userMessage);
		const input = message;
		message = '';
		isLoading = true;

		// Scroll to bottom after user message
		setTimeout(scrollToBottom, 100);

		try {
			const startTime = performance.now();

			const response = await createMessage(selectedModel.provider, {
				chat: currentChat,
				input,
				model: selectedModel,
				search: webSearchEnabled,
				think: reasoningEnabled
			});

			const timeMs = performance.now() - startTime;
			const cost = getCost(selectedModel, response.tokens);

			const assistantMessage: ChatMessageType = {
				role: 'assistant',
				model: selectedModel.id,
				content: response.content,
				reasoning: response.reasoning,
				tokens: response.tokens,
				stop_reason: response.stop_reason,
				cost,
				timeMs
			};

			currentChat.messages.push(assistantMessage);

			// Save updated chat
			if (currentChat.id) {
				await storage.updateChat(currentChat.id, currentChat);
			} else {
				const id = await storage.saveChat(currentChat);
				currentChat = { ...currentChat, id };
			}

			await loadChatHistory();
		} catch (error) {
			console.error('Error sending message:', error);
			// Add error message to chat
			const errorMessage: ChatMessageType = {
				role: 'assistant',
				model: selectedModel.id,
				content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				tokens: { input: 0, output: 0 },
				stop_reason: 'error',
				cost: 0,
				timeMs: 0
			};
			currentChat.messages.push(errorMessage);
		} finally {
			isLoading = false;
		}
	}

	async function selectChat(chatId: number) {
		const chat = chatHistory.find((c) => c.id === chatId);
		if (chat) {
			currentChat = chat;

			// Close the sidebar
			sidebarOpen = false;

			// Set model picker to the model from the last assistant message
			const lastAssistantMessage = chat.messages
				.slice()
				.reverse()
				.find((msg) => msg.role === 'assistant');
			if (lastAssistantMessage) {
				selectedModel = models.find((m) => m.id === lastAssistantMessage.model) || selectedModel;
			}

			// Scroll to bottom when switching chats
			setTimeout(scrollToBottom, 100);
		}
	}

	async function deleteChat(chatId: number) {
		await storage.deleteChat(chatId);
		await loadChatHistory();

		// If we deleted the current chat, select another one or create new
		if (currentChat?.id === chatId) {
			if (chatHistory.length > 0) {
				currentChat = chatHistory[0];
			} else {
				await createNewChat();
			}
		}
	}

	// Click outside handler for sidebar
	function clickOutsideSidebar(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			// Don't close sidebar if About modal is open
			if (showAboutModal) return;

			if (!node.contains(event.target as Node)) {
				sidebarOpen = false;
			}
		};

		document.addEventListener('click', handleClick, true);

		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	// Click outside handler for modals
	function clickOutsideModal(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			// Close modal if clicked on the backdrop itself (not on modal content)
			if (event.target === node) {
				showAboutModal = false;
				chatToDelete = null;
			}
		};

		document.addEventListener('click', handleClick, true);

		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	// Auto-scroll to bottom of chat
	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	// Auto-scroll when messages change
	$effect(() => {
		if (currentChat?.messages) {
			// Small delay to ensure DOM is updated
			setTimeout(scrollToBottom, 50);
		}
	});

	// Auto-scroll during streaming responses
	$effect(() => {
		if (isLoading && currentChat?.messages && currentChat.messages.length > 0) {
			const lastMessage = currentChat.messages[currentChat.messages.length - 1];
			if (lastMessage.role === 'assistant') {
				// Scroll to bottom during streaming
				scrollToBottom();
			}
		}
	});

	// Handle Gemini reasoning (always enabled)
	$effect(() => {
		if (selectedModel.provider === 'google') {
			reasoningEnabled = true;
		}
	});

	// Get excerpt of first user message for chat preview (two lines)
	function getChatPreview(chat: Chat): { line1: string; line2: string } {
		const firstUserMessage = chat.messages.find((msg) => msg.role === 'user');
		if (firstUserMessage) {
			const content = firstUserMessage.content;
			const words = content.split(' ');
			let line1 = '';
			let line2 = '';

			// Build first line (up to ~40 chars or 6 words)
			let charCount = 0;
			let wordIndex = 0;
			while (wordIndex < words.length && charCount < 40 && wordIndex < 6) {
				const word = words[wordIndex];
				if (charCount + word.length + 1 > 40) break;
				line1 += (line1 ? ' ' : '') + word;
				charCount += word.length + 1;
				wordIndex++;
			}

			// Build second line with remaining content
			if (wordIndex < words.length) {
				line2 = words.slice(wordIndex).join(' ');
				// Truncate second line if too long
				if (line2.length > 40) {
					line2 = line2.slice(0, 37) + '...';
				}
			}

			return { line1: line1 || content.slice(0, 40), line2 };
		}
		return { line1: 'New Chat', line2: '' };
	}

	// Initialize on mount
	init();
</script>

<div class="flex {sidebarOpen ? 'overflow-hidden' : ''}" style="height: 100vh; height: 100dvh;">
	<!-- Sidebar scrim -->
	{#if sidebarOpen}
		<div class="fixed inset-0 z-40 bg-black/20"></div>
	{/if}

	<!-- Sidebar -->
	{#if sidebarOpen}
		<div
			class="fixed top-0 left-0 z-50 flex w-4/5 flex-col overflow-hidden bg-gray-50"
			style="height: 100vh; height: 100dvh;"
			use:clickOutsideSidebar
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-300 p-4">
				<h3 class="text-sm font-medium">Chat History</h3>
				<button
					onclick={toggleSidebar}
					class="text-gray-500 hover:text-gray-700"
					aria-label="Close sidebar"
				>
					✕
				</button>
			</div>

			<!-- New Chat button -->
			<div class="p-4">
				<button
					onclick={createNewChat}
					class="w-full rounded-lg bg-gray-200 px-4 py-3 text-center font-medium transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					+ New Chat
				</button>
			</div>

			<!-- Chat history -->
			<div class="flex-1 overflow-y-auto px-4 pb-4">
				{#if chatHistory.length === 0}
					<p class="text-xs text-gray-500">No chats yet</p>
				{:else}
					<div class="space-y-2">
						{#each chatHistory as chat}
							{@const preview = getChatPreview(chat)}
							<div class="group rounded border border-gray-200">
								<div
									class="cursor-pointer p-3 transition-colors hover:bg-gray-100 {currentChat?.id ===
									chat.id
										? 'bg-gray-100'
										: ''}"
									role="button"
									tabindex="0"
									onclick={() => selectChat(chat.id)}
									onkeydown={(e) => e.key === 'Enter' && selectChat(chat.id)}
								>
									<div class="space-y-1">
										<div class="text-sm font-semibold text-gray-900">
											<div>{preview.line1}</div>
											{#if preview.line2}
												<div>{preview.line2}</div>
											{/if}
										</div>
									</div>
								</div>
								<div class="flex items-center justify-between border-t border-gray-200 px-3 py-2">
									<div class="text-xs text-gray-500">
										{chat.createdAt.toLocaleDateString()} • {chat.messages.length} messages
									</div>
									<button
										onclick={(e) => {
											e.stopPropagation();
											chatToDelete = chat.id;
										}}
										class="text-gray-400 hover:text-red-500"
										aria-label="Delete chat"
									>
										🗑️
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Bottom section -->
			<div class="space-y-3 border-t border-gray-300 p-4">
				<!-- API Keys link -->
				<a href="/settings" class="block text-sm text-blue-600 hover:text-blue-800">
					Configure API Keys
				</a>

				<!-- About button -->
				<button
					onclick={() => (showAboutModal = true)}
					class="block w-full text-left text-sm text-blue-600 hover:text-blue-800"
				>
					About
				</button>
			</div>
		</div>

		<!-- Delete confirmation dialog -->
		{#if chatToDelete !== null}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
				use:clickOutsideModal
			>
				<div class="w-80 rounded-lg bg-white p-6 shadow-lg">
					<h3 class="mb-4 text-lg font-medium">Delete Chat</h3>
					<p class="mb-6 text-sm text-gray-600">
						Are you sure you want to delete this chat? This action cannot be undone.
					</p>
					<div class="flex justify-end gap-3">
						<button
							onclick={() => (chatToDelete = null)}
							class="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
						>
							Cancel
						</button>
						<button
							onclick={async () => {
								if (chatToDelete !== null) {
									await deleteChat(chatToDelete);
									chatToDelete = null;
								}
							}}
							class="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
						>
							Delete
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- About modal -->
	{#if showAboutModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
			use:clickOutsideModal
		>
			<div class="w-96 max-w-[90vw] rounded-lg bg-white shadow-lg">
				<!-- Header with title and close button -->
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
					<h3 class="text-lg font-medium">About this app</h3>
					<button
						onclick={() => (showAboutModal = false)}
						class="text-gray-400 hover:text-gray-600"
						aria-label="Close modal"
					>
						✕
					</button>
				</div>

				<!-- Content -->
				<div class="p-6">
					<div class="mb-6 space-y-3 text-sm text-gray-600">
						<p>
							This is a fully client-side LLM chat client built as a static site with <a
								href="https://svelte.dev/docs/kit/introduction"
								rel="noopener noreferrer"
								class="text-blue-600 underline hover:text-blue-800"
								target="_blank">SvelteKit</a
							>. API keys and chat history are stored locally in this browser only. Keys are only
							sent to model providers.
						</p>
						<p>
							The app is designed to be hackable rather than configurable: if you want different
							models or different behavior, fork the repo, change how it works, and deploy your own
							copy.
						</p>
					</div>
					<div>
						<a
							href="https://github.com/david-crespo/llm-web"
							target="_blank"
							rel="noopener noreferrer"
							class="text-blue-600 underline hover:text-blue-800"
						>
							View on GitHub →
						</a>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Main chat area -->
	<div class="flex flex-1 flex-col overflow-x-hidden">
		<!-- Chat messages area -->
		<div class="flex-1 overflow-x-hidden overflow-y-auto p-4" bind:this={messagesContainer}>
			{#if currentChat && currentChat.messages.length > 0}
				{#each currentChat.messages as msg, index}
					<ChatMessage
						message={msg}
						messageIndex={index}
						onRegen={handleRegen}
						onFork={handleFork}
					/>
				{/each}
				{#if isLoading}
					<div class="mb-6">
						<div class="mb-2 flex items-center gap-2 text-sm text-gray-600">
							<span class="font-medium">{selectedModel.id}</span>
							<span>•</span>
							<span>Thinking...</span>
						</div>
						<div class="border-l-2 border-gray-200 pl-4">
							<div class="mb-2 h-4 w-3/4 animate-pulse rounded bg-gray-200"></div>
							<div class="h-4 w-1/2 animate-pulse rounded bg-gray-200"></div>
						</div>
					</div>
				{/if}
			{:else}
				<div class="flex h-full items-center justify-center">
					<div class="flex max-w-xs flex-col gap-2 rounded-lg p-4 text-center">
						<p class="text-lg">Start a chat below</p>
						{#if !hasApiKeys}
							<p class="text-balance text-gray-700">
								Go to <a href="/settings" class="text-blue-600 underline hover:text-blue-800"
									>settings</a
								>
								to set an OpenAI, Anthropic, or Gemini API key. Keys are stored only in the browser.
							</p>
						{/if}

						<button
							onclick={() => (showAboutModal = true)}
							class="text-sm text-blue-600 underline hover:text-blue-800"
						>
							About this app
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input area - Fixed at bottom, above sidebar -->
		<div class="relative z-20 border-t border-gray-300 bg-white p-4">
			<!-- Text input at top -->
			<div class="mb-3">
				<textarea
					bind:value={message}
					onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
					placeholder="Type your message..."
					class="w-full resize-none rounded border border-gray-300 px-3 py-2"
					rows="3"
					disabled={isLoading}
				></textarea>
			</div>

			<!-- Button row -->
			<div class="flex items-center gap-2">
				<button
					onclick={toggleSidebar}
					class="rounded border border-gray-300 px-3 py-2 hover:bg-gray-50"
				>
					{sidebarOpen ? '✕' : '☰'}
				</button>

				<!-- Spacer to push controls to the right -->
				<div class="flex-1"></div>

				<!-- Model selector -->
				<select
					bind:value={selectedModel}
					class="w-36 rounded border border-gray-300 px-2 py-2 text-sm"
				>
					{#each models as model}
						<option value={model}>
							{model.id}
						</option>
					{/each}
				</select>

				<!-- Web Search Toggle Button -->
				<button
					onclick={() => (webSearchEnabled = !webSearchEnabled)}
					class="rounded border px-2 py-2 text-sm transition-colors {webSearchEnabled
						? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
						: 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}"
					title="Web Search"
				>
					🌐
				</button>

				<!-- Reasoning Toggle Button -->
				<button
					onclick={() => {
						if (selectedModel.provider !== 'google') {
							reasoningEnabled = !reasoningEnabled;
						}
					}}
					class="rounded border px-2 py-2 text-sm transition-colors {selectedModel.provider ===
					'google'
						? 'border-blue-300 bg-blue-300 text-white'
						: reasoningEnabled
							? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
							: 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}"
					title={selectedModel.provider === 'google'
						? 'Reasoning (always enabled for Gemini)'
						: 'Reasoning'}
					disabled={selectedModel.provider === 'google'}
				>
					🤔
				</button>

				<button
					onclick={sendMessage}
					disabled={isLoading || !message.trim()}
					class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
				>
					{isLoading ? 'Sending...' : 'Send'}
				</button>
			</div>
		</div>
	</div>
</div>
