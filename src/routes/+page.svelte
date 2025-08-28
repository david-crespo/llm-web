<script lang="ts">
	import ChatMessage from '$lib/ChatMessage.svelte';
	import { storage } from '$lib/storage';
	import { models, resolveModel, getCost, systemBase } from '$lib/models';
	import { createMessage } from '$lib/adapters';
	import type { Chat, ChatMessage as ChatMessageType } from '$lib/types';

	let sidebarOpen = $state(false);
	let message = $state('');
	let currentChat = $state<Chat | null>(null);
	let chatHistory = $state<(Chat & { id: number })[]>([]);
	let selectedModel = $state(models.find((m) => m.default) || models[0]);
	let isLoading = $state(false);
	let webSearchEnabled = $state(false);
	let reasoningEffort = $state<'none' | 'low' | 'medium' | 'high'>('low');
	let showPopover = $state(false);
	let chatToDelete = $state<number | null>(null);

	// Initialize storage and load chat history
	async function init() {
		await storage.init();
		await loadChatHistory();

		// Create new chat if none exists
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

		try {
			const startTime = performance.now();

			const response = await createMessage(selectedModel.provider, {
				chat: currentChat,
				input,
				model: selectedModel,
				search: webSearchEnabled,
				think: reasoningEffort
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

	// Click outside handler for popover
	function clickOutside(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			if (!node.contains(event.target as Node)) {
				showPopover = false;
			}
		};

		document.addEventListener('click', handleClick, true);

		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	// Initialize on mount
	init();
</script>

<div class="flex h-screen">
	<!-- Sidebar -->
	{#if sidebarOpen}
		<div class="fixed top-0 left-0 z-10 h-full w-64 flex-col border-r border-gray-300 bg-gray-50">
			<!-- Header with close button -->
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
			<!-- Chat history -->
			<div class="flex-1 overflow-y-auto p-4">
				<h3 class="mb-3 text-sm font-medium">Chat History</h3>
				{#if chatHistory.length === 0}
					<p class="text-xs text-gray-500">No chats yet</p>
				{:else}
					<div class="space-y-2">
						{#each chatHistory as chat}
							<div class="group relative">
								<div
									class="cursor-pointer rounded p-2 transition-colors hover:bg-gray-200 {currentChat?.id ===
									chat.id
										? 'bg-gray-200'
										: ''}"
									role="button"
									tabindex="0"
									onclick={() => selectChat(chat.id)}
									onkeydown={(e) => e.key === 'Enter' && selectChat(chat.id)}
								>
									<div class="truncate text-xs font-medium">
										{chat.summary || 'Untitled Chat'}
									</div>
									<div class="text-xs text-gray-500">
										{chat.createdAt.toLocaleDateString()} • {chat.messages.length} messages
									</div>
									{#if chat.messages.length > 0}
										<div class="mt-1 truncate text-xs text-gray-400">
											{chat.messages[chat.messages.length - 1].content.slice(0, 40)}...
										</div>
									{/if}
								</div>
								<button
									onclick={(e) => {
										e.stopPropagation();
										chatToDelete = chat.id;
									}}
									class="absolute top-2 right-2 text-gray-400 opacity-100 hover:text-red-500"
									aria-label="Delete chat"
								>
									🗑️
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Delete confirmation dialog -->
			{#if chatToDelete !== null}
				<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
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

			<!-- Bottom section -->
			<div class="space-y-3 border-t border-gray-300 p-4">
				<!-- New Chat button -->
				<button
					onclick={createNewChat}
					class="w-full text-left text-sm text-blue-600 hover:text-blue-800"
				>
					+ New Chat
				</button>

				<!-- API Keys link -->
				<a href="/settings" class="block text-sm text-blue-600 hover:text-blue-800"> API Keys </a>
			</div>
		</div>
	{/if}

	<!-- Main chat area -->
	<div class="flex flex-1 flex-col">
		<!-- Chat messages area -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if currentChat}
				{#each currentChat.messages as msg}
					<ChatMessage message={msg} />
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

				<!-- Model selector -->
				<select
					bind:value={selectedModel}
					class="min-w-0 rounded border border-gray-300 px-2 py-2 text-sm"
				>
					{#each models as model}
						<option value={model}>
							{model.id}
						</option>
					{/each}
				</select>

				<!-- Popover menu button -->
				<div class="relative" use:clickOutside={() => (showPopover = false)}>
					<button
						onclick={() => (showPopover = !showPopover)}
						class="rounded border border-gray-300 px-2 py-2 text-sm hover:bg-gray-50"
					>
						⚙️
					</button>

					<!-- Popover -->
					{#if showPopover}
						<div
							class="absolute right-0 bottom-full z-30 mb-2 w-48 rounded border border-gray-300 bg-white p-3 shadow-lg"
						>
							<div class="space-y-3">
								<!-- Web Search Toggle -->
								<label class="flex items-center gap-2 text-sm">
									<input type="checkbox" bind:checked={webSearchEnabled} class="rounded" />
									Web Search
								</label>

								<!-- Reasoning Effort -->
								<div>
									<label class="mb-1 block text-sm font-medium">Reasoning Effort</label>
									<select
										bind:value={reasoningEffort}
										class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
									>
										<option value="none">None</option>
										<option value="low">Low</option>
										<option value="medium">Medium</option>
										<option value="high">High</option>
									</select>
								</div>
							</div>
						</div>
					{/if}
				</div>

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
