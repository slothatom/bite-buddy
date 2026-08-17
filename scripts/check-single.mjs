/**
 * Verifies the single-file build actually stands alone.
 *
 * The whole point of `dist-single/bite-buddy.html` is that it runs somewhere
 * that will not fetch subresources, so the check that matters is not "does it
 * render" but "did it ask for anything". One missed `url()` in the stylesheet
 * looks fine locally and turns into a blocked request and a fallback font on a
 * host with a strict CSP.
 *
 * Run after `npm run build:single`, or just `npm run test:single`.
 */
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { chromium } from '@playwright/test'

const ORIGIN = 'http://localhost:4321'
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

// Mirror how a host wraps a published fragment: doctype, head, body.
const fragment = readFileSync('dist-single/bite-buddy.html', 'utf8')
const document = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${fragment}</body></html>`

const server = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(document)
}).listen(4321)

const browser = await chromium.launch(executablePath ? { executablePath } : {})
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()

const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
page.on('request', (r) => {
  const url = r.url()
  if (!url.startsWith(ORIGIN) && !url.startsWith('data:')) problems.push(`external request: ${url}`)
})

const goto = async (hash = '') => {
  await page.goto(`${ORIGIN}/${hash}`)
  await page.waitForLoadState('networkidle')
}

await goto()
const heading = await page.locator('h1').first().textContent()
if (heading !== 'Your week') problems.push(`planner heading was ${JSON.stringify(heading)}`)

// The fonts are inlined as data URIs; a failed one falls back silently.
const font = await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)
if (!font.startsWith('Bungee')) problems.push(`display font did not load: ${font}`)

// Proves the bundled plan data came along rather than being fetched.
await goto('#/history')
const plans = await page.getByRole('button', { name: /^Load$/ }).count()
if (plans !== 14) problems.push(`expected 14 plans in the archive, found ${plans}`)

await goto('#/recipes')
await page.screenshot({ path: 'dist-single/preview-phone.png' })

await browser.close()
server.close()

if (problems.length) {
  console.error('Single-file build is not self-contained:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`Self-contained: ${plans} plans, fonts inlined, no external requests.`)
