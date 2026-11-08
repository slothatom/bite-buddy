/**
 * Which plan archive the app under test was built with.
 *
 * The made-up one in src/test/fixtures unless the run was started with
 * `E2E_ARCHIVE=real` (see playwright.config.ts). Tests about the dietician's
 * actual plans, a dish she wrote four ways, thirty-six weeks in the archive,
 * skip themselves without it; the rest hold for either.
 */
export const REAL_ARCHIVE = process.env.E2E_ARCHIVE === 'real'

/** One value for the real archive and its counterpart in the made-up one. */
export function pick<T>(real: T, fixture: T): T {
  return REAL_ARCHIVE ? real : fixture
}
