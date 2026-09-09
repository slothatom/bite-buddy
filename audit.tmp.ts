import { MEAL_RECIPES } from './src/data/generated/mealRecipes.js'
import { DISHES } from './src/data/dishes.js'
const all = [...DISHES, ...MEAL_RECIPES]
for (const q of ['green bean soup', 'rolled oats with yogurt']) {
  const hits = all.filter(r => r.name.en.toLowerCase().includes(q))
  console.log(`\n"${q}" → ${hits.length}`)
  for (const r of hits) console.log(`   ${r.id.padEnd(22)} ${r.name.en}  variant=${r.variant ?? '-'}  "${(r.sourceLine ?? '').slice(0,60)}"`)
}
