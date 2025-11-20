import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import type { ChatInput, ModelResponse } from './index'
import { settings } from '$lib/settings.svelte'

export async function geminiCreateMessage({
  chat,
  model,
  search,
  think,
}: ChatInput): Promise<ModelResponse> {
  const apiKey = settings.googleKey
  if (!apiKey) throw new Error('Gemini API key not found')

  const genAI = new GoogleGenAI({ apiKey })

  const result = await genAI.models.generateContent({
    config: {
      thinkingConfig: {
        thinkingLevel: think ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
      },
      systemInstruction: chat.systemPrompt,
      tools: [{ urlContext: {} }, ...(search ? [{ googleSearch: {} }] : [])],
    },
    model: model.key,
    contents: chat.messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
  })

  const parts = result.candidates?.[0].content?.parts ?? []
  const reasoning = parts
    .filter((p) => p.text && p.thought)
    .map((p) => p.text!)
    .join('\n\n')
  let content = parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text!)
    .join('\n\n')

  const searchResults = result.candidates?.[0]?.groundingMetadata?.groundingChunks
  const searchResultsMd = searchResults
    ? '\n\n### Sources\n\n' +
      searchResults
        .filter((chunk) => chunk.web)
        .map((chunk) => `- [${chunk.web!.title}](${chunk.web!.uri})`)
        .join('\n')
    : ''

  content += searchResultsMd

  const tokens = {
    input: result.usageMetadata?.promptTokenCount || 0,
    output:
      (result.usageMetadata?.candidatesTokenCount || 0) +
      (result.usageMetadata?.thoughtsTokenCount || 0),
    input_cache_hit: result.usageMetadata?.cachedContentTokenCount || 0,
  }

  return {
    content,
    reasoning,
    tokens,
    stop_reason: result.candidates?.[0]?.finishReason || '',
  }
}
