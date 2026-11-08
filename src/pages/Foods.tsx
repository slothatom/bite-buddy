import { useMemo, useState } from 'react'
import { Plus, Combine, ScanBarcode } from 'lucide-react'
import type { Food, MedCategory } from '../types'
import { isCuratedFood, useFoods, useFoodStore } from '../store/useFoodStore'
import { duplicateFoods } from '../lib/mergeFoods'
import { searchFoods, buildFoodIndex } from '../lib/foodSearch'
import { TierBadge, EmptyState, SourceLine, ChipRow, ChipCheck, SearchField } from '../components/ui'
import { CATEGORY_EMOJI, CATEGORY_LABELS, CATEGORY_ORDER } from '../lib/categories'
import FoodEditor from '../components/foods/FoodEditor'
import { saltFromSodium } from '../lib/nutrition'
import SectionTabs from '../components/layout/SectionTabs'
import { SECTION_TABS } from '../components/layout/nav'
import { useMediaQuery } from '../lib/useMediaQuery'
// The sheet that writes a food down lives in components/ rather than here,
// because the planner opens the same one: a food you have never met is met
// with a plate in front of you, not on the library screen.
import AddFoodModal from '../components/foods/AddFoodModal'

/** Where a food's numbers came from, in words. */
const SOURCE: Record<Food['source'], { label: string; className: string }> = {
  curated: { label: 'Curated', className: 'bg-mustard-100 text-mustard-800' },
  custom: { label: 'Yours', className: 'bg-mustard-100 text-mustard-800' },
  usda: { label: 'USDA', className: 'bg-bite-100 text-bite-700' },
  off: { label: 'Open Food Facts', className: 'bg-bite-100 text-bite-700' },
}

/**
 * The food database.
 *
 * Grouped by the Mediterranean guide's own categories so the library doubles as
 * the guide's food lists, with the tier badge showing how often each group is
 * meant to appear. A list on a phone, where each food is a row you tap to edit;
 * a table on a wide screen, where the figures line up in columns and can be
 * compared down the page.
 */
