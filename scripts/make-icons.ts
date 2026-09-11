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
 * Every file it writes carries a hash of its own contents in its name, and
 * `src/generated/icons.ts` records what those names are. That is the fix for
 * a specific failure: `icon-192.png` has been three different pictures over
 * this app's life, all at one address, and a home screen has no way to learn
 * that an address it already has means something new. iOS reads the icon once
 * when you add the app and keeps it; Android keeps its own copy; and a
 * service worker precaches by URL. A new brand shipped and phones went on
 * drawing the old blob. A name that changes with the picture cannot do that.
 *
 * Rendering is done by taking a screenshot of the SVG in the browser that is
 * already a dev dependency for the end-to-end tests, rather than adding an
 * image library to the project for three files.
 */
import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(import.meta.dirname, '../public')
const GENERATED = resolve(import.meta.dirname, '../src/generated/icons.ts')

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
 *
 * `ground` draws the cream tile behind him. The PNGs need it: iOS composites
 * a transparent icon onto black rather than honouring it, and a maskable icon
 * has to bleed to its own edges or the platform's crop shows through. The tab
 * icon is the opposite case - it is drawn onto chrome whose colour is not ours
 * to guess, so a tile there is a cream box sitting on somebody's dark title
 * bar.
 */
function face(scale: number, ground = true): string {
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
${ground ? `  <rect width="64" height="64" fill="${CREAM}"/>\n` : ''}  <g transform="${t}">
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

/** Eight characters of the contents, which is what makes the name honest. */
function stamp(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 8)
}

/**
 * Everything this script has ever written, gone before it writes again.
 *
 * Without this, hashed names accumulate: every brand change would leave its
 * predecessor in `public/`, shipped to every device forever because no build
 * step knows which of nine PNGs is the current one. The generated module
 * below is the only record of what is current, so anything not about to be
 * named in it has no business being deployed.
 */
function clearOldArtwork(): void {
  const mine = /^(icon-|splash-|favicon)/
  for (const name of readdirSync(OUT)) {
    if (mine.test(name)) unlinkSync(resolve(OUT, name))
  }
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
  { stem: 'icon-192', size: 192, scale: 1 },
  { stem: 'icon-512', size: 512, scale: 1 },
  { stem: 'icon-maskable-512', size: 512, scale: 0.72, purpose: 'maskable' },
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

clearOldArtwork()

const iconLines: string[] = []
let appleTouch = ''
for (const { stem, size, scale, purpose } of ICONS) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<body style="margin:0">${face(scale).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`,
  )
  const shot = await page.locator('svg').screenshot({ omitBackground: false })
  const file = `${stem}.${stamp(shot)}.png`
  writeFileSync(resolve(OUT, file), shot)
  if (stem === 'icon-192') appleTouch = file
  iconLines.push(
    `  { src: '${file}', sizes: '${size}x${size}', type: 'image/png'`
    + `${purpose ? `, purpose: '${purpose}'` : ''} },`,
  )
  console.log(`${file.padEnd(34)} ${size}x${size}${scale < 1 ? `, inset to ${scale * 100}%` : ''}`)
}

// The tab icon is the same face, as vector, so it stays sharp wherever a
// browser decides to draw it, and without the cream tile so it sits on the
// tab or title bar's own colour instead of on a box.
const svg = `${face(1, false)}\n`
const favicon = `favicon.${stamp(svg)}.svg`
writeFileSync(resolve(OUT, favicon), svg)
console.log(`${favicon.padEnd(34)} vector`)

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

const splashLines: string[] = []
for (const { w, h, dw, dh, dpr } of SPLASHES) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<body style="margin:0">${splash(w, h)}</body>`)
  const shot = await page.screenshot()
  const file = `splash-${w}x${h}.${stamp(shot)}.png`
  writeFileSync(resolve(OUT, file), shot)
  splashLines.push(
    `  { src: '${file}', media: '(device-width: ${dw}px) and (device-height: ${dh}px)`
    + ` and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)' },`,
  )
  console.log(`${file.padEnd(34)} ${dw}x${dh} at ${dpr}x`)
}

/*
 * The names, written where the app can read them.
 *
 * A module rather than JSON, so the build config, the service worker and the
 * check that guards all this can import it without anybody enabling JSON
 * imports for one file. The links in index.html are injected from here by a
 * plugin in vite.config.ts, which is why there is no longer a block of markup
 * for somebody to paste in and get wrong.
 */
writeFileSync(GENERATED, `/**
 * The artwork's real filenames, written by \`npm run icons\`.
 *
 * Do not edit. Every name carries a hash of the file's own contents, so a
 * changed picture is a changed address and nothing that caches by URL, from a
 * home screen to a service worker, can go on drawing the previous one.
 *
 * \`npm run icons:check\` fails the build if these names and \`public/\` have
 * drifted apart in either direction.
 */
export interface AppIcon {
  src: string
  sizes: string
  type: string
  purpose?: string
}

export interface LaunchScreen {
  src: string
  media: string
}

/** The tab icon, as vector. */
export const FAVICON = '${favicon}'

/** What iOS puts on the home screen, read once when the app is added. */
export const APPLE_TOUCH_ICON = '${appleTouch}'

/** What a notification is drawn with, which the service worker asks for. */
export const NOTIFICATION_ICON = '${appleTouch}'

/** The manifest's icon list. */
export const ICONS: AppIcon[] = [
${iconLines.join('\n')}
]

/** iOS launch screens, one per device it knows about. */
export const SPLASHES: LaunchScreen[] = [
${splashLines.join('\n')}
]
`)
console.log(`\nsrc/generated/icons.ts written`)

await browser.close()
