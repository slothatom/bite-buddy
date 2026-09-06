import { useLocation } from 'react-router-dom'
import { Undo2, X } from 'lucide-react'
import { useUndo, UNDO_SECONDS } from '../../store/useUndo'

/**
 * The offer to take it back, in the bottom corner of the screen.
 *
 * It used to sit clear of the phone's bottom nav, which was 3.5rem plus the
 * safe area: a bar covering that turned "I did not mean that" into "I cannot
 * leave this screen". The nav is at the top now, so this sits where a
 * transient message belongs, a thumb's reach from the bottom edge.
 *
 * The countdown is drawn rather than counted out in numbers. A digit ticking
 * down reads as pressure; a bar quietly emptying reads as a window closing,
 * which is what it is. It is decoration on top of the text either way, and the
 * text says what happened on its own.
 */
export default function UndoBar() {
  const offer = useUndo((s) => s.offer)
  const takeUndo = useUndo((s) => s.takeUndo)
  const clearUndo = useUndo((s) => s.clearUndo)
  const { pathname } = useLocation()

  // Only on the screen it belongs to. Compared in render rather than cleared
  // from an effect, so navigating away and straight back inside the window
  // still finds the offer standing.
  if (!offer || offer.at !== pathname) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-40 px-4 pointer-events-none
                 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] md:bottom-6 md:inset-x-auto md:right-6"
    >
      {/* An inverted slab, which is what a transient message should be: it has
          to read as not-the-page. `text-white` was wrong on a token that
          inverts, though. In daylight ink-900 is nearly black and white sits on
          it fine; after dark ink-900 is nearly white and so is white, which is
          how this shipped at 1.11:1. Paired with cream-50 the two invert
          together and the slab is dark-on-light or light-on-dark in either
          theme, without either of them knowing a theme exists. */}
      <div className="pointer-events-auto mx-auto md:mx-0 max-w-md md:max-w-sm overflow-hidden
                      rounded-xl bg-ink-900 text-cream-50 border border-ink-700 shadow-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <p className="flex-1 min-w-0 text-sm">{offer.what}</p>
          <button
            onClick={takeUndo}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-paper text-ink-900
                       font-semibold px-3 py-2 text-xs hover:bg-cream-50"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            onClick={() => clearUndo()}
            aria-label="Dismiss"
            // Inherits the slab's colour rather than naming one. A colour named
            // here has no ground in its own literal, so nothing can tell what
            // it sits on, and it is the same colour as the text beside it in
            // any case.
            className="shrink-0 p-1 -m-1 opacity-70 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
        <div
          // Keyed on the offer so a second deletion restarts the bar rather
          // than inheriting the tail end of the first one's.
          key={offer.id}
          aria-hidden="true"
          className="h-0.5 bg-bite-400"
          style={{ animation: `drain ${UNDO_SECONDS}s linear forwards` }}
        />
      </div>
    </div>
  )
}
