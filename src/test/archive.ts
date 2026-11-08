import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArchiveText, type PlanArchive } from '../data/archiveFormat'

/**
 * Which plan archive the tests run against.
 *
 * The real one when this machine has it (`data/archive.json`, private and
 * gitignored), the made-up one in fixtures/ otherwise, which is what CI and a
 * fresh clone always get. `BITE_BUDDY_TEST_ARCHIVE=fixture` forces the
 * made-up one, to see what CI will see.
 *
 * Tests that are about the real plans themselves, the whole archive
 * translating, a particular dish the dietician wrote four ways, check
 * `REAL_ARCHIVE` and skip without it. Everything else is written against
 * whichever archive is loaded.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
export const REAL_ARCHIVE_PATH = resolve(HERE, '../../data/archive.json')
export const FIXTURE_PATH = resolve(HERE, 'fixtures/archive.json')

export const REAL_ARCHIVE = process.env.BITE_BUDDY_TEST_ARCHIVE !== 'fixture' && existsSync(REAL_ARCHIVE_PATH)

/**
 * One value for the real archive and its counterpart in the made-up one, for
 * a test whose rule holds in both but whose example has to name a dish.
 */
export function pick<T>(real: T, fixture: T): T {
  return REAL_ARCHIVE ? real : fixture
}

export function testArchive(): PlanArchive {
  return parseArchiveText(readFileSync(REAL_ARCHIVE ? REAL_ARCHIVE_PATH : FIXTURE_PATH, 'utf8'))
}
