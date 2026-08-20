import { FOODS } from '../src/data/foods.js'
import { DISHES } from '../src/data/dishes.js'
import { MEAL_RECIPES } from '../src/data/generated/mealRecipes.js'
import { SOURCE_PLANS } from '../src/data/generated/sourcePlans.js'
import { auditFoods, type Finding } from '../src/lib/foodAudit.js'
import type { Component } from '../src/types/index.js'

/**
 * The weekly check on the food database.
 *
 * Run: npx tsx scripts/audit-foods.ts [--json]
 *
 * Nothing here edits a food. It reports, because the failure it exists to
 * catch, a wrong number that quietly changes every meal it appears in, is
 * exactly the failure an automatic correction could also cause. A person
 * reading a short list once a week is the right amount of ceremony.
 *
 * The checks are arithmetic rather than judgement on purpose: they can be
 * reproduced, argued with, and they cannot invent a figure. What a person
 * still has to decide is whether an unusual food is really unusual.
 */

const json = process.argv.includes('--json')

/** Foods anything actually refers to: a gap matters where it is used. */
const inUse = new Set<string>()
const walk = (components: Component[]) => {
  for (const c of components) if (c.kind === 'food') inUse.add(c.foodId)
}
for (const recipe of [...DISHES, ...MEAL_RECIPES]) walk(recipe.components)
for (const plan of SOURCE_PLANS) {
  for (const day of plan.days) for (const meal of day.meals) walk(meal.entries)
}

const report = auditFoods(FOODS, { inUse, now: Date.now() })

if (json) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

const wrong = report.findings.filter((f) => f.severity === 'wrong')
// Gaps are counted rather than listed. There are a hundred of them, they are
// all the same sentence, and a report that opens with a hundred identical
// lines buries the one line that matters.
const gaps = report.findings.filter((f) => f.kind === 'gap')
const check = report.findings.filter((f) => f.severity === 'check' && f.kind !== 'gap')

console.log(`${report.checked} foods checked, ${inUse.size} of them used by a recipe or a plan\n`)

function show(title: string, findings: Finding[]) {
  if (!findings.length) return
  console.log(`${title} (${findings.length})`)
  for (const f of findings) {
    console.log(`  ${f.name}: ${f.detail}`)
    if (f.suggestion) console.log(`      ${f.suggestion}`)
  }
  console.log()
}

show('Wrong', wrong)
show('Worth a look', check)

if (gaps.length) {
  const salt = gaps.filter((f) => f.detail.includes('salt'))
  const fibre = gaps.filter((f) => f.detail.includes('fibre'))
  console.log(`Missing figures (${gaps.length})`)
  if (salt.length) console.log(`  ${salt.length} foods with no salt figure, so every salt total is a floor`)
  if (fibre.length) console.log(`  ${fibre.length} plant foods with no fibre figure, same for fibre`)
  console.log(`  Run with --json for the list.\n`)
}

for (const [kind, n] of Object.entries(report.byKind)) {
  if (n) console.log(`${String(n).padStart(4)} ${kind}`)
}

// Only a real error fails the run. "Worth a look" is a question, and a
// question that fails a build is a question nobody reads twice.
if (wrong.length) {
  console.error(`\n${wrong.length} food${wrong.length === 1 ? '' : 's'} with numbers that cannot be right.`)
  process.exit(1)
}
