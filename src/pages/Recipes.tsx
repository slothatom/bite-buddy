import { useState } from 'react'
import {
  Plus, Search, X, Pencil, Trash2, Clock, Users,
  ChevronDown, ChevronUp, Zap, ScanBarcode, Loader2, Star,
} from 'lucide-react'
import { useRecipeStore } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import { lookupBarcode } from '../services/nutritionApi'
import type { NutritionResult } from '../services/nutritionApi'
import IngredientSearch from '../components/recipes/IngredientSearch'
import type { Recipe, Ingredient, PrepStep, RecipeTag, Micros } from '../types'

const ALL_TAGS: RecipeTag[] = [
  'high-protein','low-carb','vegan','vegetarian','quick','bulk',
  'breakfast','lunch','dinner','snack','dessert',
]
const TAG_COLORS: Record<RecipeTag, string> = {
  'high-protein': 'badge-green', 'low-carb': 'badge-purple', 'vegan': 'badge-green',
  'vegetarian': 'badge-green', 'quick': 'badge-gold', 'bulk': 'badge-gray',
  'breakfast': 'badge-gold', 'lunch': 'badge-green', 'dinner': 'badge-purple',
  'snack': 'badge-gray', 'dessert': 'badge-gold',
}

const COMMON_UNITS = ['g','ml','kg','L','oz','lb','cup','tbsp','tsp','piece','slice','serving']

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

const EMOJIS = ['🍗','🥗','🍲','🥣','🐟','🥩','🥦','🍳','🌮','🥙','🍱','🫐','🥑','🍜','🥘','🧆','🫕','🍛','🥚','🥓','🫙','🥜','🧃','🍌']

const BLANK: Omit<Recipe, 'id' | 'createdAt'> = {
  name: '', description: '', emoji: '🍽️', servings: 2,
  prepMinutes: 10, cookMinutes: 20, ingredients: [], steps: [],
  tags: [], macrosPerServing: { calories: 0, protein: 0, carbs: 0, fat: 0 },
}

// ── RecipeForm ──────────────────────────────────────────────────────────────

