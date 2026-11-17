// Render the PNG app icons in static/ from src/lib/assets/app-icon.svg.
// Run with `npm run icons` after editing the SVG.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const svg = readFileSync('src/lib/assets/app-icon.svg', 'utf8')
const sizes = { 'icon-512.png': 512, 'icon-192.png': 192, 'apple-touch-icon.png': 180 }

const browser = await chromium.launch()
for (const [file, size] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(
    `<style>body { margin: 0 } svg { display: block; width: ${size}px; height: ${size}px }</style>${svg}`,
  )
  await page.screenshot({ path: `static/${file}` })
  console.log(`wrote static/${file}`)
}
await browser.close()
