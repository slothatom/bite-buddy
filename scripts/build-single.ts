/**
 * Bundles the built app into one self-contained HTML file.
 *
 * The normal build is a directory of assets served over HTTP. Some places you
 * might want to open the app, a published page with a strict CSP, a file on a
 * phone, an email attachment, will only take a single document and refuse
 * every subresource request. So the CSS, the JavaScript and the fonts are
 * inlined, and the service worker is dropped: it cannot register without its
 * own separately-fetched script, and it has nothing to cache here anyway.
 *
 * Run `npm run build` first; this reads its output.
 *
 *   npm run build:single   ->  dist-single/bite-buddy.html
 *
 * The result is a preview, not a substitute for hosting it properly. It has no
 * manifest, so it cannot be installed to a home screen, and a page opened
 * without an origin of its own may have no storage to persist into.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'

const DIST = 'dist'
const OUT_DIR = 'dist-single'
const OUT = join(OUT_DIR, 'bite-buddy.html')

const MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  png: 'image/png',
  svg: 'image/svg+xml',
}

function dataUri(file: string): string {
  const ext = file.split('.').pop() ?? ''
  const mime = MIME[ext]
  if (!mime) throw new Error(`No MIME type known for ${file}, add one to MIME.`)
  return `data:${mime};base64,${readFileSync(join(DIST, file)).toString('base64')}`
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8')

const jsSrc = html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1]
const cssHref = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)?.[1]
if (!jsSrc || !cssHref) {
  throw new Error('Could not find the built script and stylesheet in dist/index.html.')
}

// Asset URLs are written relative to whatever references them; everything the
// build emits lands in dist/assets, so the basename is enough to find it.
const local = (url: string) => `assets/${basename(url)}`

// Fonts are the only thing the stylesheet reaches out for.
let css = readFileSync(join(DIST, local(cssHref)), 'utf8')
let inlined = 0
css = css.replace(/url\((\.?\/[^)"']+\.(?:woff2?|png|svg))\)/g, (_, url: string) => {
  inlined++
  return `url(${dataUri(local(url))})`
})

// A closing tag inside a string literal would end the inline script early.
const js = readFileSync(join(DIST, local(jsSrc)), 'utf8').replace(/<\/script/gi, '<\\/script')

const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'Bite Buddy'
const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''

// Head, body and doctype are supplied by whatever hosts this fragment.
const out = `<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="theme-color" content="#6D5BD0" />
<style>
html, body, #root { height: 100%; margin: 0; }
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, out)

const kb = (n: number) => `${Math.round(n / 1024)} kB`
console.log(`${OUT}  ${kb(Buffer.byteLength(out))}`)
console.log(`  css ${kb(css.length)} · js ${kb(js.length)} · ${inlined} font files inlined`)
