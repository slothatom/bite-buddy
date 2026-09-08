/**
 * Draws the app's icons from one description of Bandit.
 *
 * The icons used to be three separate files nobody could regenerate: a
 * favicon somebody drew, and two PNGs of the old purple blob. When the brand
 * changed they were the last thing still purple, and there was no way to
 * bring them along except by opening a drawing tool.
 *
 * So the face lives here once, as text, and the PNGs are rendered from it.
 * Run `npm run icons` after changing the mascot or the brand colour.
 *
 * Rendering is done by taking a screenshot of the SVG in the browser that is
 * already a dev dependency for the end-to-end tests, rather than adding an
 * image library to the project for three files.
 */
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(import.meta.dirname, '../public')

/** The brand, as literals. These files are read outside the document, where
 *  a CSS variable means nothing. */
const CREAM = '#faf7f0'
const BRAND = '#14b8a6'
const INK = '#2d2320'
const PAPER = '#fffdf9'
const BLUSH = '#ff8888'

/**
 * Bandit's face, filling a tile.
 *
 * His head rather than the whole of him: a standing figure in a square leaves
 * air above and below and reads as a speck on a home screen, while a face
 * fills the space and is still recognisable at the 16 pixels a browser tab
 * gives it. The ink mask is what does the work small, being the one shape
 * large enough to survive.
 *
 * `scale` shrinks the face towards the middle for the maskable icon, whose
 * corners Android is entitled to cut away.
 */
function face(scale: number): string {
  const t = `translate(32 32) scale(${scale}) translate(-32 -32)`
  /*
   * One ear, drawn on the left and mirrored for the right.
   *
   * Short and round, not pointed. Drawn as triangles first, the face read as
   * a cat: pointed ears are the single strongest cat signal there is, and a
   * raccoon's are stubby and rounded. Mirroring rather than writing the
   * second one out keeps them the same shape as the numbers get nudged.
   */
  const ear = `<g>
      <path d="M8 24 C4 15.5 6 5.5 13 4.2 C19.6 3 25.2 8.4 26.4 13 Z" fill="${INK}"/>
      <path d="M10.8 21.4 C7.9 14.6 9.5 7.8 14 7 C18.6 6.2 22.6 10.2 23.5 13.8 Z" fill="${BRAND}"/>
      <path d="M13.8 18.4 C12 14 13 10.2 15.6 9.6 C18.3 9 20.6 11.4 21.2 13.8 Z" fill="${INK}"/>
    </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" fill="${CREAM}"/>
  <g transform="${t}">
    ${ear}
    <g transform="translate(64 0) scale(-1 1)">${ear}</g>

    <ellipse cx="32" cy="33" rx="26" ry="23" fill="${INK}"/>
    <ellipse cx="32" cy="33" rx="24" ry="21" fill="${BRAND}"/>

    <path d="M7.6 28 q24.4 -11 48.8 0 q-4 12.6 -13.4 12.6 q-11.9 -5.4 -23.8 0 q-7.9 0 -11.6 -12.6 Z" fill="${INK}"/>

    <circle cx="20.5" cy="31.5" r="5" fill="${PAPER}"/>
    <circle cx="43.5" cy="31.5" r="5" fill="${PAPER}"/>
    <circle cx="21.4" cy="32.3" r="2.7" fill="${INK}"/>
    <circle cx="44.4" cy="32.3" r="2.7" fill="${INK}"/>

    <ellipse cx="12.5" cy="42" rx="4" ry="3" fill="${BLUSH}"/>
    <ellipse cx="51.5" cy="42" rx="4" ry="3" fill="${BLUSH}"/>
    <ellipse cx="32" cy="44.5" rx="11.6" ry="8.4" fill="${PAPER}"/>
    <path d="M27.4 41.8 q4.6 -3.5 9.2 0 q-4.6 4.6 -9.2 0 Z" fill="${INK}"/>
    <path d="M32 45.6 v2.2" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 47.4 q-2.6 2.6 -5.2 0" stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M32 47.4 q2.6 2.6 5.2 0" stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none"/>
  </g>
</svg>`
}

