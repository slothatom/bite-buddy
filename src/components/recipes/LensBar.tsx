import { Link } from 'react-router-dom'
import { lensReady, lensBlocker, LENSES, type Lens, type LensInput } from '../../lib/discovery'

/**
 * The rule behind the lens that is on, printed under the chips, or what it
 * would need when the app cannot answer it yet. The chips themselves live in
 * FilterChips, with every other way of narrowing the list.
 */
export function LensRule({ lens, lensInput }: { lens: Lens | null; lensInput: LensInput }) {
  if (!lens) return null
  if (lensReady(lens, lensInput)) return <p className="text-xs text-ink-700">{LENSES[lens].rule}</p>

  const blocker = lensBlocker(lens)
  return (
    <p className="text-xs text-ink-700">
      {blocker.why}{' '}
      {blocker.to && (
        <Link to={blocker.to} className="text-bite-700 font-semibold underline">
          {blocker.label}
        </Link>
      )}
    </p>
  )
}
