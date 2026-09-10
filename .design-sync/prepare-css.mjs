// Stages the app's compiled stylesheet where the design-sync converter can
// find it at a stable path.
//
// Two things make this necessary. `src/index.css` is Tailwind v4 source: it
// opens with `@import 'tailwindcss'`, so shipping it would ship an import the
// design tool cannot resolve and no utility classes at all. And the compiled
// file Vite writes carries a content hash in its name, which changes on every
// build, so no path in config.json could name it twice running.
//
// The woff2 and woff files come along because the compiled CSS references them
// as `url(./bungee-latin-400-normal-*.woff2)`, relative to itself. Copying the
// stylesheet without them would ship seven @font-face rules pointing at
// nothing, and every design built with this system would render in a fallback.
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FROM = 'dist/assets'
const TO = '.design-sync/.cache/css'

const files = readdirSync(FROM)
const sheets = files
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ f, at: statSync(join(FROM, f)).mtimeMs }))
  .sort((a, b) => b.at - a.at)

if (!sheets.length) {
  console.error(`no compiled stylesheet in ${FROM} - run \`npm run build\` first`)
  process.exit(1)
}

rmSync(TO, { recursive: true, force: true })
mkdirSync(TO, { recursive: true })
copyFileSync(join(FROM, sheets[0].f), join(TO, 'styles.css'))

const fonts = files.filter((f) => /\.(woff2?|ttf|otf)$/.test(f))
for (const f of fonts) copyFileSync(join(FROM, f), join(TO, f))

console.log(`staged ${sheets[0].f} as ${TO}/styles.css, with ${fonts.length} font files beside it`)
