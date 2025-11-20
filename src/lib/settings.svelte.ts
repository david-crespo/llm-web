let _openaiKey = $state(localStorage.getItem('openai_api_key') || '')
let _anthropicKey = $state(localStorage.getItem('anthropic_api_key') || '')
let _googleKey = $state(localStorage.getItem('google_api_key') || '')

export const settings = {
  get openaiKey() {
    return _openaiKey
  },

  set openaiKey(value: string) {
    _openaiKey = value
    if (value) {
      localStorage.setItem('openai_api_key', value)
    } else {
      localStorage.removeItem('openai_api_key')
    }
  },

  get anthropicKey() {
    return _anthropicKey
  },
  set anthropicKey(value: string) {
    _anthropicKey = value
    if (value) {
      localStorage.setItem('anthropic_api_key', value)
    } else {
      localStorage.removeItem('anthropic_api_key')
    }
  },

  get googleKey() {
    return _googleKey
  },
  set googleKey(value: string) {
    _googleKey = value
    if (value) {
      localStorage.setItem('google_api_key', value)
    } else {
      localStorage.removeItem('google_api_key')
    }
  },

  getKey(provider: string): string | null {
    switch (provider) {
      case 'openai':
        return this.openaiKey || null
      case 'anthropic':
        return this.anthropicKey || null
      case 'google':
        return this.googleKey || null
      default:
        return null
    }
  },
}
