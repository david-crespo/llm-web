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
				tools: [] // TODO: implement tools
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

	// Initialize on mount
	init();
</script>

<div class="flex h-screen">
	<!-- Sidebar -->
	{#if sidebarOpen}
		<div class="fixed top-0 left-0 z-10 h-full w-64 flex-col border-r border-gray-300 bg-gray-50">
			<!-- Chat history -->
			<div class="flex-1 overflow-y-auto p-4">
				<h3 class="mb-3 text-sm font-medium">Chat History</h3>
				{#if chatHistory.length === 0}
					<p class="text-xs text-gray-500">No chats yet</p>
				{:else}
					<div class="space-y-2">
						{#each chatHistory as chat}
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
						{/each}
					</div>
				{/if}
			</div>

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
	<div class="flex flex-1 flex-col {sidebarOpen ? 'ml-64' : ''}">
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

		<!-- Input area - Fixed at bottom, not affected by sidebar -->
		<div class="border-t border-gray-300 bg-white p-4">
			<div class="flex gap-2">
				<button
					onclick={toggleSidebar}
					class="rounded border border-gray-300 px-3 py-2 hover:bg-gray-50"
				>
					☰
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

				<input
					bind:value={message}
					onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
					placeholder="Type your message..."
					class="flex-1 rounded border border-gray-300 px-3 py-2"
					disabled={isLoading}
				/>

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
