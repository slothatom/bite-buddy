import type { Dispatch, SetStateAction } from 'react'
import type { QuickFilter } from '../../types'
import { QUICK_FILTERS, QUICK_FILTER_DEFINITIONS } from '../../lib/dishCategories'
import { PickerSheet } from './PickerSheet'

/** The quick filters, each saying how many recipes it would leave. */
export function FiltersSheet({
  filters, filterCounts, onFilters, onClose,
}: {
  filters: QuickFilter[]
  filterCounts: Map<QuickFilter, number>
  onFilters: Dispatch<SetStateAction<QuickFilter[]>>
  onClose: () => void
}) {
  return (
    <PickerSheet title="Filters" onClose={onClose}>
      {/* What the tag on the right means. It was on four rows with no
          explanation anywhere, and "yours to apply" reads as an
          instruction rather than as the fact it is. */}
      <p className="px-4 pb-2 text-xs text-ink-500">
        Each one says how many recipes it would leave. The tagged ones are not
        worked out from the ingredients: they are there because somebody ticked
        them on a recipe.
      </p>
      {QUICK_FILTERS.map((f) => {
        const d = QUICK_FILTER_DEFINITIONS[f]
        const on = filters.includes(f)
        const left = filterCounts.get(f) ?? 0
        return (
          <button
            key={f}
            className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left ${on ? 'bg-bite-50' : 'hover:bg-cream-50'}`}
            onClick={() => onFilters((s) => (on ? s.filter((x) => x !== f) : [...s, f]))}
          >
            <span className="text-lg leading-none mt-0.5">{d.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className={`block text-sm ${on ? 'font-bold text-bite-700' : 'text-ink-900'}`}>{d.label}</span>
              <span className="block text-xs text-ink-500">{d.note}</span>
            </span>
            <span className="shrink-0 mt-0.5 text-right">
              <span className={`block text-xs font-mono ${left ? 'text-ink-700' : 'text-ink-500'}`}>
                {left}
              </span>
              {!d.derived && (
                <span className="block text-xs text-ink-500">you set this</span>
              )}
            </span>
          </button>
        )
      })}
      {filters.length > 0 && (
        <button className="btn-secondary w-full mt-2" onClick={() => onFilters([])}>Clear all</button>
      )}
    </PickerSheet>
  )
}
