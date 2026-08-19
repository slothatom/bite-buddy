import type { Macros, MealSlot, Recipe } from '../types'
import type { NutritionContext } from './nutrition'
import { recipePerServing, roundNutrients } from './nutrition'

/**
 * The MyFitnessPal bridge.
 *
 * MyFitnessPal withdrew its public API in 2019 and does not grant new developer
 * access, so there is no way to write to a diary programmatically. What does
 * work, and is all this module does:
 *
 *  - format a meal or a day as a Quick Add line to paste into the app;
 *  - format a recipe as an ingredient list its recipe importer understands;
 *  - read the CSV that MyFitnessPal Premium exports, to bring history back in.
 */

// ─── Out: clipboard ───────────────────────────────────────────────────────────

export function quickAddLine(label: string, macros: Macros): string {
  const m = roundNutrients({ ...macros })
  return `${label} — ${Math.round(m.calories)} kcal · ${m.protein}g protein · ${m.carbs}g carbs · ${m.fat}g fat`
}

const SLOT_NAMES: Record<MealSlot, string> = {
  breakfast: 'Breakfast', snack1: 'Morning snack', lunch: 'Lunch',
  snack2: 'Afternoon snack', dinner: 'Dinner',
}

export function mealQuickAdd(slot: MealSlot, macros: Macros): string {
  return quickAddLine(SLOT_NAMES[slot], macros)
}

export function dayQuickAdd(
  date: string,
  perSlot: { slot: MealSlot; macros: Macros }[],
  total: Macros,
): string {
  const lines = perSlot
    .filter((s) => s.macros.calories > 0)
    .map((s) => `  ${mealQuickAdd(s.slot, s.macros)}`)
  return [`${date}`, ...lines, '', quickAddLine('Day total', total)].join('\n')
}

/**
 * A recipe as an ingredient list.
 *
 * MyFitnessPal's "create a recipe" flow accepts a pasted list of ingredients
 * with quantities, matching each against its own database. Nested recipes are
 * flattened, because the importer has no concept of a sub-recipe.
 */
export function recipeForMfp(recipe: Recipe, ctx: NutritionContext): string {
  const grams = new Map<string, number>()

  const walk = (components: Recipe['components'], scale: number, depth = 0) => {
    if (depth > 6) return
    for (const c of components) {
      if (c.kind === 'food') {
        const food = ctx.foods.get(c.foodId)
        if (!food || food.id === 'water') continue
        grams.set(food.names.en, (grams.get(food.names.en) ?? 0) + c.grams * scale)
      } else {
        const nested = ctx.recipes.get(c.recipeId)
        if (!nested) continue
        walk(nested.components, scale * (c.servings / Math.max(1, nested.servings)), depth + 1)
      }
    }
  }
  walk(recipe.components, 1)

  const perServing = roundNutrients(recipePerServing(recipe, ctx))
  return [
    recipe.name.en,
    `Servings: ${recipe.servings}`,
    '',
    ...[...grams.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, g]) => `${Math.round(g)} g ${name}`),
    '',
    `Per serving: ${Math.round(perServing.calories)} kcal, ${perServing.protein}g protein, ` +
    `${perServing.carbs}g carbs, ${perServing.fat}g fat`,
  ].join('\n')
}

// ─── In: diary CSV ────────────────────────────────────────────────────────────

export interface MfpDiaryEntry {
  date: string
  meal: string
  macros: Macros
  fiber?: number
}

/** Splits a CSV row, honouring quoted fields containing commas. */
function splitRow(row: string): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (quoted && row[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
      continue
    }
    if (ch === ',' && !quoted) { out.push(field); field = ''; continue }
    field += ch
  }
  out.push(field)
  return out.map((f) => f.trim())
}

function findColumn(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase())
  for (const candidate of candidates) {
    const i = lower.findIndex((h) => h.startsWith(candidate))
    if (i >= 0) return i
  }
  return -1
}

/**
 * Parses a MyFitnessPal nutrition export.
 *
 * Column order has changed across export versions, so columns are located by
 * header name rather than by position, and unknown columns are ignored.
 */
export function parseMfpCsv(text: string): MfpDiaryEntry[] {
  const rows = text.split(/\r?\n/).filter((r) => r.trim())
  if (rows.length < 2) return []

  const headers = splitRow(rows[0])
  const col = {
    date:     findColumn(headers, 'date'),
    meal:     findColumn(headers, 'meal'),
    calories: findColumn(headers, 'calories', 'energy'),
    protein:  findColumn(headers, 'protein'),
    carbs:    findColumn(headers, 'carbohydrates', 'carbs'),
    fat:      findColumn(headers, 'fat (g)', 'fat'),
    fiber:    findColumn(headers, 'fiber', 'fibre'),
  }
  if (col.date < 0 || col.calories < 0) return []

  const num = (fields: string[], i: number): number => {
    if (i < 0) return 0
    const v = Number(String(fields[i] ?? '').replace(/[^0-9.-]/g, ''))
    return Number.isFinite(v) ? v : 0
  }

  const entries: MfpDiaryEntry[] = []
  for (const row of rows.slice(1)) {
    const f = splitRow(row)
    const rawDate = f[col.date]
    if (!rawDate) continue
    const parsed = new Date(rawDate)
    if (Number.isNaN(parsed.getTime())) continue

    entries.push({
      date: parsed.toISOString().slice(0, 10),
      meal: col.meal >= 0 ? f[col.meal] || 'Meal' : 'Meal',
      macros: {
        calories: num(f, col.calories),
        protein: num(f, col.protein),
        carbs: num(f, col.carbs),
        fat: num(f, col.fat),
      },
      fiber: col.fiber >= 0 ? num(f, col.fiber) : undefined,
    })
  }
  return entries
}

/** Copies text, falling back to a textarea when the clipboard API is blocked. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }
}
