import { useEffect, useRef } from 'react'

/**
 * The three things every dialog in this app should do and none of them did.
 *
 * Escape closes it. Tab stays inside it. Closing it puts focus back on the
 * thing that opened it.
 *
 * Clicking the backdrop already worked everywhere, which hid the gap: on a
 * phone that is the only way most people would ever close one, so nothing
 * looked broken. On a laptop, and for anybody driving this from the keyboard,
 * a dialog you cannot Escape out of and cannot Tab out of is a dialog you are
 * stuck in, and Tab was walking off the end into the page underneath while the
 * dialog stayed open on top of it.
 *
 * Returns a ref to put on the dialog's own panel, which is what the focus trap
 * is a trap for.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const panel = useRef<T>(null)

  useEffect(() => {
    // Whatever had focus when this opened. Captured before anything inside is
    // focused, so it is genuinely the trigger rather than the first field.
    const opener = document.activeElement as HTMLElement | null

    function focusable(): HTMLElement[] {
      if (!panel.current) return []
      return [...panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),'
        + ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null)
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const stops = focusable()
      if (!stops.length) return
      const first = stops[0]
      const last = stops[stops.length - 1]

      // Only the two ends need handling. Everything between them is the
      // browser's own tab order, which is already right.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)

    /*
     * And the page underneath stays where it was.
     *
     * Scrolling with a sheet open moved the page behind it, so closing the
     * sheet left you somewhere you had not chosen to be. The filter sheet
     * happened to avoid this and the others did not, which made it read as a
     * bug in one screen rather than a thing none of them did.
     *
     * The width is given back as padding, because hiding a scrollbar that was
     * taking up space shifts the whole layout sideways as the dialog opens.
     */
    const { overflow, paddingRight } = document.body.style
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`

    // Held in the effect rather than read from the ref on the way out, where
    // React may already have detached it.
    const box = panel.current

    return () => {
      document.removeEventListener('keydown', onKey)
      // Put back exactly what was there, rather than cleared: two dialogs open
      // at once would otherwise have the inner one unlock the page on close.
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      // Only if focus is still somewhere inside the dialog that is going away,
      // or nowhere at all. Stealing it back from wherever the user has since
      // moved to would be worse than not restoring it.
      if (!opener) return
      if (document.activeElement === document.body || box?.contains(document.activeElement)) {
        opener.focus?.()
      }
    }
  }, [onClose])

  return panel
}
