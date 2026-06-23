import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from '@google/genai'
import type { ChatInput, ModelResponse } from './index'
import { settings } from '$lib/settings.svelte'
import { NonDurableAdapter } from './non-durable'

// Gemini's server-side background API (Interactions) is unusable from the
// browser: the SDK sends an `Api-Revision` request header that the CORS endpoint
// rejects, so every preflight fails. See:
// https://github.com/googleapis/js-genai/issues/1723
// So we use the synchronous generateContent call through NonDurableAdapter. The
// handle only points at an in-memory promise; after reload, the turn is
// interrupted. Because the whole history is resent each turn, there's no
// chaining handle to store (no ProviderData), same as Anthropic.

function getClient(): GoogleGenAI {
  const apiKey = settings.getKey('google')
  if (!apiKey) throw new Error('Gemini API key not found')
  return new GoogleGenAI({ apiKey })
}

export class GoogleAdapter extends NonDurableAdapter {
  constructor() {
    super('google')
  }

  protected create({ chat, model, search, think, signal }: ChatInput): Promise<ModelResponse> {
    const genAI = getClient()

    return genAI.models
      .generateContent({
        config: {
          thinkingConfig: {
            thinkingLevel: think ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
          },
          systemInstruction: chat.systemPrompt,
          tools: [{ urlContext: {} }, ...(search ? [{ googleSearch: {} }] : [])],
          abortSignal: signal,
        },
        model: model.key,
        contents: chat.messages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
      })
      .then(parseResponse)
  }
}

function parseResponse(result: GenerateContentResponse): ModelResponse {
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
  const searches = searchResults && searchResults.length > 0 ? 1 : 0
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
    searches: searches || undefined,
  }
}
