import type { Chat } from './types';

// Type declarations for browser APIs
declare const indexedDB: IDBFactory;

const DB_NAME = 'llm-web';
const DB_VERSION = 1;

export interface ApiKeys {
	openai?: string;
	anthropic?: string;
	google?: string;
	groq?: string;
	deepseek?: string;
	cerebras?: string;
	xai?: string;
	openrouter?: string;
}

class Storage {
	private db: IDBDatabase | null = null;

	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (typeof indexedDB === 'undefined') {
				reject(new Error('IndexedDB is not available in this environment'));
				return;
			}

			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Chats store
				if (!db.objectStoreNames.contains('chats')) {
					const chatsStore = db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true });
					chatsStore.createIndex('createdAt', 'createdAt', { unique: false });
				}

				// API keys store
				if (!db.objectStoreNames.contains('apiKeys')) {
					db.createObjectStore('apiKeys', { keyPath: 'id' });
				}
			};
		});
	}

	private async ensureInit(): Promise<void> {
		if (!this.db) {
			await this.init();
		}
	}

	// Chat methods
	async saveChat(chat: Chat): Promise<number> {
		await this.ensureInit();
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['chats'], 'readwrite');
			const store = transaction.objectStore('chats');

			// Create a plain object copy to avoid proxy serialization issues
			const plainChat = {
				createdAt: chat.createdAt.toISOString(),
				systemPrompt: chat.systemPrompt,
				summary: chat.summary,
				messages: chat.messages
			};

			// Use JSON serialization to remove all proxy references
			const chatData = JSON.parse(JSON.stringify(plainChat));

			const request = store.put(chatData);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result as number);
		});
	}

	async updateChat(id: number, chat: Chat): Promise<void> {
		await this.ensureInit();
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['chats'], 'readwrite');
			const store = transaction.objectStore('chats');

			// Create a plain object copy to avoid proxy serialization issues
			const plainChat = {
				id,
				createdAt: chat.createdAt.toISOString(),
				systemPrompt: chat.systemPrompt,
				summary: chat.summary,
				messages: chat.messages
			};

			// Use JSON serialization to remove all proxy references
			const chatData = JSON.parse(JSON.stringify(plainChat));

			const request = store.put(chatData);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getChat(id: number): Promise<Chat | null> {
		await this.ensureInit();
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['chats'], 'readonly');
			const store = transaction.objectStore('chats');
			const request = store.get(id);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const result = request.result;
				if (result) {
					// Convert string back to Date
					result.createdAt = new Date(result.createdAt);
				}
				resolve(result || null);
			};
		});
	}

	async getAllChats(): Promise<(Chat & { id: number })[]> {
		await this.ensureInit();
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['chats'], 'readonly');
			const store = transaction.objectStore('chats');
			const index = store.index('createdAt');
			const request = index.openCursor(null, 'prev'); // Most recent first

			const results: (Chat & { id: number })[] = [];

			request.onerror = () => reject(request.error);
			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const chat = cursor.value;
					chat.createdAt = new Date(chat.createdAt);
					results.push(chat);
					cursor.continue();
				} else {
					resolve(results);
				}
			};
		});
	}

	async deleteChat(id: number): Promise<void> {
		await this.ensureInit();
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['chats'], 'readwrite');
			const store = transaction.objectStore('chats');
			const request = store.delete(id);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	// API Keys methods
	async saveApiKeys(keys: ApiKeys): Promise<void> {
		await this.ensureInit();
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['apiKeys'], 'readwrite');
			const store = transaction.objectStore('apiKeys');

			const request = store.put({ id: 'keys', ...keys });

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getApiKeys(): Promise<ApiKeys> {
		await this.ensureInit();
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['apiKeys'], 'readonly');
			const store = transaction.objectStore('apiKeys');
			const request = store.get('keys');

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const result = request.result;
				if (result) {
					// Remove the id field
					const { id, ...keys } = result;
					resolve(keys);
				} else {
					resolve({});
				}
			};
		});
	}
}

export const storage = new Storage();
