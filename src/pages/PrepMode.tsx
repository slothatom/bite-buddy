import { useEffect, useMemo, useState } from 'react'
import { Play, Pause, RotateCcw, Check, ChevronLeft } from 'lucide-react'
import type { Recipe } from '../types'
import { useRecipes } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { EmptyState } from '../components/ui'

/**
 * Step-by-step cooking, with a timer on the steps that need one.
 *
 * Only recipes that actually carry a method are offered: the meals imported
 * from the plans have components but no steps, so walking through them would
 * be an empty screen.
 */
export default function PrepMode() {
  const recipes = useRecipes()
  const [active, setActive] = useState<Recipe | null>(null)

  const cookable = useMemo(
    () => recipes.filter((r) => r.steps.length > 0).sort((a, b) => a.name.en.localeCompare(b.name.en)),
    [recipes],
  )

  if (active) return <PrepSession recipe={active} onExit={() => setActive(null)} />

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="text-2xl font-display font-semibold text-stone-700">Let’s cook</h1>
          <p className="text-sm text-stone-500">One step at a time, timers included.</p>
        </header>

        {cookable.length === 0 ? (
          <EmptyState title="No recipes with a method yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {cookable.map((r) => (
              <button key={r.id} onClick={() => setActive(r)}
                className="card p-4 text-left hover:border-brand-300 transition-colors flex items-center gap-3">
                <span className="text-2xl">{r.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-stone-800 text-sm">{r.name.en}</span>
                  <span className="block text-xs text-stone-400">
                    {r.steps.length} steps · {r.prepMinutes + r.cookMinutes} min
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
  const { addXp, unlockAchievement } = useUserStore()
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)

  const step = recipe.steps[index]
  const isLast = index === recipe.steps.length - 1

  function finish() {
    setDone(true)
    unlockAchievement('prep_master')
    addXp(100, 'Prep complete')
  }

  if (done) {
    return (
      <div className="flex-1 grid place-items-center px-6 pb-24">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-display font-semibold text-stone-700">{recipe.name.en} is done</h2>
          <p className="text-sm text-stone-500 mt-1 mb-6">Makes {recipe.servings} servings.</p>
          <button className="btn-primary w-full" onClick={onExit}>Cook something else</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <button className="btn-ghost -ml-2" onClick={onExit}><ChevronLeft size={16} /> All recipes</button>

        <header>
          <h1 className="text-xl font-extrabold text-stone-800">{recipe.emoji} {recipe.name.en}</h1>
          <p className="text-sm text-stone-500">Step {index + 1} of {recipe.steps.length}</p>
          <div className="h-1.5 rounded-full bg-sand-200 overflow-hidden mt-2">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${((index + 1) / recipe.steps.length) * 100}%` }} />
          </div>
        </header>

        <div className="card p-6">
          <p className="text-lg text-stone-800 leading-relaxed">{step.instruction}</p>
          {step.timerSeconds > 0 && <StepTimer key={step.id} seconds={step.timerSeconds} />}
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Back
          </button>
          <button className="btn-primary flex-1" onClick={() => (isLast ? finish() : setIndex(index + 1))}>
            {isLast ? <><Check size={16} /> Finish</> : 'Next step'}
          </button>
        </div>

        <details className="card p-4">
          <summary className="text-sm font-semibold text-stone-700 cursor-pointer">Ingredients</summary>
          <ul className="mt-3 space-y-1">
            {recipe.components.map((c, i) => (
              <li key={i} className="flex justify-between text-sm text-stone-600">
                <span>
                  {c.kind === 'food'
                    ? ctx.foods.get(c.foodId)?.names.en ?? c.foodId
                    : ctx.recipes.get(c.recipeId)?.name.en ?? c.recipeId}
                </span>
                <span className="font-mono text-stone-400">
                  {c.kind === 'food' ? `${Math.round(c.grams)} g` : `${c.servings}×`}
                </span>
              </li>
            ))}
          </ul>
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
    <div className="mt-5 pt-5 border-t border-sand-200 flex items-center gap-4">
      <span className={`text-3xl font-extrabold font-mono ${finished ? 'text-brand-700' : 'text-stone-800'}`}>
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
      {finished && <span className="text-sm font-semibold text-brand-700">Time's up</span>}
    </div>
  )
}
