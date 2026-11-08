import { Heart, X, ChevronDown } from 'lucide-react'
import type { DishCategory, QuickFilter } from '../../types'
import { CATEGORY_LABELS, quickFilterLabel } from '../../lib/dishCategories'
import { lensReady, lensBlocker, LENSES, LENS_ORDER, type Lens, type LensInput } from '../../lib/discovery'
import { ChipCheck } from '../ui'

/**
 * Every way of narrowing the library, in one row.
 *
 * What you picked comes first, as chips you can take off. Then the questions
 * you can ask (the lenses, one at a time), favourites, the kind of dish, and
 * the rest of the filters behind "More filters". It wraps rather than
 * scrolling sideways, so nothing is out of sight with nothing saying so.
 */
export function FilterChips({
  favesOnly, category, filters, lens, lensInput, filtered,
  onToggleFaves, onSheet, onRemoveFilter, onLens, onClear,
}: {
  favesOnly: boolean
  category: DishCategory | null
  filters: QuickFilter[]
  lens: Lens | null
  lensInput: LensInput
  /** Anything at all is narrowing the list, so "Clear filters" has something to do. */
  filtered: boolean
  onToggleFaves: () => void
  onSheet: (sheet: 'category' | 'filters') => void
  onRemoveFilter: (filter: QuickFilter) => void
  onLens: (lens: Lens | null) => void
  onClear: () => void
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {/* On, so they carry the check like every other chip that is on; the
            cross says what a tap does, and the name says it to a screen reader. */}
        {filters.map((f) => (
          <button
            key={f}
            className="chip-on"
            onClick={() => onRemoveFilter(f)}
            aria-label={`Remove filter ${quickFilterLabel(f)}`}
          >
            <ChipCheck on />
            {quickFilterLabel(f)} <X size={13} aria-hidden="true" />
          </button>
        ))}

        <button className={category ? 'chip-on' : 'chip-off'} onClick={() => onSheet('category')}>
          <ChipCheck on={Boolean(category)} />
          {category ? CATEGORY_LABELS[category] : 'Any dish'} <ChevronDown size={13} aria-hidden="true" />
        </button>

        {/* One question at a time, and the rule printed underneath the one
            that is on. A filter nobody can explain is one nobody trusts. */}
        {LENS_ORDER.map((l) => {
          const ready = lensReady(l, lensInput)
          const on = lens === l
          return (
            <button
              key={l}
              onClick={() => onLens(on ? null : l)}
              aria-pressed={on}
              title={ready ? LENSES[l].rule : lensBlocker(l).why}
              className={on ? 'chip-on' : ready ? 'chip-off' : 'chip-off text-ink-500'}
            >
              <ChipCheck on={on} />
              {LENSES[l].emoji} {LENSES[l].label}
            </button>
          )
        })}

        <button
          onClick={onToggleFaves}
          aria-pressed={favesOnly}
          className={favesOnly ? 'chip-on' : 'chip-off'}
        >
          <ChipCheck on={favesOnly} />
          <Heart size={13} aria-hidden="true" className={favesOnly ? 'fill-current' : ''} /> Favourites
        </button>

        <button
          className="chip bg-transparent text-ink-700 border-2 border-dashed border-ink-300 hover:border-bite-300"
          onClick={() => onSheet('filters')}
        >
          More filters
        </button>

        {filtered && (
          <button
            className="chip bg-transparent text-bite-700 hover:underline md:ml-auto"
            onClick={onClear}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
