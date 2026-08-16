import { useMemo, useState } from 'react'
import { Search, Star, ClipboardCopy, X, ChefHat } from 'lucide-react'
import type { Recipe, RecipeTag } from '../types'
import { useRecipes, useRecipeStore } from '../store/useRecipeStore'
import { useNutritionContext } from '../store/useNutrition'
import { recipePerServing, roundNutrients } from '../lib/nutrition'
import { normaliseTerm } from '../lib/units'
import { NutrientSummary, EmptyState } from '../components/ui'
import { recipeForMfp, copyToClipboard } from '../lib/mfp'

const FILTER_TAGS: RecipeTag[] = [
  'breakfast', 'lunch', 'dinner', 'snack', 'soup', 'salad', 'spread',
  'high-protein', 'vegan', 'vegetarian', 'pescatarian', 'quick', 'batch',
]

export default function Recipes() {
  const recipes = useRecipes()
  const { favouriteIds, toggleFavourite } = useRecipeStore()
  const ctx = useNutritionContext()

  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<RecipeTag | null>(null)
  const [favesOnly, setFavesOnly] = useState(false)
  const [open, setOpen] = useState<Recipe | null>(null)

  const filtered = useMemo(() => {
    const n = normaliseTerm(query)
    return recipes
      .filter((r) => {
        if (favesOnly && !favouriteIds.includes(r.id)) return false
        if (tag && !r.tags.includes(tag)) return false
        if (!n) return true
        // Searching the original dietician line too, so "telemea" finds the
        // meals that were written in Romanian.
        const haystack = normaliseTerm(
          [r.name.en, r.name.ro, r.name.hu, r.sourceLine].filter(Boolean).join(' '))
        return haystack.includes(n)
      })
      .sort((a, b) => a.name.en.localeCompare(b.name.en))
  }, [recipes, query, tag, favesOnly, favouriteIds])

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="text-2xl font-display font-semibold text-stone-700">Recipes</h1>
          <p className="text-sm text-stone-500">
            Every meal from your dietician plans, plus the dishes behind them — {recipes.length} in all.
          </p>
        </header>

        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className="input pl-9"
              placeholder="Search in English, Romanian or Hungarian…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setFavesOnly((v) => !v)}
              className={favesOnly ? 'chip bg-clay-500 text-white border border-clay-500' : 'chip-off'}
            >
              <Star size={12} className={favesOnly ? 'fill-current' : ''} /> Favourites
            </button>
            {FILTER_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? null : t)}
                className={`capitalize ${tag === t ? 'chip-on' : 'chip-off'}`}
              >
                {t.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Nothing matching that just yet">
            Try another word, or clear the filters.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => {
              const n = roundNutrients(recipePerServing(r, ctx))
              return (
                // The star is a sibling of the card button, not a child: nested
                // buttons are invalid and lose their click handler.
                <div key={r.id} className="card p-4 relative min-w-0 hover:border-brand-300 transition-colors">
                  <button
                    onClick={() => toggleFavourite(r.id)}
                    className="absolute top-1.5 right-1.5 p-3.5 text-stone-300 hover:text-clay-500 z-10"
                    aria-label={favouriteIds.includes(r.id) ? 'Remove from favourites' : 'Add to favourites'}
                  >
                    <Star size={16} className={favouriteIds.includes(r.id) ? 'fill-clay-500 text-clay-500' : ''} />
                  </button>
                  <button onClick={() => setOpen(r)} className="block w-full min-w-0 text-left">
                    <span className="flex items-start gap-3 pr-10 min-w-0">
                      <span className="text-2xl leading-none shrink-0">{r.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-stone-800 text-sm leading-snug">{r.name.en}</span>
                        {r.sourceLine ? (
                          <span className="block text-[11px] text-stone-400 truncate mt-0.5">{r.sourceLine}</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="flex items-baseline gap-3 mt-3 text-xs font-mono text-stone-500">
                      <span className="font-bold text-stone-700">{Math.round(n.calories)} kcal</span>
                      <span>P {n.protein}</span>
                      <span>C {n.carbs}</span>
                      <span>F {n.fat}</span>
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {open && <RecipeDetail recipe={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function RecipeDetail({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const ctx = useNutritionContext()
  const [copied, setCopied] = useState(false)
  const perServing = roundNutrients(recipePerServing(recipe, ctx))

  async function copyForMfp() {
    const ok = await copyToClipboard(recipeForMfp(recipe, ctx))
    setCopied(ok)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/30 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-white flex items-start justify-between gap-3 px-5 py-4 border-b border-sand-200">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl leading-none">{recipe.emoji}</span>
            <div className="min-w-0">
              <h2 className="font-display font-semibold text-stone-700 leading-snug">{recipe.name.en}</h2>
              {recipe.name.ro || recipe.name.hu ? (
                <p className="text-xs text-stone-400">{[recipe.name.ro, recipe.name.hu].filter(Boolean).join(' · ')}</p>
              ) : null}
            </div>
          </div>
          <button className="btn-ghost btn-icon shrink-0" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="p-5 space-y-5">
          {recipe.sourceLine ? (
            <div className="card-soft p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1">How your dietician wrote it</p>
              <p className="text-sm text-stone-600 italic">{recipe.sourceLine}</p>
            </div>
          ) : null}

          <div>
            <p className="text-3xl font-extrabold font-mono text-stone-800">
              {Math.round(perServing.calories)}<span className="text-base font-semibold text-stone-400 ml-1">kcal</span>
            </p>
            <p className="text-xs text-stone-400 mb-3">
              per serving · makes {recipe.servings}
              {recipe.prepMinutes || recipe.cookMinutes
                ? ` · ${recipe.prepMinutes + recipe.cookMinutes} min`
                : ''}
            </p>
            <NutrientSummary n={perServing} />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">What goes in</p>
            <ul className="space-y-1">
              {recipe.components.map((c, i) => {
                const label = c.kind === 'food'
                  ? ctx.foods.get(c.foodId)?.names.en ?? c.foodId
                  : ctx.recipes.get(c.recipeId)?.name.en ?? c.recipeId
                const qty = c.kind === 'food' ? `${Math.round(c.grams)} g` : `${c.servings}×`
                return (
                  <li key={i} className="flex justify-between text-sm text-stone-700">
                    <span>{label}</span>
                    <span className="font-mono text-stone-500">{qty}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          {recipe.steps.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">How to make it</p>
              <ol className="space-y-2">
                {recipe.steps.map((s, i) => (
                  <li key={s.id} className="flex gap-3 text-sm text-stone-700">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-800 text-xs font-bold grid place-items-center">
                      {i + 1}
                    </span>
                    <span>{s.instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <button className="btn-secondary w-full" onClick={copyForMfp}>
            <ClipboardCopy size={15} /> {copied ? 'Copied to clipboard' : 'Copy for MyFitnessPal'}
          </button>
          {recipe.steps.length === 0 && (
            <p className="flex items-start gap-2 text-xs text-stone-400">
              <ChefHat size={14} className="shrink-0 mt-0.5" />
              This one came straight from a plan, so it lists what goes in but not how.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
