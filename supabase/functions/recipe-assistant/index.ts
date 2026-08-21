/**
 * Turns a paste into a draft recipe.
 *
 * Deploy: supabase functions deploy recipe-assistant
 * Secret it needs: ANTHROPIC_API_KEY.
 *
 * This exists as a function rather than in the app because the app is a public
 * static site: a key in the bundle is a key anyone can read and spend. Here the
 * key stays on the server, and the only people who can reach it are the ones
 * already in the household, which is checked below against the same membership
 * every other policy in this database uses.
 *
 * What it will not do is invent nutrition. The model is given your food list
 * and asked to name ids from it; anything it cannot match comes back as a plain
 * name for you to resolve, and every calorie in the app still comes from the
 * food database. A made-up number on a screen about what you eat is worse than
 * no number, and it would be indistinguishable from a real one.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.120.0'

const MODEL = 'claude-opus-5'

interface Body {
  /** Whatever was pasted: a recipe off a website, or a few lines of shorthand. */
  text: string
  /** The household's food database, so ingredients can be matched to real ids. */
  foods: { id: string; name: string }[]
  /** The categories and filters this app knows, so it cannot invent new ones. */
  categories: string[]
  quickFilters: string[]
}

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'A short English name for the dish.' },
    emoji: { type: 'string', description: 'One emoji that suits it.' },
    servings: { type: 'integer', description: 'How many portions it makes.' },
    prepMinutes: { type: 'integer' },
    cookMinutes: { type: 'integer' },
    category: {
      type: 'string',
      description: 'What the food is, from the list given. Empty if none fit.',
    },
    mealTypes: {
      type: 'array',
      items: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    },
    quickFilters: {
      type: 'array',
      items: { type: 'string' },
      description: 'Only ones from the list given, and only where clearly true.',
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          foodId: {
            type: 'string',
            description: 'An id from the food list, or empty when nothing matches.',
          },
          name: { type: 'string', description: 'The ingredient as written.' },
          grams: { type: 'number', description: 'Weight in grams, raw.' },
        },
        required: ['foodId', 'name', 'grams'],
        additionalProperties: false,
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
  required: [
    'name', 'emoji', 'servings', 'prepMinutes', 'cookMinutes',
    'category', 'mealTypes', 'quickFilters', 'ingredients', 'steps', 'note',
  ],
  additionalProperties: false,
} as const

const SYSTEM = `You turn a pasted recipe into structured data for a household meal planner.

Rules that matter more than being helpful:

- Give every ingredient a weight in grams, raw and uncooked, the way a dietician
  writes a plan: "50 g bulgur" means dry bulgur. Convert cups, spoons and
  "a handful" to grams yourself, and prefer a sensible round number over false
  precision.
- Match each ingredient to an id from the food list you are given. Match on what
  the thing is, not on how it is spelled, and leave foodId empty rather than
  matching something that is not the same food. An unmatched ingredient is easy
  for a person to fix; a wrong match is a wrong number they will never notice.
- Never invent nutrition. You are not asked for calories or macros and must not
  supply them.
- Use only the categories and filters given to you. Apply a filter only where it
  is clearly true of the dish.
- Steps are optional. Plenty of real meals are an assembly rather than a method,
  and inventing a method for "yoghurt, fruit, nuts" helps nobody. Leave steps
  empty when the pasted text has none.
- Write in British English, and never use an em dash.`

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors() })
  if (request.method !== 'POST') {
    return json({ error: 'POST a recipe to draft.' }, 405)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!apiKey || !url || !anon) return json({ error: 'This function is not configured yet.' }, 500)

  // Who is asking. The caller's own token is used rather than the service role,
  // so the household's row level security answers the question rather than this
  // function having to be trusted to ask it correctly.
  const auth = request.headers.get('Authorization')
  if (!auth) return json({ error: 'Sign in first.' }, 401)

  const supabase = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return json({ error: 'Sign in first.' }, 401)

  const { data: member } = await supabase
    .from('members').select('id').eq('id', user.user.id).maybeSingle()
  if (!member) return json({ error: 'This account is not in the household.' }, 403)

  let body: Body
  try {
    body = await request.json() as Body
  } catch {
    return json({ error: 'That was not JSON.' }, 400)
  }

  const text = (body.text ?? '').trim()
  if (text.length < 10) return json({ error: 'Paste a bit more than that.' }, 400)
  if (text.length > 20_000) return json({ error: 'That is too long to read in one go.' }, 400)

  const anthropic = new Anthropic({ apiKey })

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      // Room to spare rather than room to fit. Thinking is counted in here too,
      // and a request that runs out mid tool call comes back looking like a
      // model that said nothing, which is the one failure that reads as a bug.
      // Nothing is charged for headroom that goes unused.
      max_tokens: 16_000,
      output_config: { effort: 'medium' },
      system: SYSTEM,
      tools: [{
        name: 'draft_recipe',
        description: 'Return the recipe as structured data.',
        strict: true,
        input_schema: {
          ...DRAFT_SCHEMA,
          properties: {
            ...DRAFT_SCHEMA.properties,
            category: {
              ...DRAFT_SCHEMA.properties.category,
              enum: body.categories ?? [],
            },
            quickFilters: {
              ...DRAFT_SCHEMA.properties.quickFilters,
              items: { type: 'string', enum: body.quickFilters ?? [] },
            },
          },
        },
      }],
      messages: [{
        role: 'user',
        content: [
          'The food database, as id and name. Match ingredients to these ids:',
          (body.foods ?? []).map((f) => `${f.id}\t${f.name}`).join('\n'),
          '',
          'The recipe to read:',
          text,
          '',
          'Call draft_recipe with what you found.',
        ].join('\n'),
      }],
    })

    const call = response.content.find((block) => block.type === 'tool_use')
    if (!call || call.type !== 'tool_use') {
      // Including the refusal case: a model that declined says so in text, and
      // passing that through is more useful than a generic failure.
      const said = response.content.find((b) => b.type === 'text')
      return json({
        error: said && said.type === 'text' && said.text
          ? said.text
          : 'Nothing came back that looked like a recipe.',
      }, 422)
    }

    return json({ draft: call.input, model: MODEL })
  } catch (error) {
    console.error('recipe-assistant', error)
    return json({ error: `The assistant could not be reached: ${(error as Error).message}` }, 502)
  }
})

function cors(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  })
}
