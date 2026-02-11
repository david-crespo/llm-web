import { SvelteMap } from 'svelte/reactivity'

const PROVIDERS = ['openai', 'anthropic', 'google'] as const
export type Provider = (typeof PROVIDERS)[number]

const apiKeys = new SvelteMap<Provider, string>(
  PROVIDERS.map((p) => [p, localStorage.getItem(`${p}_api_key`) ?? '']),
)

export const settings = {
  getKey(provider: Provider): string {
    return apiKeys.get(provider) ?? ''
  },

  setKey(provider: Provider, value: string) {
    apiKeys.set(provider, value)
    if (value) {
      localStorage.setItem(`${provider}_api_key`, value)
    } else {
      localStorage.removeItem(`${provider}_api_key`)
    }
  },
}
