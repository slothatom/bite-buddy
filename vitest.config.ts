import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // The Edge Functions are Deno and cannot be imported here, but the part of
    // them worth testing, which notification to send and when, is kept in a
    // plain file with no imports precisely so that it can be.
    include: ['src/**/*.test.ts', 'supabase/functions/_shared/*.test.ts'],
  },
})
