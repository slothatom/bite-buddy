// Emits the declaration tree the design-sync converter reads props from.
//
// Without it every component's `.d.ts` in the design system reads
// `[key: string]: unknown` - which is what the design agent is handed as the
// component's API contract, so it would be coding against nothing. Bite Buddy
// is an application and has no declaration output of its own, so this makes
// one from `entry.tsx`, JSDoc and all.
//
// `--ignoreConfig` because tsc refuses to load tsconfig.json when files are
// named on the command line, and `src/vite-env.d.ts` because `import.meta.env`
// is a Vite declaration the app's own tsconfig pulls in.
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'

rmSync('.design-sync/types', { recursive: true, force: true })

const r = spawnSync('npx', [
  'tsc', '--ignoreConfig', '--emitDeclarationOnly', '--declaration',
  '--outDir', '.design-sync/types',
  '--jsx', 'react-jsx', '--skipLibCheck', '--strict',
  '--moduleResolution', 'bundler', '--module', 'esnext', '--target', 'es2022',
  '--resolveJsonModule',
  '.design-sync/entry.tsx', 'src/vite-env.d.ts',
], { stdio: 'inherit' })

// tsc emits declarations even when it reports errors, so the exit code alone
// would fail a build whose output is fine. The file being there is the test.
if (r.status !== 0) console.error('tsc reported problems; declarations above are what got written')
