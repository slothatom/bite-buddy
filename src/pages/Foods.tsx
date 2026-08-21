import { lazy, Suspense, useMemo, useState } from 'react'
import { Search, Plus, X, Loader2, Combine } from 'lucide-react'
import type { Food, MedCategory, MedTier } from '../types'
import { isCuratedFood, useFoods, useFoodStore } from '../store/useFoodStore'
import { duplicateFoods } from '../lib/mergeFoods'
import { searchFoods, buildFoodIndex } from '../lib/foodSearch'
import { TierBadge, EmptyState, SourceLine, ChipRow } from '../components/ui'
import { CATEGORY_EMOJI, CATEGORY_LABELS, CATEGORY_ORDER } from '../lib/categories'
import FoodEditor from '../components/foods/FoodEditor'
import { saltFromSodium } from '../lib/nutrition'
import {
  searchFoods as lookupOnline, lookupBarcode,
  type NutritionResult, type LookupOutcome, type LookupProblem,
} from '../services/nutritionApi'
// @zxing is 477 kB, bigger than the rest of the app put together. Loading it
// only when the Scan tab is opened keeps it out of everyone else's way.
const BarcodeScanner = lazy(() => import('../components/recipes/BarcodeScanner'))

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
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
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
            <input
              className="input pl-9"
              placeholder="Search telemea, paine int, zabpehely, olive oil…"
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
      <Combine size={20} className="text-bite-600 shrink-0" />
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

