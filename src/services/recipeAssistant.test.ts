import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * What the assistant says when it cannot do the job.
 *
 * Every one of these is a real thing that happens to a real person: a function
 * nobody has deployed, a session that quietly expired overnight, an account
 * that was never added to the household. Supabase reports all three the same
 * way, as a thrown error carrying an unread Response, so without deliberate
 * work they all reach the screen as "Edge Function returned a non-2xx status
 * code". That sentence has never helped anybody standing in a kitchen.
 */

const invoke = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
  isConfigured: true,
}))

const { draftFromText } = await import('./recipeAssistant')

/** How supabase-js actually fails: it throws, and hands you the Response. */
function httpError(status: number, body: unknown) {
  const error = new Error('Edge Function returned a non-2xx status code')
  ;(error as Error & { context: Response }).context = new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
  return error
}

const PASTE = 'Red lentil soup with cumin and a squeeze of lemon, serves four.'

beforeEach(() => invoke.mockReset())

describe('when the assistant cannot help', () => {
  it('shows the function its own words rather than the wrapper', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(403, { error: 'This account is not in the household.' }),
    })

    const result = await draftFromText(PASTE, [])

    expect(result).toEqual({ ok: false, error: 'This account is not in the household.' })
  })

  it('says it is not deployed when there is nothing there to call', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(404, 'Function not found') })

    const result = await draftFromText(PASTE, [])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not deployed/i)
  })

  it('sends you to sign in again rather than blaming the recipe', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(401, { message: 'Missing authorization header' }),
    })

    const result = await draftFromText(PASTE, [])

    expect(result.ok).toBe(false)
    // The gateway's own words are the useful ones here, and they arrive under
    // `message` rather than `error`, which is the shape the function uses.
    if (!result.ok) expect(result.error).toBe('Missing authorization header')
  })

  it('never leaves a person holding the raw wrapper message', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(500, '<html>gateway</html>') })

    const result = await draftFromText(PASTE, [])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).not.toMatch(/non-2xx/)
  })

  it('keeps a refusal readable when the shape is right but the draft is not', async () => {
    invoke.mockResolvedValue({ data: { error: 'That reads like a shopping list.' }, error: null })

    const result = await draftFromText(PASTE, [])

    expect(result).toEqual({ ok: false, error: 'That reads like a shopping list.' })
  })
})

describe('what it will not even try', () => {
  it('refuses a bare link rather than inventing a recipe from the address', async () => {
    const result = await draftFromText(
      'https://www.delish.com/cooking/recipe-ideas/a46330/skillet-sicilian-chicken-recipe/',
      [],
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/cannot open pages/i)
    // The point of catching it here is that nothing is spent finding out.
    expect(invoke).not.toHaveBeenCalled()
  })

  it('still reads a recipe that merely mentions where it came from', async () => {
    invoke.mockResolvedValue({ data: { draft: { name: 'Sicilian Chicken' } }, error: null })

    const result = await draftFromText(
      'From https://example.com/chicken\n200 g chicken thigh\n1 tin tomatoes\nFry, simmer.',
      [],
    )

    expect(result.ok).toBe(true)
    expect(invoke).toHaveBeenCalled()
  })
})

describe('when it works', () => {
  it('passes the draft back, and sends ids and names only', async () => {
    invoke.mockResolvedValue({
      data: { draft: { name: 'Red Lentil Soup', ingredients: [], steps: [] } },
      error: null,
    })

    const foods = [
      { id: 'lentil-red', names: { en: 'Red lentils' }, per100g: { kcal: 350 } },
    ]
    const result = await draftFromText(PASTE, foods as never)

    expect(result.ok).toBe(true)
    const [, options] = invoke.mock.calls[0] as [string, { body: { foods: unknown[] } }]
    expect(options.body.foods).toEqual([{ id: 'lentil-red', name: 'Red lentils' }])
  })
})