/**
 * Full bleed for the ordinary icon, and pulled in for the maskable one.
 *
 * A maskable icon is cropped to whatever shape the platform likes, and only
 * the middle 80% is guaranteed to survive. The old manifest offered the same
 * file for both, so on a phone that draws round icons the mascot lost his
 * ears. 0.72 keeps them inside the circle with room to spare.
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72 },
]

/*
 * The browser the end-to-end tests already use.
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` names it where the environment has one installed
 * outside the usual place, which is how this repo's CI and container are set
 * up. Left unset, Playwright finds its own.
 */
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
)
const page = await browser.newPage()

for (const { file, size, scale } of ICONS) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<body style="margin:0">${face(scale).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`,
  )
  const shot = await page.locator('svg').screenshot({ omitBackground: false })
  writeFileSync(resolve(OUT, file), shot)
  console.log(`${file.padEnd(24)} ${size}x${size}${scale < 1 ? `, inset to ${scale * 100}%` : ''}`)
}

// The tab icon is the same face, as vector, so it stays sharp wherever a
// browser decides to draw it.
writeFileSync(resolve(OUT, 'favicon.svg'), `${face(1)}\n`)
console.log('favicon.svg'.padEnd(24) + 'vector')

/*
 * The launch screens iOS will not work out for itself.
 *
 * Android builds one from the manifest: the name, the icon and the background
 * colour are enough. iOS wants a picture per device, matched by a media query,
 * and shows a blank white rectangle when it cannot find one, which is what
 * this app did on every launch from the home screen.
 *
 * These are the sizes of the phones somebody is plausibly holding. A device
 * that matches none of them falls back to the manifest's background colour,
 * which is the same cream, so the worst case is a plain cream screen rather
 * than a white one.
 */
const SPLASHES = [
  { w: 750, h: 1334, dw: 375, dh: 667, dpr: 2 },   // SE, 8
  { w: 828, h: 1792, dw: 414, dh: 896, dpr: 2 },   // XR, 11
  { w: 1170, h: 2532, dw: 390, dh: 844, dpr: 3 },  // 12, 13, 14
  { w: 1179, h: 2556, dw: 393, dh: 852, dpr: 3 },  // 14 Pro, 15, 16
  { w: 1242, h: 2688, dw: 414, dh: 896, dpr: 3 },  // 11 Pro Max
  { w: 1290, h: 2796, dw: 430, dh: 932, dpr: 3 },  // 14 Plus, 15 Pro Max
]

/** The face on a cream field, sized as a fraction of the shorter edge. */
function splash(w: number, h: number): string {
  const art = Math.round(Math.min(w, h) * 0.34)
  return `<div style="margin:0;width:${w}px;height:${h}px;background:${CREAM};
    display:flex;align-items:center;justify-content:center">
    ${face(1).replace('<svg ', `<svg width="${art}" height="${art}" style="border-radius:${Math.round(art * 0.24)}px" `)}
  </div>`
}

const links: string[] = []
for (const { w, h, dw, dh, dpr } of SPLASHES) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<body style="margin:0">${splash(w, h)}</body>`)
  writeFileSync(resolve(OUT, `splash-${w}x${h}.png`), await page.screenshot())
  links.push(
    `    <link rel="apple-touch-startup-image" href="splash-${w}x${h}.png"`
    + ` media="(device-width: ${dw}px) and (device-height: ${dh}px)`
    + ` and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`,
  )
  console.log(`splash-${w}x${h}.png`.padEnd(24) + `${dw}x${dh} at ${dpr}x`)
}

console.log('\nPaste into index.html if the device list changes:\n')
console.log(links.join('\n'))

await browser.close()
