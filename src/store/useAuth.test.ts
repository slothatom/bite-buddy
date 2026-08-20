import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The sign-in paths that are easy to get wrong and impossible to notice.
 *
 * Supabase deliberately does not reveal whether an address exists, so a
 * rejected guest and a real one see the same screen. That makes the error
 * handling here the only thing standing between "check your email" and a
 * person staring at an inbox that will never receive anything.
 */

const signInWithOtp = vi.fn()
const signOut = vi.fn()
const getSession = vi.fn().mockResolvedValue({ data: { session: null } })
const onAuthStateChange = vi.fn()
const from = vi.fn()

vi.mock('../lib/supabase', () => ({
  isConfigured: true,
  redirectUrl: () => 'https://example.test/bite-buddy/',
  supabase: {
    auth: { signInWithOtp, signOut, getSession, onAuthStateChange },
    from: (table: string) => from(table),
  },
}))

const { useAuthStore } = await import('./useAuth')

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ data: { session: null } })
  useAuthStore.setState({ session: null, user: null, members: [], error: null, linkSentTo: null })
})

describe('signIn', () => {
  it('sends the link to the address, pointed back at this app', async () => {
    signInWithOtp.mockResolvedValue({ error: null })

    await useAuthStore.getState().signIn('  me@example.com  ')

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'me@example.com',
      options: { emailRedirectTo: 'https://example.test/bite-buddy/' },
    })
    expect(useAuthStore.getState().linkSentTo).toBe('me@example.com')
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('does not claim a link is coming when it is not', async () => {
    // Saying "check your email" after a failure is how someone ends up waiting
    // for a message that was never sent.
    signInWithOtp.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } })

    await useAuthStore.getState().signIn('me@example.com')

    expect(useAuthStore.getState().linkSentTo).toBeNull()
    expect(useAuthStore.getState().error).toBe('Email rate limit exceeded')
  })

  it('clears a previous error when trying again', async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { message: 'nope' } })
    await useAuthStore.getState().signIn('me@example.com')
    expect(useAuthStore.getState().error).toBe('nope')

    signInWithOtp.mockResolvedValueOnce({ error: null })
    await useAuthStore.getState().signIn('me@example.com')
    expect(useAuthStore.getState().error).toBeNull()
  })
})

describe('signOut', () => {
  it('leaves nothing of the previous person behind', async () => {
    signOut.mockResolvedValue({ error: null })
    useAuthStore.setState({
      session: { access_token: 'x' } as never,
      user: { id: 'u1', email: 'me@example.com' } as never,
      members: [{ id: 'u1', email: 'me@example.com', display_name: 'Me', last_seen_at: '' }],
      linkSentTo: 'me@example.com',
    })

    await useAuthStore.getState().signOut()

    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.user).toBeNull()
    // The household list is other people's names — it must not survive a sign-out.
    expect(state.members).toEqual([])
    expect(state.linkSentTo).toBeNull()
  })
})

describe('refreshMembers', () => {
  it('loads the household', async () => {
    const rows = [{ id: 'u1', email: 'a@example.com', display_name: 'Ana', last_seen_at: '2026-08-20' }]
    from.mockReturnValue({ select: () => ({ order: () => Promise.resolve({ data: rows }) }) })

    await useAuthStore.getState().refreshMembers()
    expect(useAuthStore.getState().members).toEqual(rows)
  })

  it('leaves the list alone when the query fails', async () => {
    useAuthStore.setState({
      members: [{ id: 'u1', email: 'a@example.com', display_name: 'Ana', last_seen_at: '' }],
    })
    from.mockReturnValue({ select: () => ({ order: () => Promise.resolve({ data: null }) }) })

    await useAuthStore.getState().refreshMembers()
    // Blanking the screen on a transient failure is worse than showing stale names.
    expect(useAuthStore.getState().members).toHaveLength(1)
  })
})

describe('when Supabase is not configured', () => {
  it('is ready immediately, so a local clone never waits on a session', async () => {
    vi.resetModules()
    vi.doMock('../lib/supabase', () => ({
      isConfigured: false,
      supabase: null,
      redirectUrl: () => '',
    }))

    const { useAuthStore: local } = await import('./useAuth')
    expect(local.getState().ready).toBe(true)
    expect(local.getState().session).toBeNull()
  })
})
