import { useMemo, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import type { Component, MealSlot } from '../../types'
import { SLOT_LABELS } from '../../types'
import { useRecipes, useRecipeStore } from '../../store/useRecipeStore'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { useUserStore } from '../../store/useUserStore'
import { useNutritionContext } from '../../store/useNutrition'
import { usePantry } from '../../store/usePantryStore'
import { useAvailablePortions } from '../../store/usePortionStore'
import { proposePlan, type Proposal } from '../../lib/autoPlan'
import { EmptyState } from '../ui'

/**
 * The planning assistant, offering rather than doing.
 *
 * Every proposal arrives with a reason you can check against the plan in front
 * of you, every one can be dropped, and nothing is written until you say so.
 * That is the whole shape of it: the app is allowed to do the tedious part,
 * deciding what goes in your week is not tedious and is not its job.
 *
 * The suggestions come from arithmetic over your own library rather than from a
 * model, which is why they work with no signal and why nothing here can offer a
 * dish you do not have or a number it made up.
 */
export default function FillGaps({
  dates, onClose, onApply,
}: {
  dates: string[]
  onClose: () => void
  onApply: (proposals: Proposal[]) => void
}) {
  const ctx = useNutritionContext()
  const recipes = useRecipes()
  const favouriteIds = useRecipeStore((s) => s.favouriteIds)
  const plan = useMealPlanStore((s) => s.plan)
  const { profile } = useUserStore()
  const pantry = usePantry()
  const portions = useAvailablePortions()

  const proposals = useMemo(
    () => proposePlan({
      dates, plan, recipes, ctx, targets: profile.targets, favouriteIds, pantry, portions,
    }),
    [dates, plan, recipes, ctx, profile.targets, favouriteIds, pantry, portions],
  )

  const [dropped, setDropped] = useState<string[]>([])
  const key = (p: Proposal) => `${p.date}-${p.slot}`
  const kept = proposals.filter((p) => !dropped.includes(key(p)))

  const byDate = useMemo(() => {
    const map = new Map<string, Proposal[]>()
    for (const p of kept) map.set(p.date, [...(map.get(p.date) ?? []), p])
    return [...map]
  }, [kept])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div
        className="bg-paper w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5 border-b border-border-200">
          <div className="flex-1 min-w-0">
            <h3 className="display text-lg text-ink-900">A week, if you like it</h3>
            <p className="text-sm text-ink-700">
              From your own recipes, what is in the fridge, and what the cupboard covers.
              Drop anything you do not fancy.
            </p>
          </div>
          <button className="btn-ghost btn-icon shrink-0" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!proposals.length && (
            <EmptyState title="Nothing to fill" mood="thinking">
              Every meal on these days already has something in it.
            </EmptyState>
          )}

          {byDate.map(([date, list]) => (
            <section key={date}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">
                {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </p>
              <div className="card divide-y divide-border-100">
                {list.map((p) => (
                  <ProposalRow
                    key={key(p)}
                    proposal={p}
                    label={labelFor(p.entry, ctx)}
                    onDrop={() => setDropped((d) => [...d, key(p)])}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="p-5 border-t border-border-200 flex gap-2">
          <button className="btn-primary flex-1" disabled={!kept.length} onClick={() => onApply(kept)}>
            <Sparkles size={15} />
            {kept.length === 1 ? 'Add this meal' : `Add these ${kept.length} meals`}
          </button>
          <button className="btn-secondary" onClick={onClose}>Not now</button>
        </div>
      </div>
    </div>
  )
}

function ProposalRow({
  proposal, label, onDrop,
}: {
  proposal: Proposal
  label: string
  onDrop: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-500">
        {SLOT_LABELS[proposal.slot]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-900 truncate">{label}</p>
        <p className="text-xs text-ink-500 truncate">{proposal.why}</p>
      </div>
      <span className="text-xs font-mono text-ink-700 shrink-0 tabular-nums">
        {Math.round(proposal.calories)}
      </span>
      <button
        className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-coral-600"
        onClick={onDrop}
        aria-label={`Not ${label}`}
      >
        <X size={15} />
      </button>
    </div>
  )
}

function labelFor(entry: Component, ctx: ReturnType<typeof useNutritionContext>): string {
  if (entry.kind === 'recipe') return ctx.recipes.get(entry.recipeId)?.name.en ?? 'A recipe'
  if (entry.kind === 'portion') {
    const portion = ctx.portions?.get(entry.portionId)
    const recipe = portion?.recipeId ? ctx.recipes.get(portion.recipeId) : undefined
    return recipe?.name.en ?? portion?.label ?? 'From the fridge'
  }
  return ctx.foods.get(entry.foodId)?.names.en ?? 'A food'
}

export type { MealSlot }
