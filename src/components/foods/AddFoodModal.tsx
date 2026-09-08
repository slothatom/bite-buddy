import { lazy, Suspense, useState } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import { readAmount, MOST } from '../../lib/amounts'
import { useDialog } from '../../lib/useDialog'
import type { Food, MedCategory, MedTier } from '../../types'
import { useFoodStore } from '../../store/useFoodStore'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../lib/categories'
import { saltFromSodium } from '../../lib/nutrition'
import {
  searchFoods as lookupOnline, lookupBarcode,
  type NutritionResult, type LookupOutcome, type LookupProblem,
} from '../../services/nutritionApi'
// @zxing is 477 kB, bigger than the rest of the app put together. Loading it
// only when the Scan tab is opened keeps it out of everyone else's way.
const BarcodeScanner = lazy(() => import('../recipes/BarcodeScanner'))

/**
 * Writing down a food the app has never heard of.
 *
 * This lived inside the Foods screen, which meant a food could only be created
 * from the Foods screen. That is fine for stocking a library and wrong for the
 * moment you actually meet a new food, which is with a plate in front of you
 * and the planner open: the app searched, found nothing, and offered you a
 * different tab to search instead. Going to Foods, typing it in, coming back
 * and finding the day again is four screens to record one yoghurt, and the
 * likeliest outcome is that nobody records the yoghurt.
 *
 * So it is a component both screens open. The planner passes `onSaved` and
 * puts the new food straight into the meal you were adding to, which is the
 * only reason you were creating it.
 */
export default function AddFoodModal({
  onClose, onSaved, initialName = '',
}: {
  onClose: () => void
  /**
   * Handed the food that was just written down.
   *
   * The Foods screen has no use for it: the library re-renders and the food is
   * in it. The planner does, because creating a food there is never the goal,
   * it is the obstacle in front of the goal.
   */
  onSaved?: (food: Food) => void
  /** What was already typed into the search that found nothing. */
  initialName?: string
}) {
  const panel = useDialog<HTMLDivElement>(onClose)
  const { addFood } = useFoodStore()
  const [tab, setTab] = useState<'manual' | 'lookup' | 'scan'>('manual')
  const [scanError, setScanError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NutritionResult[]>([])
  const [problems, setProblems] = useState<LookupOutcome['problems']>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)

  const [draft, setDraft] = useState({
    en: initialName, ro: '', hu: '',
    // No default. A guess here is filed under a heading nobody chose, and it
    // sticks: a camembert added without touching this select sat under
    // Vegetables on the shopping list for as long as it existed. A lookup
    // fills the name and the macros and knows nothing about the category, so
    // scanning a barcode used to be the fastest way to mis-file something.
    category: null as MedCategory | null,
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
    if (!draft.en.trim() || !draft.category) return

    // Whatever the source knew is kept, not just the fields on the form: a
    // micronutrient it reported is worth storing even though nothing here shows
    // it, and re-fetching it later would mean asking the same question twice.
    const source = imported?.source === 'usda' ? 'usda'
      : imported?.source === 'openfoodfacts' ? 'off'
      : 'custom'

    const food: Food = {
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
    }
    addFood(food)
    onSaved?.(food)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="bg-paper w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl"
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
                  <label className="label" htmlFor="new-food-ro">Romanian</label>
                  <input id="new-food-ro" className="input" value={draft.ro} onChange={(e) => setDraft({ ...draft, ro: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="new-food-hu">Hungarian</label>
                  <input id="new-food-hu" className="input" value={draft.hu} onChange={(e) => setDraft({ ...draft, hu: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="food-category">Category</label>
                  <select id="food-category" className="input" value={draft.category ?? ''}
                    onChange={(e) => setDraft({
                      ...draft, category: (e.target.value || null) as MedCategory | null,
                    })}>
                    <option value="">Choose one</option>
                    {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="new-food-tier">How often</label>
                  <select id="new-food-tier" className="input" value={draft.medTier}
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
                    {/* Tied to its input. These were bare `label` elements, so
                        the seven fields that hold a food's actual numbers had
                        no accessible name at all: a screen reader read seven
                        spin buttons and left you to infer which was the fat.
                        The visible text is per 100 g, which the heading above
                        says once, so the accessible name repeats it: a name
                        read out of sequence has no heading in front of it. */}
                    <label className="label" htmlFor={`new-food-${key}`}>{label}</label>
                    <input id={`new-food-${key}`} type="number" min={0} max={ceiling(key)}
                      className="input px-2"
                      aria-label={`${label} per 100 g`}
                      value={draft[key]}
                      onChange={(e) => setDraft({
                        ...draft, [key]: readAmount(e.target.value, { max: ceiling(key), places: 1 }),
                      })} />
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
                    {/* Tied to its input. These were bare `label` elements, so
                        the seven fields that hold a food's actual numbers had
                        no accessible name at all: a screen reader read seven
                        spin buttons and left you to infer which was the fat.
                        The visible text is per 100 g, which the heading above
                        says once, so the accessible name repeats it: a name
                        read out of sequence has no heading in front of it. */}
                    <label className="label" htmlFor={`new-food-${key}`}>{label}</label>
                    <input id={`new-food-${key}`} type="number" min={0} max={ceiling(key)}
                      className="input px-2"
                      aria-label={`${label} per 100 g`}
                      value={draft[key]}
                      onChange={(e) => setDraft({
                        ...draft, [key]: readAmount(e.target.value, { max: ceiling(key), places: 1 }),
                      })} />
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

              <button className="btn-primary w-full" onClick={save} disabled={!draft.en.trim() || !draft.category}>
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
 * The ceiling for one of a food's own figures, all of them per 100 g.
 *
 * A macro cannot exceed the 100 g it is measured in, calories top out around
 * pure fat, and sodium's ceiling is salt itself.
 */
function ceiling(key: string): number {
  if (key === 'calories') return MOST.caloriesPer100g
  if (key === 'sodium') return MOST.sodiumPer100g
  return MOST.gramsPer100g
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
