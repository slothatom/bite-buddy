import { Star, X, ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { DishCategory, QuickFilter } from '../../types'
import { CATEGORY_LABELS, quickFilterLabel } from '../../lib/dishCategories'
import { ChipCheck } from '../ui'

/**
 * Two buttons rather than fifty chips, and what you picked as chips you can
 * take off.
 */
export function FilterChips({
  favesOnly, category, filters, onToggleFaves, onSheet, onRemoveFilter,
}: {
  favesOnly: boolean
  category: DishCategory | null
  filters: QuickFilter[]
  onToggleFaves: () => void
  onSheet: (sheet: 'category' | 'filters') => void
  onRemoveFilter: (filter: QuickFilter) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={onToggleFaves}
        className={favesOnly ? 'chip bg-coral-800 text-white border border-coral-800' : 'chip-off'}
      >
        <Star size={12} className={favesOnly ? 'fill-current' : ''} /> Favourites
      </button>

      <button className={category ? 'chip-on' : 'chip-off'} onClick={() => onSheet('category')}>
        <ChipCheck on={Boolean(category)} />
        {category ? CATEGORY_LABELS[category] : 'Any dish'} <ChevronDown size={13} />
      </button>

      <button className={filters.length ? 'chip-on' : 'chip-off'} onClick={() => onSheet('filters')}>
        <ChipCheck on={Boolean(filters.length)} />
        <SlidersHorizontal size={12} />
        {filters.length ? `${filters.length} filter${filters.length === 1 ? '' : 's'}` : 'Filters'}
      </button>

      {filters.map((f) => (
        <button key={f} className="chip-on" onClick={() => onRemoveFilter(f)}>
          {quickFilterLabel(f)} <X size={12} />
        </button>
      ))}
    </div>
  )
}
