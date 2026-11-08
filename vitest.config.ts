import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // The Edge Functions are Deno and cannot be imported here, but the part of
    // them worth testing, which notification to send and when, is kept in a
    // plain file with no imports precisely so that it can be.
    // The importer is not shipped, but the data it produces is, and the rules
    // it applies are the ones that decide whether a meal's calories are real.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'supabase/functions/_shared/*.test.ts'],
    // The plan archive is private and not in the repository: this puts the
    // real one in place where it exists and a made-up one everywhere else.
    // See src/test/archive.ts.
    setupFiles: ['src/test/setup.ts'],
  },
})
