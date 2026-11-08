import { Undo2 } from 'lucide-react'
import { useDeletedRecipes, useRecipeStore } from '../../store/useRecipeStore'
import { useDeletedFoods, useFoodStore } from '../../store/useFoodStore'
import { SectionHeading } from '../ui'

export function DeletedRecipesPanel() {
  const deleted = useDeletedRecipes()
  const restoreRecipe = useRecipeStore((s) => s.restoreRecipe)
  if (!deleted.length) return null

  return (
    <section>
      <SectionHeading>Deleted recipes</SectionHeading>
      <div className="card divide-y divide-border-100">
        {deleted.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl shrink-0">{r.emoji}</span>
            <span className="flex-1 min-w-0 text-sm text-ink-900 truncate">{r.name.en}</span>
            <button className="btn-secondary shrink-0" onClick={() => restoreRecipe(r.id)}>
              <Undo2 size={15} /> Restore
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-500 mt-2 px-1">
        These are out of your library but not gone: any day you already planned with one still
        shows it, marked as deleted, so your history stays as it happened.
      </p>
    </section>
  )
}

/** Foods you deleted, and the way back. Same reasoning as the recipes above. */
export function DeletedFoodsPanel() {
  const deleted = useDeletedFoods()
  const restoreFood = useFoodStore((s) => s.restoreFood)
  if (!deleted.length) return null

  return (
    <section>
      <SectionHeading>Deleted foods</SectionHeading>
      <div className="card divide-y divide-border-100">
        {deleted.map((f) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 min-w-0 text-sm text-ink-900 truncate">{f.names.en}</span>
            <button className="btn-secondary shrink-0" onClick={() => restoreFood(f.id)}>
              <Undo2 size={15} /> Restore
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-500 mt-2 px-1">
        Recipes and planned days that already use one of these keep their numbers. A food is
        named by everything that contains it, so losing it would blank them all at once.
      </p>
    </section>
  )
}
