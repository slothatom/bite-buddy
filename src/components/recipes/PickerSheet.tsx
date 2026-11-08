import type { ReactNode } from 'react'
import { useDialog } from '../../lib/useDialog'
import { X } from 'lucide-react'

/**
 * A list you pick from, on a sheet.
 *
 * On a phone this comes up from the bottom where a thumb is; on a desktop it is
 * a centred dialog. Same component, because the content is a list either way and
 * two implementations would drift.
 */
export function PickerSheet({
  title, children, onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const panel = useDialog<HTMLDivElement>(onClose)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border-200">
          <h2 className="text-base font-extrabold text-ink-900">{title}</h2>
          <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">{children}</div>
      </div>
    </div>
  )
}