export default function Foods() {
  const foods = useFoods()
  const mergeFoods = useFoodStore((s) => s.mergeFoods)
  const wide = useMediaQuery('(min-width: 768px)', false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MedCategory | null>(null)
  const [adding, setAdding] = useState<'manual' | 'scan' | null>(null)
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
    <div className="flex-1 min-w-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3.5 md:pt-6 flex flex-col gap-3 md:gap-4">
        <header className="flex items-center gap-2 md:gap-3">
          {/* On a phone the title is the section's, with Foods as the tab under
              it; on a wide screen the tabs sit beside the search and the title
              says which half you are in. */}
          <h1 className="flex-1 min-w-0 text-[22px] leading-7 md:text-2xl md:leading-8 font-extrabold text-ink-900">
            {wide ? 'Foods' : 'Recipes'}
          </h1>
          {wide && (
            <button className="btn-secondary shrink-0" onClick={() => setAdding('scan')}>
              <ScanBarcode size={16} /> Scan a barcode
            </button>
          )}
          {/* "New food", not "Add food": the sidebar's quick add is "Add food"
              too, and means putting a food on today, not into the library. */}
          <button className="btn-primary shrink-0" onClick={() => setAdding('manual')}>
            <Plus size={16} /> New food
          </button>
        </header>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="md:w-60 md:shrink-0 md:[&>nav]:grid md:[&>nav]:auto-cols-fr">
            <SectionTabs label={SECTION_TABS.recipes.label} tabs={SECTION_TABS.recipes.tabs} />
          </div>
          {/* The stored names, not the aliases: "paine int" is how the plans
              write it, and quoting it here made the app look like it holds a
              typo. Search still finds either. */}
          <SearchField
            aria-label="Search foods"
            placeholder="Search telemea, pâine integrală, zabpehely, olive oil…"
            value={query}
            onChange={setQuery}
          />
        </div>

        {/* The chosen category leads, so it stays visible when collapsed. */}
        <div role="group" aria-label="Categories">
          <ChipRow initial={wide ? 12 : 4}>
            {[...CATEGORY_ORDER].sort((a, b) => Number(b === category) - Number(a === category)).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? null : c)}
                aria-pressed={category === c}
                className={category === c ? 'chip-on' : 'chip-off'}
              >
                <ChipCheck on={category === c} />
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
            Try another spelling, or add it yourself with New food.
          </EmptyState>
        ) : wide ? (
          <FoodTable grouped={grouped} onEdit={setEditing} />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <h2 className="text-base leading-6 font-extrabold text-ink-900">
                {visible.length} {visible.length === 1 ? 'food' : 'foods'}
              </h2>
              <span className="text-xs text-ink-700">Calories per 100 g</span>
            </div>
            {grouped.map(([cat, list]) => (
              <section key={cat} aria-label={CATEGORY_LABELS[cat]} className="flex flex-col gap-1.5">
                <h3 className="text-[13px] leading-[18px] font-extrabold text-ink-700">
                  <span aria-hidden="true">{CATEGORY_EMOJI[cat]}</span> {CATEGORY_LABELS[cat]} · {list.length}
                </h3>
                <ul className="bg-paper border border-border-200 rounded-3xl overflow-hidden">
                  {list.map((f) => <FoodRow key={f.id} food={f} onEdit={() => setEditing(f)} />)}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>

      {adding && <AddFoodModal initialTab={adding} onClose={() => setAdding(null)} />}

      {editing && <FoodEditor food={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** The Romanian and Hungarian names, and how the food is weighed. */
function otherNames(f: Food): string {
  return [f.names.ro, f.names.hu].filter(Boolean).join(' · ')
    + (f.state !== 'as-sold' ? ` · weighed ${f.state}` : '')
}

/**
 * Fibre and salt are the two the app tracks as daily targets and the two most
 * often missing. Absent says absent, rather than not appearing at all, on the
 * one screen where it can be fixed.
 */
function gaps(f: Food): string[] {
  return [
    f.per100g.fiber == null ? 'Fibre not known' : null,
    saltFromSodium(f.per100g.sodium) == null ? 'Salt not known' : null,
  ].filter((g): g is string => g !== null)
}

/** One food on a phone. The whole row opens the editor. */
function FoodRow({ food: f, onEdit }: { food: Food; onEdit: () => void }) {
  const source = SOURCE[f.source]
  return (
    <li data-food-row className="border-t border-border-100 first:border-t-0">
      <button
        onClick={onEdit}
        aria-label={`Edit ${f.names.en}`}
        className="w-full text-left flex flex-col gap-1 px-3.5 py-2.5 hover:bg-cream-50 transition-colors"
      >
        <span className="w-full flex items-baseline gap-2">
          <span className="flex-1 min-w-0 text-[15px] leading-5 font-bold text-ink-900">{f.names.en}</span>
          <span className="shrink-0 text-[15px] font-extrabold text-ink-900 tabular-nums">
            {Math.round(f.per100g.calories)}<span className="text-xs font-semibold text-ink-700"> kcal</span>
          </span>
        </span>
        {f.names.ro || f.names.hu ? <SourceLine text={otherNames(f)} clamp={2} /> : null}
        <span className="flex flex-wrap items-center gap-1.5">
          <TierBadge tier={f.medTier} />
          <span className={`badge ${source.className}`}>{source.label}</span>
          {gaps(f).map((g) => (
            <span key={g} className="text-xs font-bold text-coral-700">{g}</span>
          ))}
        </span>
      </button>
    </li>
  )
}

/** The library as a table on a wide screen, one category per block of rows. */
function FoodTable({ grouped, onEdit }: {
  grouped: (readonly [MedCategory, Food[]])[]
  onEdit: (food: Food) => void
}) {
  const grams = (n: number | undefined) => (n == null ? null : `${Math.round(n * 10) / 10} g`)
  return (
    <section aria-labelledby="foods-table" className="bg-paper border border-border-200 rounded-3xl overflow-hidden">
      <h2 id="foods-table" className="sr-only">Foods, per 100 g</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm leading-5">
          <caption className="caption-top text-left px-4 py-3 text-[13px] text-ink-700 border-b border-border-100">
            All figures are per 100 g, and every food can be edited. The source says where its
            numbers came from.
          </caption>
          <thead>
            <tr className="bg-cream-50 text-left text-xs text-ink-700">
              <th scope="col" className="px-4 py-2.5 font-extrabold">Food</th>
              <th scope="col" className="px-3 py-2.5 font-extrabold w-32">Guide</th>
              <th scope="col" className="px-3 py-2.5 font-extrabold text-right w-24">kcal / 100 g</th>
              <th scope="col" className="px-3 py-2.5 font-extrabold text-right w-20">Protein</th>
              <th scope="col" className="px-3 py-2.5 font-extrabold text-right w-20">Carbs</th>
              <th scope="col" className="px-3 py-2.5 font-extrabold text-right w-20">Fat</th>
              <th scope="col" className="px-3 py-2.5 font-extrabold text-right w-24">Fibre</th>
              <th scope="col" className="px-3 py-2.5 font-extrabold text-right w-24">Salt</th>
              <th scope="col" className="px-3 py-2.5 font-extrabold w-36">Source</th>
              <th scope="col" className="px-4 py-2.5 w-20"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          {grouped.map(([cat, list]) => (
            <tbody key={cat}>
              <tr className="border-t border-border-200 bg-cream-50">
                <th scope="rowgroup" colSpan={10} className="px-4 py-2 text-left text-[13px] font-extrabold text-ink-700">
                  <span aria-hidden="true">{CATEGORY_EMOJI[cat]}</span> {CATEGORY_LABELS[cat]} · {list.length}
                </th>
              </tr>
              {list.map((f) => {
                const source = SOURCE[f.source]
                const salt = saltFromSodium(f.per100g.sodium)
                return (
                  <tr key={f.id} data-food-row className="border-t border-border-100 hover:bg-cream-50">
                    {/* The name and its other names on one line, so a row is a
                        row and the figures line up down the page. */}
                    <th scope="row" className="px-4 py-2 text-left font-normal max-w-0 w-full">
                      <span className="block truncate">
                        <span className="font-bold text-ink-900">{f.names.en}</span>
                        {f.names.ro || f.names.hu ? (
                          <span className="text-ink-700"> {otherNames(f)}</span>
                        ) : null}
                      </span>
                    </th>
                    <td className="px-3 py-2"><TierBadge tier={f.medTier} /></td>
                    <td className="px-3 py-2 text-right font-extrabold text-ink-900 tabular-nums">{Math.round(f.per100g.calories)}</td>
                    <td className="px-3 py-2 text-right text-ink-900 tabular-nums whitespace-nowrap">{grams(f.per100g.protein)}</td>
                    <td className="px-3 py-2 text-right text-ink-900 tabular-nums whitespace-nowrap">{grams(f.per100g.carbs)}</td>
                    <td className="px-3 py-2 text-right text-ink-900 tabular-nums whitespace-nowrap">{grams(f.per100g.fat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {f.per100g.fiber == null
                        ? <span className="text-xs font-bold text-coral-700">not known</span>
                        : <span className="text-ink-900">{grams(f.per100g.fiber)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {salt == null
                        ? <span className="text-xs font-bold text-coral-700">not known</span>
                        : <span className="text-ink-900">{salt.toFixed(2)} g</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge whitespace-nowrap ${source.className}`}>{source.label}</span>
                    </td>
                    <td className="px-4 py-1 text-right">
                      <button
                        className="btn-secondary px-3 py-1.5"
                        onClick={() => onEdit(f)}
                        aria-label={`Edit ${f.names.en}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}

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
        <button className="btn-ghost text-ink-700" onClick={() => setDone(true)}>Not now</button>
      </div>
    </div>
  )
}
