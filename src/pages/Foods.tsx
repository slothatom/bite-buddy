import { useMemo, useState } from 'react'
import { Search, Plus, X, Loader2 } from 'lucide-react'
import type { Food, MedCategory, MedTier } from '../types'
import { useFoods, useFoodStore } from '../store/useFoodStore'
import { searchFoods, buildFoodIndex } from '../lib/foodSearch'
import { CATEGORY_EMOJI, CATEGORY_LABELS, TierBadge, EmptyState } from '../components/ui'
import { searchFoods as lookupOnline, type NutritionResult } from '../services/nutritionApi'

const CATEGORY_ORDER: MedCategory[] = [
  'vegetables', 'legumes', 'fruits', 'grains', 'nuts-seeds', 'herbs-spices',
  'fats-vinegars', 'dairy', 'fish-seafood', 'poultry', 'eggs', 'red-meat',
  'pantry', 'spreads-sauces', 'treats', 'sweeteners', 'beverages',
]

/**
 * The food database.
 *
 * Grouped by the Mediterranean guide's own categories so the library doubles as
 * the guide's food lists, with the tier badge showing how often each group is
 * meant to appear.
 */
export default function Foods() {
  const foods = useFoods()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MedCategory | null>(null)
  const [adding, setAdding] = useState(false)

  const index = useMemo(() => buildFoodIndex(foods), [foods])

  const visible = useMemo(() => {
    const base = query ? searchFoods(query, index, 500) : foods
    return category ? base.filter((f) => f.category === category) : base
  }, [foods, index, query, category])

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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-stone-800">Foods</h1>
            <p className="text-sm text-stone-500">
              {foods.length} foods with calories and macros per 100 g.
            </p>
          </div>
          <button className="btn-primary shrink-0" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add food
          </button>
        </header>

        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className="input pl-9"
              placeholder="Search — telemea, paine int, zabpehely, olive oil…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? null : c)}
                className={`badge shrink-0 whitespace-nowrap ${
                  category === c ? 'bg-brand-600 text-white' : 'bg-white border border-sand-300 text-stone-600'}`}
              >
                {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {grouped.length === 0 ? (
          <EmptyState emoji="🥬" title="No foods match that">
            Try another spelling, or add it yourself.
          </EmptyState>
        ) : (
          grouped.map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                <span>{CATEGORY_EMOJI[cat]}</span> {CATEGORY_LABELS[cat]}
                <span className="text-stone-400 font-normal">({list.length})</span>
              </h2>
              <div className="card divide-y divide-sand-100">
                {list.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 truncate">{f.names.en}</p>
                      <p className="text-xs text-stone-400 truncate">
                        {[f.names.ro, f.names.hu].filter(Boolean).join(' · ')}
                        {f.state !== 'as-sold' ? ` · weighed ${f.state}` : ''}
                      </p>
                    </div>
                    <TierBadge tier={f.medTier} />
                    <div className="text-right shrink-0 w-28">
                      <p className="text-sm font-mono font-bold text-stone-700">
                        {Math.round(f.per100g.calories)}<span className="text-stone-400 font-normal text-xs"> kcal</span>
                      </p>
                      <p className="text-[11px] font-mono text-stone-400">
                        {f.per100g.protein}p · {f.per100g.carbs}c · {f.per100g.fat}f
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {adding && <AddFoodModal onClose={() => setAdding(false)} />}
    </div>
  )
}

/**
 * Adds a food, either typed in or looked up.
 *
 * The lookup goes through the existing USDA and Open Food Facts clients. Those
 * databases are thin on Romanian and Hungarian staples, which is exactly why
 * the curated list exists — so manual entry is a first-class path, not a fallback.
 */
function AddFoodModal({ onClose }: { onClose: () => void }) {
  const { addFood } = useFoodStore()
  const [tab, setTab] = useState<'manual' | 'lookup'>('manual')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NutritionResult[]>([])
  const [searching, setSearching] = useState(false)

  const [draft, setDraft] = useState({
    en: '', ro: '', hu: '',
    category: 'vegetables' as MedCategory,
    medTier: 'daily' as MedTier,
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
  })

  async function runLookup() {
    if (!query.trim()) return
    setSearching(true)
    try {
      setResults(await lookupOnline(query))
    } finally {
      setSearching(false)
    }
  }

  function save() {
    if (!draft.en.trim()) return
    addFood({
      id: `custom-${Date.now().toString(36)}`,
      names: { en: draft.en.trim(), ro: draft.ro.trim() || undefined, hu: draft.hu.trim() || undefined },
      aliases: [draft.ro, draft.hu].filter(Boolean).map((s) => s.trim()),
      category: draft.category,
      medTier: draft.medTier,
      state: 'as-sold',
      per100g: {
        calories: draft.calories, protein: draft.protein,
        carbs: draft.carbs, fat: draft.fat,
        ...(draft.fiber ? { fiber: draft.fiber } : {}),
      },
      units: [],
      source: 'custom',
      createdAt: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/30 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-sand-200">
          <h2 className="font-bold text-stone-800">Add a food</h2>
          <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="p-5 space-y-4">
          <div className="flex gap-1 p-1 bg-sand-100 rounded-xl w-fit">
            {(['manual', 'lookup'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${
                  tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}>
                {t === 'manual' ? 'Type it in' : 'Look it up'}
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
                    onClick={() => {
                      setDraft((d) => ({
                        ...d, en: r.name,
                        calories: r.per100g.calories, protein: r.per100g.protein,
                        carbs: r.per100g.carbs, fat: r.per100g.fat,
                        fiber: r.micros?.fiber ?? 0,
                      }))
                      setTab('manual')
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-sand-100">
                    <p className="text-sm text-stone-800">{r.name}</p>
                    <p className="text-xs text-stone-400 font-mono">
                      {Math.round(r.per100g.calories)} kcal · {r.source}
                    </p>
                  </button>
                ))}
                {!searching && !results.length && (
                  <p className="text-sm text-stone-400 text-center py-4">
                    Nothing yet — search above, or type the food in by hand.
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="label">Name (English)</label>
                <input className="input" value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
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

              <p className="text-xs font-bold uppercase tracking-wide text-stone-400 pt-1">Per 100 g</p>
              <div className="grid grid-cols-5 gap-2">
                {([
                  ['calories', 'kcal'], ['protein', 'P'], ['carbs', 'C'], ['fat', 'F'], ['fiber', 'Fib'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input type="number" min={0} className="input px-2"
                      value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>

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
