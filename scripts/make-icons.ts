/**
 * Renders the app's icons, tab icon and launch screens from the logo masters.
 *
 * The artwork is the Bitten B, and its source of truth is the SVGs in
 * `brand/`: a rounded app tile, a full-bleed maskable tile with the mark in
 * the safe zone, and a tab icon that adapts to a dark browser by itself. This
 * script draws nothing of its own. It reads those files, rasterises the ones a
 * platform wants as PNG, and copies the favicon across as vector. Run
 * `npm run icons` after changing anything in `brand/`.
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
 * image library to the project for a handful of files.
 */
import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BRAND = resolve(import.meta.dirname, '../brand')
const OUT = resolve(import.meta.dirname, '../public')
const GENERATED = resolve(import.meta.dirname, '../src/generated/icons.ts')

/** The launch screen's ground: the manifest's background colour and
 *  --color-cream-50, as a literal, because a file rendered outside the
 *  document cannot read a CSS variable. */
const CREAM = '#faf7f0'

/** A master from `brand/`, as text. */
function master(name: string): string {
  return readFileSync(resolve(BRAND, name), 'utf8')
}

/**
 * The tile with its corners squared off.
 *
 * The rounded corners on the master are right for a manifest icon, which a
 * browser or launcher shows as given. They are wrong for iOS: a home screen
 * draws its own rounded square over whatever it is handed and composites any
 * transparency onto black, so a pre-rounded tile comes out with dark slivers
 * in its corners. iOS gets the same tile, square.
 */
function squared(svg: string): string {
  return svg.replace(/ rx="[\d.]+"/, '')
}

/** Gives a master a pixel size. The masters carry only a viewBox. */
function sized(svg: string, size: number): string {
  return svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
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
 * Which master each PNG comes from.
 *
 * The ordinary icons are the rounded tile, transparent past its corners. The
 * maskable one has its own master: full bleed, with the mark pulled into the
 * middle 80% that every platform's crop is guaranteed to keep. The manifest
 * once offered one file for both, and a phone that draws round icons cut the
 * artwork's edges off.
 */
const ICONS = [
  { stem: 'icon-192', size: 192, svg: master('app-icon.svg') },
  { stem: 'icon-512', size: 512, svg: master('app-icon.svg') },
  { stem: 'icon-maskable-512', size: 512, svg: master('app-icon-maskable.svg'), purpose: 'maskable' },
]

/** The iOS home screen icon: square (see `squared`), at the 180px iOS asks for. */
const APPLE = { stem: 'icon-apple-180', size: 180, svg: squared(master('app-icon.svg')) }

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

/** One square PNG of a master, written under its hashed name. */
async function render(stem: string, size: number, svg: string): Promise<string> {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0">${sized(svg, size)}</body>`)
  // Transparent outside the artwork, so the rounded tile keeps its corners.
  const shot = await page.locator('svg').screenshot({ omitBackground: true })
  const file = `${stem}.${stamp(shot)}.png`
  writeFileSync(resolve(OUT, file), shot)
  console.log(`${file.padEnd(34)} ${size}x${size}`)
  return file
}

const iconLines: string[] = []
let notification = ''
for (const { stem, size, svg, purpose } of ICONS) {
  const file = await render(stem, size, svg)
  // A notification icon is drawn as given, about this size, so it is the
  // rounded 192 rather than the square iOS tile.
  if (stem === 'icon-192') notification = file
  iconLines.push(
    `  { src: '${file}', sizes: '${size}x${size}', type: 'image/png'`
    + `${purpose ? `, purpose: '${purpose}'` : ''} },`,
  )
}
const appleTouch = await render(APPLE.stem, APPLE.size, APPLE.svg)

// The tab icon is the favicon master as it stands: vector, so it stays sharp
// wherever a browser draws it; no tile, so it sits on the tab's own colour;
// and a prefers-color-scheme rule inside it, so the B turns light teal on a
// dark tab strip without the page having to do anything.
const svg = master('favicon.svg')
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

/** The rounded app tile centred on a cream field, a third of the shorter
 *  edge across. Nothing crops a launch screen, so the corners stay. */
function splash(w: number, h: number): string {
  const art = Math.round(Math.min(w, h) * 0.34)
  return `<div style="margin:0;width:${w}px;height:${h}px;background:${CREAM};
    display:flex;align-items:center;justify-content:center">
    ${sized(master('app-icon.svg'), art)}
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

/** What iOS puts on the home screen, read once when the app is added. Square,
 *  because iOS rounds the corners itself. */
export const APPLE_TOUCH_ICON = '${appleTouch}'

/** What a notification is drawn with, which the service worker asks for. */
export const NOTIFICATION_ICON = '${notification}'

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
