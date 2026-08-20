import { useEffect, useMemo, useState } from 'react'
import { Play, Pause, RotateCcw, Check, ChevronLeft, Plus } from 'lucide-react'
import type { Recipe } from '../types'
import { useRecipes, useRecipeStore } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { EmptyState } from '../components/ui'
import { flattenComponents } from '../lib/ingredients'
import { EMPTY_CONTEXT } from '../lib/moments'
import Zig from '../components/brand/Mascot'

/**
 * Cooking, one thing at a time.
 *
 * This screen used to offer only recipes carrying a written method — and since
 * the dietician wrote portions rather than instructions, not one of the 275 has
 * any, so it was permanently empty.
 *
 * What every recipe does have is components, and the part of cooking those
 * describe is real work: getting the right weight of the right things out
 * before you start. So a session is the weigh-out first, then whatever method
 * has been written, and you can write that method yourself as you go.
 */
export default function PrepMode() {
  const recipes = useRecipes()
  const [active, setActive] = useState<Recipe | null>(null)

  const cookable = useMemo(
    () => recipes.filter((r) => r.components.length > 0).sort((a, b) => a.name.en.localeCompare(b.name.en)),
    [recipes],
  )

  if (active) return <PrepSession recipe={active} onExit={() => setActive(null)} />

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="display text-xl sm:text-2xl text-ink-900">Let’s cook</h1>
          <p className="text-sm text-ink-700">One step at a time, timers included.</p>
        </header>

        {cookable.length === 0 ? (
          <EmptyState title="Nothing to cook yet">
            Add a recipe and it will show up here.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {cookable.map((r) => (
              <button key={r.id} onClick={() => setActive(r)}
                className="card p-4 text-left hover:border-bite-300 transition-colors flex items-center gap-3">
                <span className="text-2xl">{r.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-ink-900 text-sm">{r.name.en}</span>
                  <span className="block text-xs text-ink-500">
                    {r.components.length} {r.components.length === 1 ? 'ingredient' : 'ingredients'}
                    {r.steps.length > 0 && ` · ${r.steps.length} steps`}
                    {r.prepMinutes + r.cookMinutes > 0 && ` · ${r.prepMinutes + r.cookMinutes} min`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PrepSession({ recipe, onExit }: { recipe: Recipe; onExit: () => void }) {
  const ctx = useNutritionContext()
  const { notice } = useUserStore()
  const { updateRecipe } = useRecipeStore()

  // Stage 0 is the weigh-out; the written steps follow it. Keeping them in one
  // index means one progress bar and one Back button for the whole session.
  const [index, setIndex] = useState(0)
  const [weighed, setWeighed] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)
  const [newStep, setNewStep] = useState('')

  const ingredients = useMemo(
    () => flattenComponents(recipe.components, ctx),
    [recipe, ctx],
  )

  const total = recipe.steps.length + 1
  const onWeighOut = index === 0
  const step = onWeighOut ? null : recipe.steps[index - 1]
  const isLast = index === total - 1

  function finish() {
    setDone(true)
    notice({ ...EMPTY_CONTEXT, cookedSomething: true })
  }

  /** Writing the method as you cook it — it is kept on the recipe for next time. */
  function addStep() {
    const instruction = newStep.trim()
    if (!instruction) return
    updateRecipe(recipe.id, {
      steps: [...recipe.steps, { id: `${Date.now()}`, instruction, timerSeconds: 0 }],
    })
    setNewStep('')
  }

  if (done) {
    return (
      <div className="flex-1 grid place-items-center px-6 pb-24">
        <div className="text-center max-w-sm">
          <Zig mood="celebrate" size={84} />
          <h2 className="display text-lg text-ink-900 mt-3">{recipe.name.en} is done</h2>
          <p className="text-sm text-ink-700 mt-1 mb-6">Makes {recipe.servings} servings.</p>
          <button className="btn-primary w-full justify-center" onClick={onExit}>Cook something else</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <button className="btn-ghost -ml-2" onClick={onExit}><ChevronLeft size={16} /> All recipes</button>

        <header>
          <h1 className="text-xl font-extrabold text-ink-900">{recipe.emoji} {recipe.name.en}</h1>
          <p className="text-sm text-ink-700">
            {onWeighOut ? 'Weigh everything out' : `Step ${index} of ${recipe.steps.length}`}
          </p>
          <div className="h-1.5 rounded-full bg-border-100 overflow-hidden mt-2">
            <div className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
        </header>

        {onWeighOut ? (
          <div className="card divide-y divide-border-100">
            {ingredients.map((ing) => {
              const checked = weighed.has(ing.foodId)
              return (
                <label key={ing.foodId} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox" className="w-5 h-5 accent-bite-500 shrink-0"
                    checked={checked}
                    onChange={() => setWeighed((prev) => {
                      const next = new Set(prev)
                      if (checked) next.delete(ing.foodId); else next.add(ing.foodId)
                      return next
                    })}
                  />
                  <span className={`flex-1 min-w-0 text-sm ${checked ? 'line-through text-ink-500' : 'text-ink-900'}`}>
                    {ing.food.names.en}
                    {ing.food.state !== 'as-sold' && (
                      <span className="ml-2 text-xs text-ink-500">weighed {ing.food.state}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-bold text-ink-900 tabular-nums">
                    {Math.round(ing.grams)} g
                  </span>
                </label>
              )
            })}
            {!ingredients.length && (
              <p className="px-4 py-3 text-sm text-ink-500">This recipe has no ingredients listed.</p>
            )}
          </div>
        ) : (
          <div className="card p-6">
            <p className="text-lg text-ink-900 leading-relaxed">{step?.instruction}</p>
            {step && step.timerSeconds > 0 && <StepTimer key={step.id} seconds={step.timerSeconds} />}
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Back
          </button>
          <button className="btn-primary flex-1" onClick={() => (isLast ? finish() : setIndex(index + 1))}>
            {isLast ? <><Check size={16} /> Finish</> : onWeighOut && recipe.steps.length ? 'Start cooking' : 'Next'}
          </button>
        </div>

        {/* The dietician wrote portions, not method. This is where the method
            gets written — once, by whoever cooks it first. */}
        <details className="card p-4" open={!recipe.steps.length}>
          <summary className="text-sm font-semibold text-ink-900 cursor-pointer">
            {recipe.steps.length ? 'Add another step' : 'No method written yet — add one'}
          </summary>
          <div className="flex gap-2 mt-3">
            <input
              className="input" placeholder="e.g. Soften the onion in oil for 5 minutes"
              value={newStep} onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addStep() }}
            />
            <button className="btn-secondary shrink-0" disabled={!newStep.trim()} onClick={addStep}>
              <Plus size={15} /> Add
            </button>
          </div>
          <p className="text-xs text-ink-500 mt-2">
            Saved on the recipe, so it's there the next time either of you cooks it.
          </p>
        </details>
      </div>
    </div>
  )
}

function StepTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running || remaining <= 0) return
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [running, remaining])

  const finished = remaining === 0
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div className="mt-5 pt-5 border-t border-border-200 flex items-center gap-4">
      <span className={`text-3xl font-extrabold font-mono ${finished ? 'text-bite-700' : 'text-ink-900'}`}>
        {mm}:{ss}
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary btn-icon" onClick={() => setRunning((r) => !r)}
          disabled={finished} aria-label={running ? 'Pause' : 'Start'}>
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="btn-ghost btn-icon" onClick={() => { setRemaining(seconds); setRunning(false) }}
          aria-label="Reset timer">
          <RotateCcw size={16} />
        </button>
      </div>
      {finished && <span className="text-sm font-semibold text-bite-700">Time's up</span>}
    </div>
  )
}
