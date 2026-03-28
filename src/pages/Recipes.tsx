import { useState } from 'react'
import { Plus, Search, X, Pencil, Trash2, Clock, Users, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { useRecipeStore } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import type { Recipe, Ingredient, PrepStep, RecipeTag } from '../types'

const ALL_TAGS: RecipeTag[] = [
  'high-protein', 'low-carb', 'vegan', 'vegetarian', 'quick', 'bulk',
  'breakfast', 'lunch', 'dinner', 'snack', 'dessert',
]

const TAG_COLORS: Record<RecipeTag, string> = {
  'high-protein': 'badge-green',
  'low-carb':     'badge-purple',
  'vegan':        'badge-green',
  'vegetarian':   'badge-green',
  'quick':        'badge-gold',
  'bulk':         'badge-gray',
  'breakfast':    'badge-gold',
  'lunch':        'badge-green',
  'dinner':       'badge-purple',
  'snack':        'badge-gray',
  'dessert':      'badge-gold',
}

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

const BLANK_RECIPE: Omit<Recipe, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  emoji: '🍽️',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  ingredients: [],
  steps: [],
  tags: [],
  macrosPerServing: { calories: 0, protein: 0, carbs: 0, fat: 0 },
}

const EMOJIS = ['🍗','🥗','🍲','🥣','🐟','🥩','🥦','🍳','🌮','🥙','🍱','🫐','🥑','🍜','🥘','🧆','🫕','🍛']

// ── RecipeForm ──────────────────────────────────────────────────────────────

