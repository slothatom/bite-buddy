import { useMemo, useState } from 'react'
import { Search, Plus, Combine } from 'lucide-react'
import type { Food, MedCategory } from '../types'
import { isCuratedFood, useFoods, useFoodStore } from '../store/useFoodStore'
import { duplicateFoods } from '../lib/mergeFoods'
import { searchFoods, buildFoodIndex } from '../lib/foodSearch'
import { TierBadge, EmptyState, SourceLine, ChipRow } from '../components/ui'
import { CATEGORY_EMOJI, CATEGORY_LABELS, CATEGORY_ORDER } from '../lib/categories'
import FoodEditor from '../components/foods/FoodEditor'
import { saltFromSodium } from '../lib/nutrition'
// The sheet that writes a food down lives in components/ rather than here,
// because the planner opens the same one: a food you have never met is met
// with a plate in front of you, not on the library screen.
import AddFoodModal from '../components/foods/AddFoodModal'

/**
 * The food database.
 *
 * Grouped by the Mediterranean guide's own categories so the library doubles as
 * the guide's food lists, with the tier badge showing how often each group is
 * meant to appear.
 */
export default function Foods() {
  const foods = useFoods()
  const mergeFoods = useFoodStore((s) => s.mergeFoods)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MedCategory | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)

  const index = useMemo(() => buildFoodIndex(foods), [foods])

  const visible = useMemo(() => {
    const base = query ? searchFoods(query, index, 500) : foods
    return category ? base.filter((f) => f.category === category) : base
  }, [foods, index, query, category])

  // Only offered on the unfiltered list: merging half a library because a
  // search happened to hide the other half is not something to do in passing.
  const duplicates = useMemo(
    () => (query || category ? [] : duplicateFoods(foods, isCuratedFood)),
    [foods, query, category],
  )

  const grouped = useMemo(() => {
    const map = new Map<MedCategory, Food[]>()
    for (const f of visible) {
      const list = map.get(f.category) ?? []
      list.push(f)
      map.set(f.category, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.names.en.localeCompare(b.names.en))
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const)
  }, [visible])

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="display text-xl sm:text-2xl text-ink-900">Foods</h1>
            <p className="text-sm text-ink-700">
              Everything the recipes are built from. {foods.length} foods, with calories per 100 g.
            </p>
          </div>
          <button className="btn-primary shrink-0" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add food
          </button>
        </header>

        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            {/* The stored names, not the aliases. This quoted "paine int",
                which is how the plans write it and is correctly an alias, but
                seeing it here made the app look like it holds a typo where it
                actually holds "pâine integrală". Search still finds either,
                which is the whole point of aliases. */}
            <input
              className="input pl-9"
              aria-label="Search foods"
              placeholder="Search telemea, pâine integrală, zabpehely, olive oil…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {/* The chosen category leads, so it stays visible when collapsed. */}
          <ChipRow initial={6}>
            {[...CATEGORY_ORDER].sort((a, b) => Number(b === category) - Number(a === category)).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? null : c)}
                className={category === c ? 'chip-on' : 'chip-off'}
              >
                {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
              </button>
            ))}
          </ChipRow>
        </div>

        {duplicates.length > 0 && (
          <DuplicateBanner
            count={duplicates.length}
            extra={duplicates.reduce((n, g) => n + g.fold.length, 0)}
            onMerge={() => {
              for (const g of duplicates) mergeFoods(g.keep.id, g.fold.map((f) => f.id))
            }}
          />
        )}

        {grouped.length === 0 ? (
          <EmptyState title="No foods matching that">
            Try another spelling, or add it yourself below.
          </EmptyState>
        ) : (
          grouped.map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-sm font-bold text-ink-900 mb-2 flex items-center gap-2">
                <span>{CATEGORY_EMOJI[cat]}</span> {CATEGORY_LABELS[cat]}
                <span className="text-ink-500 font-normal">({list.length})</span>
              </h2>
              {/* Two columns from xl. One column of 122 foods on a laptop is
                  half a screen of names and half a screen of nothing, and the
                  numbers end up a hand's width from the name they describe.
                  The divider moves to the cell so the columns still read as
                  rows rather than as two lists. */}
              <div className="card xl:grid xl:grid-cols-2 xl:gap-x-2 divide-y divide-border-100 xl:divide-y-0">
                {list.map((f) => (
                  // One row on a wide screen. On a phone the tier badge and the
                  // 112px figures column left the name 85px of 356, so they drop
                  // to their own line and the name gets the width instead.
                  <button
                    key={f.id}
                    onClick={() => setEditing(f)}
                    aria-label={`Edit ${f.names.en}`}
                    className="w-full text-left flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:py-2 hover:bg-cream-50 transition-colors xl:border-b xl:border-border-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink-900">{f.names.en}</p>
                      {f.names.ro || f.names.hu ? (
                        <SourceLine
                          text={[f.names.ro, f.names.hu].filter(Boolean).join(' · ')
                            + (f.state !== 'as-sold' ? ` · weighed ${f.state}` : '')}
                          clamp={2}
                        />
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      {/* A fixed lane for the badge, so "Moderation" does not
                          shove the figures left and leave every row in the
                          column starting somewhere different. */}
                      <span className="sm:w-24 sm:flex sm:justify-start shrink-0">
                        <TierBadge tier={f.medTier} />
                      </span>
                      <div className="text-right shrink-0 sm:w-52">
                        <p className="text-sm font-mono font-bold text-ink-900">
                          {Math.round(f.per100g.calories)}<span className="text-ink-500 font-normal text-xs"> kcal</span>
                        </p>
                        <p className="text-xs text-ink-500">
                          Protein {f.per100g.protein} g · Carbs {f.per100g.carbs} g · Fat {f.per100g.fat} g
                        </p>
                        {/* Fibre and salt are the two the app tracks as daily
                            targets and the two most often missing: 107 of the
                            122 foods have neither. Listing every other figure
                            and not these hid the gap on the one screen where
                            it could be fixed. Absent says absent, rather than
                            not appearing at all. */}
                        <p className="text-xs text-ink-500">
                          Fibre {f.per100g.fiber == null
                            ? <span className="text-coral-600">not known</span>
                            : `${f.per100g.fiber} g`}
                          {' · '}
                          Salt {saltFromSodium(f.per100g.sodium) == null
                            ? <span className="text-coral-600">not known</span>
                            : `${saltFromSodium(f.per100g.sodium)!.toFixed(2)} g`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {adding && <AddFoodModal onClose={() => setAdding(false)} />}

      {editing && <FoodEditor food={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/**
 * Adds a food, either typed in or looked up.
 *
 * The lookup goes through the existing USDA and Open Food Facts clients. Those
 * databases are thin on Romanian and Hungarian staples, which is exactly why
 * the curated list exists, so manual entry is a first-class path, not a fallback.
 */
/**
 * The offer to fold duplicates together.
 *
 * Only shown for foods that match on name or source id *and* agree on the
 * numbers. Anything that would move a total is left for you to look at.
 */
function DuplicateBanner({
  count, extra, onMerge,
}: {
  count: number
  extra: number
  onMerge: () => void
}) {
  const [done, setDone] = useState(false)
  if (done) return null

  return (
    <div className="rounded-2xl border border-bite-200 bg-bite-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <Combine size={20} className="text-bite-700 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-900">
          {count} {count === 1 ? 'ingredient is' : 'ingredients are'} in here more than once
        </p>
        <p className="text-xs text-ink-700 mt-0.5">
          Same food, same numbers, added twice from different sources. Folding them together
          removes {extra} {extra === 1 ? 'copy' : 'copies'} and stops one ingredient turning into
          three lines on the shopping list. Recipes that already name them keep working, and each
          one can be undone from the food itself.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button className="btn-primary" onClick={onMerge}>Merge them</button>
        <button className="btn-ghost text-ink-500" onClick={() => setDone(true)}>Not now</button>
      </div>
    </div>
  )
}