function RecipeForm({ initial, onSave, onCancel }: {
  initial?: Recipe; onSave: (r: Recipe) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<Omit<Recipe, 'id' | 'createdAt'>>(
    initial ? { ...initial } : { ...BLANK }
  )
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [BarcodeScanner, setBarcodeScanner] = useState<React.ComponentType<{ onDetected: (b: string) => void; onClose: () => void }> | null>(null)

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function addIngredient() {
    const ing: Ingredient = { id: newId(), name: '', amount: 100, unit: 'g', macros: { calories: 0, protein: 0, carbs: 0, fat: 0 } }
    set('ingredients', [...form.ingredients, ing])
  }

  function updateIngredient(id: string, updates: Partial<Ingredient>) {
    set('ingredients', form.ingredients.map((i) => {
      if (i.id !== id) return i
      const merged = { ...i, ...updates }
      // Recalculate macros if per100g is known and amount changed
      if (updates.amount !== undefined && i.per100g) {
        const scale = updates.amount / 100
        merged.macros = {
          calories: Math.round(i.per100g.calories * scale),
          protein:  Math.round(i.per100g.protein  * scale * 10) / 10,
          carbs:    Math.round(i.per100g.carbs    * scale * 10) / 10,
          fat:      Math.round(i.per100g.fat      * scale * 10) / 10,
        }
      }
      return merged
    }))
  }

  function removeIngredient(id: string) {
    set('ingredients', form.ingredients.filter((i) => i.id !== id))
  }

  function handleIngredientApiSelect(
    ingId: string, name: string,
    per100g?: NutritionResult['per100g'],
    micros?: NutritionResult['micros']
  ) {
    const ing = form.ingredients.find((i) => i.id === ingId)
    if (!ing) return
    const updates: Partial<Ingredient> = { name, per100g }
    if (per100g) {
      const scale = ing.amount / 100
      updates.macros = {
        calories: Math.round(per100g.calories * scale),
        protein:  Math.round(per100g.protein  * scale * 10) / 10,
        carbs:    Math.round(per100g.carbs    * scale * 10) / 10,
        fat:      Math.round(per100g.fat      * scale * 10) / 10,
      }
      if (micros) {
        const scaleMicro = (v?: number) => v !== undefined ? Math.round(v * scale * 10) / 10 : undefined
        updates.micros = {
          fiber:        scaleMicro(micros.fiber),
          sugar:        scaleMicro(micros.sugar),
          sodium:       scaleMicro(micros.sodium),
          calcium:      scaleMicro(micros.calcium),
          iron:         scaleMicro(micros.iron),
          vitaminC:     scaleMicro(micros.vitaminC),
          vitaminD:     scaleMicro(micros.vitaminD),
          potassium:    scaleMicro(micros.potassium),
          saturatedFat: scaleMicro(micros.saturatedFat),
        }
      }
    }
    updateIngredient(ingId, updates)
  }

  async function openBarcodeScanner() {
    const mod = await import('../components/recipes/BarcodeScanner')
    setBarcodeScanner(() => mod.default)
    setScanning(true)
  }

  async function handleBarcode(barcode: string) {
    setScanning(false)
    setScanLoading(true)
    try {
      const result = await lookupBarcode(barcode)
      if (result) {
        const ing: Ingredient = {
          id: newId(), name: result.name, amount: 100, unit: 'g',
          per100g: result.per100g,
          macros: { ...result.per100g },
          micros: result.micros ? {
            fiber: result.micros.fiber, sugar: result.micros.sugar,
            sodium: result.micros.sodium, calcium: result.micros.calcium,
          } as Micros : undefined,
        }
        set('ingredients', [...form.ingredients, ing])
      } else {
        alert(`Barcode ${barcode} not found in Open Food Facts. Add the ingredient manually.`)
      }
    } finally {
      setScanLoading(false)
    }
  }

  function addStep() {
    const step: PrepStep = { id: newId(), instruction: '', timerSeconds: 0 }
    set('steps', [...form.steps, step])
  }
  function updateStep(id: string, updates: Partial<PrepStep>) {
    set('steps', form.steps.map((s) => s.id === id ? { ...s, ...updates } : s))
  }
  function removeStep(id: string) {
    set('steps', form.steps.filter((s) => s.id !== id))
  }
  function toggleTag(tag: RecipeTag) {
    const tags = form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag]
    set('tags', tags)
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave({ ...form, id: initial?.id ?? newId(), createdAt: initial?.createdAt ?? new Date().toISOString() })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm py-4 px-4">
      <div className="card w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-lg">{initial ? 'Edit Recipe' : 'New Recipe'}</h2>
          <button onClick={onCancel} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Name + emoji */}
          <div className="flex gap-3 items-start">
            <div className="relative shrink-0">
              <button
                type="button"
                className="w-14 h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 text-3xl flex items-center justify-center transition-colors"
                onClick={() => setEmojiOpen((v) => !v)}
              >{form.emoji}</button>
              {emojiOpen && (
                <div className="absolute top-16 left-0 z-10 card p-3 grid grid-cols-6 gap-1 shadow-lg w-52">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button"
                      className="text-xl p-1 rounded-lg hover:bg-gray-100"
                      onClick={() => { set('emoji', e); setEmojiOpen(false) }}
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="label">Recipe name *</label>
              <input className="input" placeholder="e.g. Chicken & Rice Bowl" autoFocus
                value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Brief description…"
              value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Servings</label>
              <input type="number" min={1} className="input" value={form.servings}
                onChange={(e) => set('servings', +e.target.value)} /></div>
            <div><label className="label">Prep (min)</label>
              <input type="number" min={0} className="input" value={form.prepMinutes}
                onChange={(e) => set('prepMinutes', +e.target.value)} /></div>
            <div><label className="label">Cook (min)</label>
              <input type="number" min={0} className="input" value={form.cookMinutes}
                onChange={(e) => set('cookMinutes', +e.target.value)} /></div>
          </div>

          <div>
            <label className="label">Macros per serving</label>
            <div className="grid grid-cols-4 gap-2">
              {(['calories','protein','carbs','fat'] as const).map((k) => (
                <div key={k}>
                  <label className="text-xs text-gray-400 mb-1 block">{k === 'calories' ? 'kcal' : k + ' g'}</label>
                  <input type="number" min={0} className="input"
                    value={form.macrosPerServing[k]}
                    onChange={(e) => set('macrosPerServing', { ...form.macrosPerServing, [k]: +e.target.value })} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                  className={`tag transition-all ${form.tags.includes(tag) ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-400' : 'hover:bg-gray-200'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Ingredients</label>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost text-xs" onClick={openBarcodeScanner}
                  disabled={scanLoading}>
                  {scanLoading
                    ? <><Loader2 size={12} className="animate-spin" /> Looking up…</>
                    : <><ScanBarcode size={12} /> Scan barcode</>}
                </button>
                <button type="button" className="btn-ghost text-xs" onClick={addIngredient}>
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {form.ingredients.map((ing) => (
                <div key={ing.id}>
                  <div className="grid grid-cols-[1fr_70px_90px_auto] gap-1.5 items-center">
                    <IngredientSearch
                      value={ing.name}
                      onChange={(name, per100g, micros) => handleIngredientApiSelect(ing.id, name, per100g, micros)}
                    />
                    <input type="number" min={0} className="input text-xs" placeholder="Amt"
                      value={ing.amount}
                      onChange={(e) => updateIngredient(ing.id, { amount: +e.target.value })} />
                    <select className="input text-xs" value={ing.unit}
                      onChange={(e) => updateIngredient(ing.id, { unit: e.target.value })}>
                      {COMMON_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button type="button" className="text-gray-400 hover:text-red-500 p-1"
                      onClick={() => removeIngredient(ing.id)}><X size={14} /></button>
                  </div>
                  {/* Macro preview */}
                  {(ing.macros.calories > 0 || ing.macros.protein > 0) && (
                    <p className="text-[10px] text-gray-400 mt-0.5 pl-1 font-mono">
                      {ing.macros.calories}kcal · {ing.macros.protein}g P · {ing.macros.carbs}g C · {ing.macros.fat}g F
                      {ing.micros?.fiber !== undefined && ` · fiber ${ing.micros.fiber}g`}
                    </p>
                  )}
                </div>
              ))}
              {form.ingredients.length === 0 && (
                <p className="text-xs text-gray-400 py-2">No ingredients — add manually or scan a barcode.</p>
              )}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Prep Steps</label>
              <button type="button" className="btn-ghost text-xs" onClick={addStep}><Plus size={12} /> Add step</button>
            </div>
            <div className="space-y-2">
              {form.steps.map((step, idx) => (
                <div key={step.id} className="flex gap-2 items-start">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-xs font-bold text-gray-500 flex items-center justify-center mt-2">{idx + 1}</span>
                  <input className="input text-xs flex-1" placeholder="Instruction…"
                    value={step.instruction} onChange={(e) => updateStep(step.id, { instruction: e.target.value })} />
                  <div className="flex items-center gap-1 shrink-0">
                    <input type="number" min={0} className="input text-xs w-16" placeholder="0"
                      value={step.timerSeconds || ''} onChange={(e) => updateStep(step.id, { timerSeconds: +e.target.value })} />
                    <span className="text-xs text-gray-400">s</span>
                  </div>
                  <button type="button" className="text-gray-400 hover:text-red-500 p-1 mt-1.5"
                    onClick={() => removeStep(step.id)}><X size={14} /></button>
                </div>
              ))}
              {form.steps.length === 0 && <p className="text-xs text-gray-400 py-2">No steps yet.</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={!form.name.trim()}>
            {initial ? 'Save Changes' : 'Create Recipe'}
          </button>
        </div>
      </div>

      {scanning && BarcodeScanner && (
        <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />
      )}
    </div>
  )
}

// ── RecipeCard ──────────────────────────────────────────────────────────────

function RecipeCard({ recipe, isFavorite, onEdit, onDelete, onPrepMode, onToggleFavorite }: {
  recipe: Recipe; isFavorite: boolean; onEdit: () => void; onDelete: () => void; onPrepMode: () => void; onToggleFavorite: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const total = recipe.prepMinutes + recipe.cookMinutes

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl">{recipe.emoji}</span>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{recipe.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{recipe.description}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button className={`btn-ghost btn-icon transition-colors ${isFavorite ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
              onClick={onToggleFavorite} title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
              <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button className="btn-ghost btn-icon text-gray-400 hover:text-brand-600" onClick={onEdit}><Pencil size={14} /></button>
            <button className="btn-ghost btn-icon text-gray-400 hover:text-red-500" onClick={onDelete}><Trash2 size={14} /></button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-xs text-gray-500"><Clock size={12} /> {total}m</span>
          <span className="flex items-center gap-1 text-xs text-gray-500"><Users size={12} /> {recipe.servings} srv</span>
          <span className="text-xs font-bold text-gray-700 ml-auto">{recipe.macrosPerServing.calories} kcal</span>
        </div>

        <div className="flex gap-1.5 mt-2 flex-wrap">
          <span className="badge-green">{recipe.macrosPerServing.protein}g P</span>
          <span className="badge-purple">{recipe.macrosPerServing.carbs}g C</span>
          <span className="badge-gold">{recipe.macrosPerServing.fat}g F</span>
          {recipe.microsPerServing?.fiber !== undefined && (
            <span className="badge-gray">{recipe.microsPerServing.fiber}g fiber</span>
          )}
        </div>

        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.tags.slice(0, 3).map((t) => <span key={t} className={TAG_COLORS[t]}>{t}</span>)}
            {recipe.tags.length > 3 && <span className="badge-gray">+{recipe.tags.length - 3}</span>}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100">
        <button
          className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <span>{recipe.ingredients.length} ingredients · {recipe.steps.length} steps</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            {recipe.ingredients.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ingredients</p>
                <ul className="space-y-1">
                  {recipe.ingredients.map((ing) => (
                    <li key={ing.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{ing.name}</span>
                      <div className="text-right">
                        <span className="text-gray-400 font-mono text-xs">{ing.amount} {ing.unit}</span>
                        {ing.macros.calories > 0 && (
                          <p className="text-[10px] text-gray-300">{ing.macros.calories} kcal</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recipe.steps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Steps</p>
                <ol className="space-y-1.5">
                  {recipe.steps.map((step, i) => (
                    <li key={step.id} className="flex gap-2 text-sm">
                      <span className="w-4 h-4 shrink-0 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="text-gray-700 flex-1">{step.instruction}</span>
                      {step.timerSeconds > 0 && <span className="badge-gold shrink-0">{Math.round(step.timerSeconds / 60)}m</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <button className="btn-xp w-full mt-2" onClick={onPrepMode}>
              <Zap size={14} /> Start Prep Mode
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Recipes() {
  const { recipes, favoriteIds, addRecipe, updateRecipe, deleteRecipe, toggleFavorite } = useRecipeStore()
  const { unlockAchievement, addXp } = useUserStore()
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<RecipeTag | null>(null)
  const [favOnly, setFavOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)

  const filtered = recipes.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
    const matchTag = !tagFilter || r.tags.includes(tagFilter)
    const matchFav = !favOnly || favoriteIds.includes(r.id)
    return matchSearch && matchTag && matchFav
  })

  function handleSave(recipe: Recipe) {
    if (editing) { updateRecipe(recipe.id, recipe) }
    else {
      addRecipe(recipe)
      if (recipes.length === 0) unlockAchievement('first_recipe')
      if (recipes.length + 1 >= 5) unlockAchievement('five_recipes')
      addXp(30)
    }
    setFormOpen(false); setEditing(null)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Recipes</h1>
          <button className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus size={15} /> New
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-sm" placeholder="Search recipes…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={`flex items-center gap-1.5 tag transition-all ${favOnly ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-400' : 'hover:bg-gray-200'}`}>
            <Star size={12} fill={favOnly ? 'currentColor' : 'none'} /> Favorites
          </button>
          <div className="flex gap-1 flex-wrap">
            {ALL_TAGS.slice(0, 5).map((tag) => (
              <button key={tag}
                className={`tag transition-all ${tagFilter === tag ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-400' : 'hover:bg-gray-200'}`}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              >{tag}</button>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-400">{filtered.length} of {recipes.length} recipes{favOnly ? ` · ${favoriteIds.length} favorited` : ''}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe}
              isFavorite={favoriteIds.includes(recipe.id)}
              onEdit={() => { setEditing(recipe); setFormOpen(true) }}
              onDelete={() => deleteRecipe(recipe.id)}
              onPrepMode={() => { window.location.hash = `/prep?recipe=${recipe.id}` }}
              onToggleFavorite={() => toggleFavorite(recipe.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🍽️</p>
            <p className="font-semibold text-gray-700">No recipes found</p>
            <p className="text-sm text-gray-400 mt-1">Add your first recipe to get started</p>
          </div>
        )}
      </div>

      {(formOpen || editing) && (
        <RecipeForm initial={editing ?? undefined} onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null) }} />
      )}
    </div>
  )
}
