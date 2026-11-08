import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArchiveText, type PlanArchive } from '../../src/data/archiveFormat.js'

/**
 * Where the plan archive lives on a machine that has it.
 *
 * Gitignored. The repository is public and the plans are not, so the scripts
 * that need them read this file when it is there and say so when it is not,
 * rather than failing: CI and a fresh clone never have it.
 */
export const ARCHIVE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/archive.json')

/** The archive at `path`, or null when there is no file there. Throws on a bad file. */
export function readArchiveFile(path = ARCHIVE_PATH): PlanArchive | null {
  if (!existsSync(path)) return null
  return parseArchiveText(readFileSync(path, 'utf8'))
}

/** The text an archive is written as, so writing and comparing agree. */
export function archiveText(archive: PlanArchive): string {
  return `${JSON.stringify(archive, null, 2)}\n`
}

export function writeArchiveFile(archive: PlanArchive, path = ARCHIVE_PATH): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, archiveText(archive))
}

/** The sentence a script prints when it has nothing to work on. */
export function noArchiveMessage(what: string): string {
  return `No plan archive at ${ARCHIVE_PATH}, so ${what} is skipped.\n`
    + 'It is private and never committed. Run `npm run data:build` with the source documents in data/source, '
    + 'or copy the archive.json you uploaded in Settings to data/archive.json.'
}
