import { useState } from 'react'
import { Combine } from 'lucide-react'
import type { RecipeVariants } from '../../lib/recipeGroups'

/**
 * The offer to tidy up the repeats that are only repeats.
 *
 * Only appears for groups whose versions come to the same numbers, a dish
 * written at 259 kcal and 408 kcal is a real choice about portions and is never
 * swept up here. It disappears once there is nothing left to fold, which is the
 * point: this is a chore, not a feature you are meant to keep visiting.
 */
export function TidyBanner({ groups, onTidy }: { groups: RecipeVariants[]; onTidy: () => void }) {
  const [done, setDone] = useState(false)
  const extra = groups.reduce((n, g) => n + g.variants.length - 1, 0)

  if (done) return null

  return (
    // Deliberately not `.card`: a card on this screen means a recipe, and this
    // is a notice about them.
    <div className="rounded-2xl border border-bite-200 bg-bite-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <Combine size={20} className="text-bite-700 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-900">
          {groups.length} {groups.length === 1 ? 'dish is' : 'dishes are'} written down more than once
        </p>
        <p className="text-xs text-ink-700 mt-0.5">
          Same ingredients, same numbers, just worded differently from one week to the next.
          Folding them together removes {extra} {extra === 1 ? 'copy' : 'copies'}. Days you have
          already planned keep working, and each one can be undone.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button className="btn-primary" onClick={onTidy}>Merge them</button>
        <button className="btn-ghost text-ink-500" onClick={() => setDone(true)}>Not now</button>
      </div>
    </div>
  )
}
