import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Play, Pause, RotateCcw, ChevronRight, ChevronLeft, Check, Timer, Zap, Trophy } from 'lucide-react'
import { useRecipeStore } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import type { Recipe, PrepStep } from '../types'

// ── Countdown Timer ──────────────────────────────────────────────────────────

function CountdownTimer({ seconds, onComplete }: { seconds: number; onComplete?: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setRemaining(seconds)
    setRunning(false)
  }, [seconds])

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            onComplete?.()
            return 0
          }
          return r - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, remaining, onComplete])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct = ((seconds - remaining) / seconds) * 100

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Circular progress */}
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={remaining === 0 ? '#22c55e' : '#a855f7'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-2xl text-gray-900">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          {remaining === 0 && <span className="text-xs text-brand-600 font-semibold mt-0.5">Done!</span>}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="btn-secondary btn-icon"
          onClick={() => { setRemaining(seconds); setRunning(false) }}
        >
          <RotateCcw size={16} />
        </button>
        <button
          className={`btn ${remaining === 0 ? 'btn-secondary' : running ? 'btn-danger' : 'btn-xp'} px-6`}
          onClick={() => setRunning((r) => !r)}
          disabled={remaining === 0}
        >
          {running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Start</>}
        </button>
      </div>
    </div>
  )
}

// ── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step, index, total, completed, onComplete }: {
  step: PrepStep
  index: number
  total: number
  completed: boolean
  onComplete: () => void
}) {
  const [timerDone, setTimerDone] = useState(false)

  return (
    <div className={`card p-6 transition-all duration-300 ${completed ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm
          ${completed ? 'bg-brand-100 text-brand-600' : 'bg-xp-100 text-xp-700'}`}>
          {completed ? <Check size={16} /> : index + 1}
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">
            Step {index + 1} of {total}
          </p>
          <p className={`text-base font-medium leading-relaxed ${completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {step.instruction}
          </p>

          {step.timerSeconds > 0 && !completed && (
            <div className="mt-5 p-4 rounded-xl bg-xp-50 border border-xp-100 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3">
                <Timer size={15} className="text-xp-600" />
                <p className="text-sm font-semibold text-xp-700">
                  Timer: {Math.floor(step.timerSeconds / 60)}m {step.timerSeconds % 60 > 0 ? `${step.timerSeconds % 60}s` : ''}
                </p>
              </div>
              <CountdownTimer seconds={step.timerSeconds} onComplete={() => setTimerDone(true)} />
            </div>
          )}

          {!completed && (
            <button
              className="btn-primary mt-4 w-full"
              onClick={onComplete}
            >
              <Check size={15} />
              {step.timerSeconds > 0 && !timerDone ? 'Mark done (skip timer)' : 'Mark complete'}
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Recipe Picker ────────────────────────────────────────────────────────────

function RecipePicker({ recipes, onSelect }: { recipes: Recipe[]; onSelect: (r: Recipe) => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
      <h1 className="page-title">Prep Mode</h1>
      <p className="text-gray-500">Choose a recipe to start a guided prep session.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recipes.map((recipe) => (
          <button
            key={recipe.id}
            className="card p-4 text-left hover:shadow-md transition-shadow hover:border-brand-200 border border-transparent"
            onClick={() => onSelect(recipe)}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{recipe.emoji}</span>
              <div>
                <p className="font-bold text-gray-900">{recipe.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {recipe.steps.length} steps · {recipe.prepMinutes + recipe.cookMinutes}min
                </p>
              </div>
              <ChevronRight size={16} className="ml-auto text-gray-300" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Completion Screen ────────────────────────────────────────────────────────

function CompletionScreen({ recipe, onReset, xpEarned }: { recipe: Recipe; onReset: () => void; xpEarned: number }) {
  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center space-y-6">
      <div className="text-7xl animate-float">{recipe.emoji}</div>
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900">Prep Complete!</h2>
        <p className="text-gray-500 mt-1">You finished prepping <span className="font-semibold text-gray-700">{recipe.name}</span></p>
      </div>
      <div className="card p-4 inline-flex items-center gap-3 glow-purple">
        <Zap size={20} className="text-xp-500" />
        <div className="text-left">
          <p className="font-bold text-gray-900 text-lg">+{xpEarned} XP earned!</p>
          <p className="text-xs text-gray-400">Prep Master progress</p>
        </div>
      </div>
      <div className="flex gap-3 justify-center">
        <button className="btn-secondary" onClick={onReset}>Pick another recipe</button>
        <button className="btn-primary" onClick={() => window.location.hash = '/'}>Back to planner</button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PrepMode() {
  const [searchParams] = useSearchParams()
  const { recipes } = useRecipeStore()
  const { unlockAchievement, addXp } = useUserStore()

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(() => {
    const id = searchParams.get('recipe')
    return id ? recipes.find((r) => r.id === id) ?? null : null
  })
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  function handleSelectRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe)
    setCompletedSteps(new Set())
    setCurrentStep(0)
    setDone(false)
  }

  function handleStepComplete(stepId: string, stepIndex: number) {
    const newCompleted = new Set(completedSteps)
    newCompleted.add(stepId)
    setCompletedSteps(newCompleted)

    if (selectedRecipe && newCompleted.size === selectedRecipe.steps.length) {
      // All steps done
      const earned = 100
      addXp(earned)
      const isNew = unlockAchievement('prep_master')
      setXpEarned(earned + (isNew ? 100 : 0))
      setDone(true)
    } else {
      setCurrentStep(stepIndex + 1)
    }
  }

  function handleReset() {
    setSelectedRecipe(null)
    setCompletedSteps(new Set())
    setCurrentStep(0)
    setDone(false)
    setXpEarned(0)
  }

  if (!selectedRecipe) {
    return (
      <div className="flex-1 overflow-y-auto">
        <RecipePicker recipes={recipes} onSelect={handleSelectRecipe} />
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex-1 overflow-y-auto">
        <CompletionScreen recipe={selectedRecipe} onReset={handleReset} xpEarned={xpEarned} />
      </div>
    )
  }

  const stepsWithTimers = selectedRecipe.steps.filter((s) => s.timerSeconds > 0)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button className="btn-ghost btn-icon" onClick={handleReset}><ChevronLeft size={18} /></button>
          <div className="text-center">
            <h1 className="font-bold text-gray-900 flex items-center gap-2 justify-center">
              <span>{selectedRecipe.emoji}</span>
              {selectedRecipe.name}
            </h1>
            <p className="text-xs text-gray-400">
              {completedSteps.size} / {selectedRecipe.steps.length} steps complete
            </p>
          </div>
          <div className="w-10" />
        </div>

        {/* Overall progress */}
        <div className="xp-bar">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
            style={{ width: `${(completedSteps.size / selectedRecipe.steps.length) * 100}%` }}
          />
        </div>

        {/* Ingredients reminder */}
        {selectedRecipe.ingredients.length > 0 && (
          <details className="card overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 hover:bg-gray-50 list-none flex items-center justify-between">
              <span>📋 Ingredients ({selectedRecipe.ingredients.length})</span>
              <ChevronRight size={14} className="text-gray-400" />
            </summary>
            <div className="px-4 pb-3 pt-1 border-t border-gray-100">
              <ul className="space-y-1">
                {selectedRecipe.ingredients.map((ing) => (
                  <li key={ing.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{ing.name}</span>
                    <span className="text-gray-400 font-mono text-xs">{ing.amount} {ing.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {/* Steps */}
        <div className="space-y-3">
          {selectedRecipe.steps.map((step, idx) => {
            const isCurrent = idx === currentStep
            const isCompleted = completedSteps.has(step.id)
            if (!isCurrent && !isCompleted) return null // only show current + done
            return (
              <StepCard
                key={step.id}
                step={step}
                index={idx}
                total={selectedRecipe.steps.length}
                completed={isCompleted}
                onComplete={() => handleStepComplete(step.id, idx)}
              />
            )
          })}
        </div>

        {/* Upcoming steps preview */}
        {currentStep < selectedRecipe.steps.length && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Up next</p>
            {selectedRecipe.steps.slice(currentStep + 1, currentStep + 3).map((step, i) => (
              <div key={step.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                  {currentStep + i + 2}
                </span>
                <p className="text-sm text-gray-400 line-clamp-1">{step.instruction}</p>
                {step.timerSeconds > 0 && (
                  <span className="badge-gold ml-auto shrink-0">
                    <Timer size={10} /> {Math.round(step.timerSeconds / 60)}m
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
