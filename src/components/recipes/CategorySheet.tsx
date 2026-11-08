import type { DishCategory } from '../../types'
import { CATEGORY_LABELS } from '../../lib/dishCategories'
import { PickerSheet } from './PickerSheet'

/** What kind of dish: only the categories on this shelf, with their counts. */
export function CategorySheet({
  category, categoryCounts, onPick, onClose,
}: {
  category: DishCategory | null
  categoryCounts: (readonly [DishCategory, number])[]
  onPick: (category: DishCategory | null) => void
  onClose: () => void
}) {
  return (
    <PickerSheet title="What kind of dish?" onClose={onClose}>
      <button
        className={`w-full text-left px-4 py-3 rounded-xl ${category ? 'hover:bg-cream-50' : 'bg-cream-50 font-semibold'}`}
        onClick={() => { onPick(null); onClose() }}
      >
        Any dish
      </button>
      {categoryCounts.map(([c, n]) => (
        <button
          key={c}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${category === c ? 'bg-cream-50 font-semibold' : 'hover:bg-cream-50'}`}
          onClick={() => { onPick(category === c ? null : c); onClose() }}
        >
          <span className="flex-1 min-w-0 text-left text-ink-900">{CATEGORY_LABELS[c]}</span>
          <span className="text-xs font-mono text-ink-500">{n}</span>
        </button>
      ))}
      {!categoryCounts.length && (
        <p className="px-4 py-6 text-sm text-ink-500 text-center">Nothing on this shelf yet.</p>
      )}
    </PickerSheet>
  )
}
