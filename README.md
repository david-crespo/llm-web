# llm-web

An aggressively minimalist mobile web LLM client built as a static site with [SvelteKit](https://svelte.dev/docs/kit/introduction).

<p float="left">
  <img src="https://github.com/user-attachments/assets/a1bbfce0-cf25-4628-bbd8-93e1163a1262" width="393" />

  <img src="https://github.com/user-attachments/assets/f86b78ad-c312-40e7-94fd-40832e801ea9" width="393" />

</p>

## Features

- Good on mobile (don't care about desktop)
- Static site: trivial to deploy
- Hackable rather than configurable: fork it and deploy your own copy
- Pretty markdown rendering with syntax highlighting for code blocks
- Show cost and token counts for every response
- SOTA models only (latest Gemini, GPT, and Claude)
- One click to toggle search and extra thinking
- Bring your own API keys
- Keys and chats are stored client-side (and only sent directly to the LLM provider from the browser) so anyone can enter keys and use it
- Fork chat to retry with another model
- Dark/light mode

### Non-features

- Cross-device syncing
- Memory across chats
- Image uploads or image generation
- Voice chat
- Streaming responses (will probably get to this eventually)

## Why

I use LLMs a lot, but mostly through my [LLM
CLI](https://github.com/david-crespo/llm-cli), so I am used to a pretty
stripped-down user experience. All I want from a mobile client is to support
the major labs, let me use API keys, and leave me alone. On my phone, I'm
usually looking something up, so I almost always want search. I only use the
good models, and I like to compare them. I like to use usage-based pricing with
API keys rather than subscribing to all the major labs, and I like to see the
cost and token counts for every API call. Finally, I want this to be trivial for
other people to either use directly or host themselves.

This site accomplishes all that, and I am not aware of any other web LLM
client that does. The only way I could think of to do this is to store the
API keys and chat history client-side. This has some downsides (see below),
but I really don't think it's too bad. The advantage is that anyone can go to
https://llm-web-spa.netlify.app, enter an API key, and use the app exactly like
I do. And if you don't trust that what's deployed matches what's here (why would
you), you can fork this repo and deploy your own copy in a matter of minutes.

If there was an iOS app that worked like this, I would probably pay $20 for it.
But I have not be able to find one that was simple enough and wasn't trying to
sell me a subscription. I considered writing one myself, but getting it on the App Store seemed like a huge hassle. Plus I am a web developer.

## On the XSS question

Storing API keys in localStorage and rendering LLM output as HTML creates
[XSS](https://en.wikipedia.org/wiki/Cross-site_scripting) risk. You should only
use this app if you understand what that means and buy the argument here that
the risk is low. The mitigations in place are:

- **Content Security Policy**: Hash-based CSP in `svelte.config.js` prevents
  inline script execution and restricts `connect-src` to the three LLM
  API endpoints. See security headers in `static/_headers` include
  frame-ancestors restrictions, HSTS, and cross-origin policies.

- **DOMPurify sanitization**: Markdown rendering goes through
  [DOMPurify](https://github.com/cure53/DOMPurify) with a strict config that
  forbids dangerous tags (style, iframe, object, embed, form, input, button) and
  restricts URLs to https/mailto/tel schemes and root-relative paths.

- **Minimal attack surface**: The main avenue for attack is a malicious
  dependency. Having a small number of runtime deps and no server-side code means
  fewer potential vulnerabilities. The attack surface is limited to the browser
  sandbox with CSP enforcement.

These layers make XSS difficult but not impossible.

## Built with LLMs

Most of the code was written by LLMs. You can see from the commit history that
it has been a fairly involved iterative process, but I did not physically type
most of the code. I don't really know Svelte at all, and I figured building
a real app with it might help. I'm not sure that it did, but it has been fun
anyway.

## Setup

- Dev: `bun install` and `bun run dev`
- Build: `bun run build`
- Preview: `bun run preview`
- Deploy: `bun run deploy` (builds static files to `build/` directory)

There's nothing Bun-specific here, so these work equally well with `npm`.

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
