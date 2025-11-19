import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import type { ChatInput, ModelResponse } from './index'

export async function geminiCreateMessage({
  chat,
  model,
  search,
  think,
}: ChatInput): Promise<ModelResponse> {
  const apiKey = localStorage.getItem('google_api_key')
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
    .filter((p) => (p as any).text && (p as any).thought)
    .map((p: any) => p.text as string)
    .join('\n\n')
  let content = parts
    .filter((p) => (p as any).text && !(p as any).thought)
    .map((p: any) => p.text as string)
    .join('\n\n')

  const searchResults = (result.candidates?.[0] as any).groundingMetadata?.groundingChunks
  const searchResultsMd = searchResults
    ? '\n\n### Sources\n\n' +
      searchResults
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => `- [${chunk.web!.title}](${chunk.web!.uri})`)
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
    stop_reason: (result.candidates?.[0] as any).finishReason || '',
  }
}