function RecipeForm({ initial, onSave, onCancel }: {
  initial?: Recipe
  onSave: (r: Recipe) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Omit<Recipe, 'id' | 'createdAt'>>(
    initial ? { ...initial } : { ...BLANK_RECIPE }
  )
  const [emojiOpen, setEmojiOpen] = useState(false)

  function updateField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function addIngredient() {
    const ing: Ingredient = {
      id: newId(), name: '', amount: 100, unit: 'g',
      macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    }
    updateField('ingredients', [...form.ingredients, ing])
  }

  function updateIngredient(id: string, updates: Partial<Ingredient>) {
    updateField('ingredients', form.ingredients.map((i) => i.id === id ? { ...i, ...updates } : i))
  }

  function removeIngredient(id: string) {
    updateField('ingredients', form.ingredients.filter((i) => i.id !== id))
  }

  function addStep() {
    const step: PrepStep = { id: newId(), instruction: '', timerSeconds: 0 }
    updateField('steps', [...form.steps, step])
  }

  function updateStep(id: string, updates: Partial<PrepStep>) {
    updateField('steps', form.steps.map((s) => s.id === id ? { ...s, ...updates } : s))
  }

  function removeStep(id: string) {
    updateField('steps', form.steps.filter((s) => s.id !== id))
  }

  function toggleTag(tag: RecipeTag) {
    const tags = form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag]
    updateField('tags', tags)
  }

  function handleSave() {
    if (!form.name.trim()) return
    const recipe: Recipe = {
      ...form,
      id: initial?.id ?? newId(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    }
    onSave(recipe)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm py-6 px-4">
      <div className="card w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900">{initial ? 'Edit Recipe' : 'New Recipe'}</h2>
          <button onClick={onCancel} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Name + emoji */}
          <div className="flex gap-3 items-start">
            <div className="relative">
              <button
                className="w-14 h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 transition-colors text-3xl flex items-center justify-center"
                onClick={() => setEmojiOpen((v) => !v)}
                type="button"
              >
                {form.emoji}
              </button>
              {emojiOpen && (
                <div className="absolute top-16 left-0 z-10 card p-3 grid grid-cols-6 gap-1 shadow-lg w-52">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      className="text-xl p-1 rounded-lg hover:bg-gray-100 transition-colors"
                      onClick={() => { updateField('emoji', e); setEmojiOpen(false) }}
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="label">Recipe name *</label>
              <input
                className="input"
                placeholder="e.g. Chicken & Rice Power Bowl"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Brief description…"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>

          {/* Servings, prep, cook */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Servings</label>
              <input type="number" min={1} className="input" value={form.servings}
                onChange={(e) => updateField('servings', +e.target.value)} />
            </div>
            <div>
              <label className="label">Prep (min)</label>
              <input type="number" min={0} className="input" value={form.prepMinutes}
                onChange={(e) => updateField('prepMinutes', +e.target.value)} />
            </div>
            <div>
              <label className="label">Cook (min)</label>
              <input type="number" min={0} className="input" value={form.cookMinutes}
                onChange={(e) => updateField('cookMinutes', +e.target.value)} />
            </div>
          </div>

          {/* Macros per serving */}
          <div>
            <label className="label">Macros per serving</label>
            <div className="grid grid-cols-4 gap-2">
              {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
                <div key={k}>
                  <label className="text-xs text-gray-400 capitalize mb-1 block">{k === 'calories' ? 'kcal' : k + ' g'}</label>
                  <input type="number" min={0} className="input"
                    value={form.macrosPerServing[k]}
                    onChange={(e) =>
                      updateField('macrosPerServing', { ...form.macrosPerServing, [k]: +e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`tag transition-all ${
                    form.tags.includes(tag) ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-400' : ''
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Ingredients</label>
              <button className="btn-ghost text-xs" onClick={addIngredient}><Plus size={13} /> Add</button>
            </div>
            <div className="space-y-2">
              {form.ingredients.map((ing) => (
                <div key={ing.id} className="grid grid-cols-[1fr_80px_70px_auto] gap-2 items-center">
                  <input className="input text-xs" placeholder="Name" value={ing.name}
                    onChange={(e) => updateIngredient(ing.id, { name: e.target.value })} />
                  <input type="number" min={0} className="input text-xs" placeholder="Amount" value={ing.amount}
                    onChange={(e) => updateIngredient(ing.id, { amount: +e.target.value })} />
                  <input className="input text-xs" placeholder="Unit" value={ing.unit}
                    onChange={(e) => updateIngredient(ing.id, { unit: e.target.value })} />
                  <button className="text-gray-400 hover:text-red-500 transition-colors p-1" onClick={() => removeIngredient(ing.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {form.ingredients.length === 0 && (
                <p className="text-xs text-gray-400 py-2">No ingredients yet.</p>
              )}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Prep Steps</label>
              <button className="btn-ghost text-xs" onClick={addStep}><Plus size={13} /> Add Step</button>
            </div>
            <div className="space-y-2">
              {form.steps.map((step, idx) => (
                <div key={step.id} className="flex gap-2 items-start">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-xs font-bold text-gray-500 flex items-center justify-center mt-2">
                    {idx + 1}
                  </span>
                  <input className="input text-xs flex-1" placeholder="Instruction…" value={step.instruction}
                    onChange={(e) => updateStep(step.id, { instruction: e.target.value })} />
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} className="input text-xs w-20" placeholder="Sec" value={step.timerSeconds || ''}
                      onChange={(e) => updateStep(step.id, { timerSeconds: +e.target.value })} />
                    <span className="text-xs text-gray-400">s</span>
                  </div>
                  <button className="text-gray-400 hover:text-red-500 transition-colors p-1 mt-1.5" onClick={() => removeStep(step.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {form.steps.length === 0 && (
                <p className="text-xs text-gray-400 py-2">No steps yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary flex-1"
            onClick={handleSave}
            disabled={!form.name.trim()}
          >
            {initial ? 'Save Changes' : 'Create Recipe'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── RecipeCard ──────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onEdit, onDelete, onPrepMode }: {
  recipe: Recipe
  onEdit: () => void
  onDelete: () => void
  onPrepMode: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const totalTime = recipe.prepMinutes + recipe.cookMinutes

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none">{recipe.emoji}</span>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{recipe.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{recipe.description}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button className="btn-ghost btn-icon text-gray-400 hover:text-brand-600" onClick={onEdit}><Pencil size={14} /></button>
            <button className="btn-ghost btn-icon text-gray-400 hover:text-red-500" onClick={onDelete}><Trash2 size={14} /></button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} /> {totalTime}m
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Users size={12} /> {recipe.servings} srv
          </span>
          <span className="text-xs font-bold text-gray-700 ml-auto">
            {recipe.macrosPerServing.calories} kcal
          </span>
        </div>

        {/* Macro pills */}
        <div className="flex gap-1.5 mt-2">
          <span className="badge-green">{recipe.macrosPerServing.protein}g P</span>
          <span className="badge-purple">{recipe.macrosPerServing.carbs}g C</span>
          <span className="badge-gold">{recipe.macrosPerServing.fat}g F</span>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.tags.slice(0, 3).map((t) => (
              <span key={t} className={TAG_COLORS[t]}>{t}</span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="badge-gray">+{recipe.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Expand / collapse */}
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
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients</p>
                <ul className="space-y-1">
                  {recipe.ingredients.map((ing) => (
                    <li key={ing.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{ing.name}</span>
                      <span className="text-gray-400 font-mono text-xs">{ing.amount} {ing.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recipe.steps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Steps</p>
                <ol className="space-y-1.5">
                  {recipe.steps.map((step, i) => (
                    <li key={step.id} className="flex gap-2 text-sm">
                      <span className="w-4 h-4 shrink-0 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-gray-700 flex-1">{step.instruction}</span>
                      {step.timerSeconds > 0 && (
                        <span className="badge-gold shrink-0">{Math.round(step.timerSeconds / 60)}m</span>
                      )}
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
  const { recipes, addRecipe, updateRecipe, deleteRecipe } = useRecipeStore()
  const { unlockAchievement, addXp } = useUserStore()
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<RecipeTag | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [navigateToPrepId, setNavigateToPrepId] = useState<string | null>(null)

  const filtered = recipes.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
    const matchTag = !tagFilter || r.tags.includes(tagFilter)
    return matchSearch && matchTag
  })

  function handleSave(recipe: Recipe) {
    if (editing) {
      updateRecipe(recipe.id, recipe)
    } else {
      addRecipe(recipe)
      const isFirst = recipes.length === 0
      if (isFirst) { unlockAchievement('first_recipe'); addXp(50) }
      if (recipes.length + 1 >= 5) { unlockAchievement('five_recipes'); addXp(100) }
    }
    setFormOpen(false)
    setEditing(null)
  }

  if (navigateToPrepId) {
    // Redirect to prep page — use navigate in a real router context
    window.location.hash = `/prep?recipe=${navigateToPrepId}`
    setNavigateToPrepId(null)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Recipes</h1>
          <button className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> New Recipe
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search recipes…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ALL_TAGS.slice(0, 6).map((tag) => (
              <button
                key={tag}
                className={`tag transition-all ${tagFilter === tag ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-400' : 'hover:bg-gray-200'}`}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <p className="text-sm text-gray-400">
          {filtered.length} of {recipes.length} recipes
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onEdit={() => { setEditing(recipe); setFormOpen(true) }}
              onDelete={() => deleteRecipe(recipe.id)}
              onPrepMode={() => setNavigateToPrepId(recipe.id)}
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
        <RecipeForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