function AddFoodModal({ onClose }: { onClose: () => void }) {
  const { addFood } = useFoodStore()
  const [tab, setTab] = useState<'manual' | 'lookup' | 'scan'>('manual')
  const [scanError, setScanError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NutritionResult[]>([])
  const [problems, setProblems] = useState<LookupOutcome['problems']>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)

  const [draft, setDraft] = useState({
    en: '', ro: '', hu: '',
    category: 'vegetables' as MedCategory,
    medTier: 'daily' as MedTier,
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
  })
  /** Everything the source said, kept whole so nothing is lost on the way in. */
  const [imported, setImported] = useState<NutritionResult | null>(null)

  async function runLookup() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const outcome = await lookupOnline(query)
      setResults(outcome.results)
      setProblems(outcome.problems)
    } finally {
      setSearched(true)
      setSearching(false)
    }
  }

  /** Fills the form from a lookup or a scan and hands you back the fields. */
  function applyResult(r: NutritionResult) {
    setImported(r)
    setDraft((d) => ({
      ...d, en: r.name,
      calories: r.per100g.calories, protein: r.per100g.protein,
      carbs: r.per100g.carbs, fat: r.per100g.fat,
      fiber: r.micros?.fiber ?? 0,
      sugar: r.micros?.sugar ?? 0,
      sodium: r.micros?.sodium ?? 0,
    }))
    setTab('manual')
  }

  async function onBarcode(code: string) {
    setScanError(null)
    const outcome = await lookupBarcode(code)
    if (outcome.found) applyResult(outcome.food)
    else setScanError(barcodeMessage(outcome.reason))
  }

  function save() {
    if (!draft.en.trim()) return

    // Whatever the source knew is kept, not just the fields on the form: a
    // micronutrient it reported is worth storing even though nothing here shows
    // it, and re-fetching it later would mean asking the same question twice.
    const source = imported?.source === 'usda' ? 'usda'
      : imported?.source === 'openfoodfacts' ? 'off'
      : 'custom'

    addFood({
      id: `custom-${Date.now().toString(36)}`,
      names: { en: draft.en.trim(), ro: draft.ro.trim() || undefined, hu: draft.hu.trim() || undefined },
      aliases: [draft.ro, draft.hu].filter(Boolean).map((s) => s.trim()),
      category: draft.category,
      medTier: draft.medTier,
      state: 'as-sold',
      per100g: {
        ...imported?.micros,
        calories: draft.calories, protein: draft.protein,
        carbs: draft.carbs, fat: draft.fat,
        // Typed-in zeros mean "nothing entered", not "none of it": storing them
        // would turn an unknown into a claim.
        ...(draft.fiber ? { fiber: draft.fiber } : {}),
        ...(draft.sugar ? { sugar: draft.sugar } : {}),
        ...(draft.sodium ? { sodium: draft.sodium } : {}),
      },
      units: [],
      source,
      provenance: {
        source,
        externalId: imported?.externalId,
        sourceName: imported?.sourceName,
        basePortion: imported?.basePortion ?? { amount: 100, unit: 'g' },
        retrievedAt: imported ? new Date().toISOString() : undefined,
        saltAsGiven: imported?.saltAsGiven,
      },
      createdAt: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div className="bg-paper w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-border-200">
          <h2 className="text-base font-extrabold text-ink-900">Add a food</h2>
          <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="p-5 space-y-4">
          <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit">
            {(['manual', 'lookup', 'scan'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={tab === t ? 'tab-on' : 'tab-off'}>
                {t === 'manual' ? 'Type it in' : t === 'lookup' ? 'Look it up' : 'Scan'}
              </button>
            ))}
          </div>

          {tab === 'lookup' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  className="input" placeholder="Search USDA and Open Food Facts…"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runLookup() }}
                />
                <button className="btn-primary shrink-0" onClick={runLookup} disabled={searching}>
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {results.map((r, i) => (
                  <button key={i}
                    onClick={() => applyResult(r)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-cream-50">
                    <p className="text-sm text-ink-900">{r.name}</p>
                    <p className="text-xs text-ink-500 font-mono">
                      {Math.round(r.per100g.calories)} kcal · {r.source}
                    </p>
                  </button>
                ))}
                {!searching && !results.length && (
                  <p className="text-sm text-ink-500 text-center py-4">
                    {!searched
                      ? 'Nothing yet. Search above, or just type it in by hand.'
                      : lookupMessage(problems)}
                  </p>
                )}
                {/* Partial failures matter too: results from one source while
                    the other is down looks like a complete answer otherwise. */}
                {!searching && results.length > 0 && problems.length > 0 && (
                  <p className="text-xs text-mustard-700 text-center pt-1">
                    {lookupMessage(problems)}
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'scan' && (
            <div className="space-y-3">
              <p className="text-sm text-ink-700">
                Point the camera at a barcode. Packaged goods only, since Open Food Facts has no
                barcode for a carrot.
              </p>
              <Suspense fallback={<p className="text-sm text-ink-500">Starting the camera…</p>}>
                <BarcodeScanner onDetected={(code) => void onBarcode(code)} onClose={() => setTab('manual')} />
              </Suspense>
              {scanError && <p className="text-sm text-coral-600">{scanError}</p>}
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="new-food-name">Name (English)</label>
                <input
                  id="new-food-name"
                  className="input"
                  value={draft.en}
                  onChange={(e) => setDraft({ ...draft, en: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Romanian</label>
                  <input className="input" value={draft.ro} onChange={(e) => setDraft({ ...draft, ro: e.target.value })} />
                </div>
                <div>
                  <label className="label">Hungarian</label>
                  <input className="input" value={draft.hu} onChange={(e) => setDraft({ ...draft, hu: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as MedCategory })}>
                    {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">How often</label>
                  <select className="input" value={draft.medTier}
                    onChange={(e) => setDraft({ ...draft, medTier: e.target.value as MedTier })}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="moderate">In moderation</option>
                    <option value="rare">Rarely</option>
                  </select>
                </div>
              </div>

              <p className="text-xs font-bold uppercase tracking-wide text-ink-500 pt-1">Per 100 g</p>
              <div className="grid grid-cols-4 gap-2">
                {([
                  ['calories', 'kcal'], ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input type="number" min={0} className="input px-2"
                      value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>

              {/* Sugar and salt get their own row because they are the two you
                  are keeping an eye on across a day, not just per food. */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['fiber', 'Fibre g'], ['sugar', 'Sugar g'], ['sodium', 'Sodium mg'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input type="number" min={0} className="input px-2"
                      value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
              {draft.sodium > 0 && (
                <p className="text-xs text-ink-500 -mt-1">
                  That is about {(saltFromSodium(draft.sodium) ?? 0).toFixed(2)} g of salt.
                </p>
              )}
              <p className="text-xs text-ink-500">
                Leave anything you do not know blank. A zero here means there is none of it,
                which is a different claim.
              </p>

              {imported && (
                <div className="card-soft p-3 text-xs text-ink-700 space-y-0.5">
                  <p>
                    From <strong>{imported.source === 'usda' ? 'USDA FoodData Central' : 'Open Food Facts'}</strong>
                    {imported.externalId ? ` · ${imported.externalId}` : ''}
                  </p>
                  <p className="text-ink-500">
                    Per {imported.basePortion.amount} {imported.basePortion.unit}
                    {imported.micros && Object.keys(imported.micros).length > 0
                      ? ` · ${Object.keys(imported.micros).length} nutrients kept`
                      : ''}
                  </p>
                </div>
              )}

              <button className="btn-primary w-full" onClick={save} disabled={!draft.en.trim()}>
                Save food
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * What to say when a lookup did not simply find nothing.
 *
 * Being rate-limited is the common one: without a key of your own the USDA
 * allows about 30 requests an hour, and the old code reported that as "no
 * results", which sends you off to type in numbers it already had.
 */
function lookupMessage(problems: LookupOutcome['problems']): string {
  if (!problems.length) return 'No matches. Try another spelling, or type it in by hand.'

  if (problems.every((p) => p.reason === 'offline')) {
    return "You're offline, so the food databases can't be reached. Type it in by hand and it'll work the same."
  }
  if (problems.some((p) => p.reason === 'rate-limited')) {
    return 'The USDA database is rate-limiting this app. Wait a few minutes, add your own free API key, or type it in by hand.'
  }
  const down = problems.map((p) => (p.source === 'usda' ? 'USDA' : 'Open Food Facts')).join(' and ')
  return `${down} ${problems.length > 1 ? 'are' : 'is'} not responding right now. Try again shortly, or type it in by hand.`
}

function barcodeMessage(reason: 'unknown-product' | LookupProblem): string {
  switch (reason) {
    case 'unknown-product':
      return "Open Food Facts doesn't know that barcode. Type the label's numbers in instead."
    case 'offline':
      return "You're offline, so the barcode can't be looked up. The label has the same numbers on it."
    case 'rate-limited':
      return 'Too many lookups just now. Wait a moment and scan again.'
    default:
      return 'Open Food Facts is not responding. Try again shortly, or type it in.'
  }
}
