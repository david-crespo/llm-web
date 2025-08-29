# llm-web

I got frustrated with the iOS app I use to hit LLM APIs, and while I see lots of good web apps online, none is quite what I'm looking for. So I guess I'm writing my own. Not coincidentally, LLMs make this a pretty light lift to build.

## Setup

- Dev: `bun install` and `bun run dev`
- Build: `bun run build`
- Preview: `bun run preview`
- Deploy: `bun run deploy` (builds static files to `build/` directory)

## Deployment

The app builds to a static site that can be deployed anywhere:

1. `bun run build` - Creates static files in `build/` directory
2. Upload the contents of `build/` to any static hosting service
3. No server required - everything runs client-side

### Hosting Options

- **GitHub Pages**: Upload `build/` contents
- **Netlify**: Connect repo and set build command to `bun run build`
- **Vercel**: Connect repo and set build command to `bun run build`
- **Any static host**: AWS S3, Cloudflare Pages, etc.

## Design

A very light LLM client like my [LLM CLI](https://github.com/david-crespo/llm-cli).

- [x] A static site, therefore trivial to host
- [x] Works well on mobile (don't even care if it's usable on bigger screens)
- [x] GPT-5, Claude Sonnet 4, Opus 4, and Gemini Pro
- [x] API keys set client-side
- [x] Chats stored client-side
- [ ] Model picker, model can be changed for each message in a chat
- [ ] Reasoning effort picker
- [x] Web search toggle
- [x] Everything that doesn't need to change per-chat should be hard-coded, like it is in my [CLI](https://github.com/david-crespo/llm-cli/blob/b9147829379257d726a93282cb0bee0595c28dc1/adapters.ts#L34-L41)
  - Per-model configuration and logic
  - System prompt
- [x] Fork chat from a given message to allow re-running with a different model but preserving previews chat
  - Fork action on user message prompts for new model, starts a new chat, and regens with new model
  - Fork action on assistant message just starts a new chat
- [x] Every bot message remembers the model that generated it
- [ ] Streaming when possible (i.e., not GPT-5)
- [ ] Render markdown output
- [ ] Disable models for provider if API key is missing
- [ ] Dark mode (dark/light/system)

### Nice to haves

- [ ] Expandable reasoning trace
- [ ] Images upload

## Implementation plan

- SvelteKit SPA
- IndexedDB for chats, persistent parts of UI state, probably API keys
