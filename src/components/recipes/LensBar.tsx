import { Link } from 'react-router-dom'
import {
  lensReady, lensBlocker, LENSES, LENS_ORDER, type Lens, type LensInput,
} from '../../lib/discovery'

/**
 * The questions you can ask the library, one at a time, with the rule printed
 * underneath the one that is on.
 */
export function LensBar({
  lens, lensInput, onLens,
}: {
  lens: Lens | null
  lensInput: LensInput
  onLens: (lens: Lens | null) => void
}) {
  return (
    <>
      {/* One question at a time, and the rule underneath it. A filter
          nobody can explain is a filter nobody trusts. */}
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
        <div className="flex gap-1.5 w-max pb-0.5">
          {LENS_ORDER.map((l) => {
            const ready = lensReady(l, lensInput)
            const on = lens === l
            return (
              <button
                key={l}
                onClick={() => onLens(on ? null : l)}
                aria-pressed={on}
                title={ready ? LENSES[l].rule : lensBlocker(l).why}
                className={`shrink-0 whitespace-nowrap ${
                  on ? 'chip bg-leaf-800 text-white border border-leaf-800'
                    : ready ? 'chip-off' : 'chip-off text-ink-500'
                }`}
              >
                {LENSES[l].emoji} {LENSES[l].label}
              </button>
            )
          })}
        </div>
      </div>

      {lens && (lensReady(lens, lensInput) ? (
        <p className="text-xs text-ink-500">{LENSES[lens].rule}</p>
      ) : (
        <p className="text-xs text-ink-500">
          {lensBlocker(lens).why}{' '}
          {lensBlocker(lens).to && (
            <Link to={lensBlocker(lens).to!} className="text-bite-700 font-semibold underline">
              {lensBlocker(lens).label}
            </Link>
          )}
        </p>
      ))}
    </>
  )
}
