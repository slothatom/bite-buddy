import { useState } from 'react'
import { useDialog } from '../../lib/useDialog'
import { offerUndo } from '../../store/useUndo'
import { BookmarkPlus, Check, Trash2, X } from 'lucide-react'
import type { WeekTemplate } from '../../types'
import { useMealPlanStore } from '../../store/useMealPlanStore'

/**
 * Weeks worth having again.
 *
 * A household eats in patterns. The same shop, the same batch on Sunday, the
 * same four dinners in a different order. Rebuilding that by hand every seventh
 * day is the tax that quietly stops people planning at all, and it is the one
 * piece of work the app already had every part of and never offered.
 *
 * Applying replaces the week rather than merging into it, which is the honest
 * behaviour but also the destructive one, so the count of what is already
 * there is shown before anything happens and again on the button itself.
 * Nothing is written until that second tap.
 */
export default function WeekTemplates({
  weekDates, onClose,
}: {
  weekDates: string[]
  onClose: () => void
}) {
  const {
    plan, templates, saveTemplate, applyTemplate, removeTemplate, restoreTemplate,
  } = useMealPlanStore()
  const [name, setName] = useState('')
  const panel = useDialog<HTMLDivElement>(onClose)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const shown = new Set(weekDates)
  const onScreen = plan
    .filter((d) => shown.has(d.date))
    .reduce((n, d) => n + d.meals.length, 0)

  /**
   * What to call it, if you do not.
   *
   * Saving with the field blank produced "Saved week", and saving twice
   * produced two of them with no way to tell which was which. The week it came
   * from is the one fact about it that is always true and always different.
   */
  const suggested = `Week of ${new Date(weekDates[0] + 'T12:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

  function save() {
    const template = saveTemplate(name.trim() || suggested)
    if (!template) return
    setName('')
    setSaved(template.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        aria-modal="true"
        className="bg-paper rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Saved weeks"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-ink-900">Saved weeks</h3>
            <p className="text-sm text-ink-700">A week you eat often, ready to drop on another one.</p>
          </div>
          <button className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-coral-600" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Saving. Offered first, because you get here from a week you have
            just finished planning far more often than from an empty one. */}
        <div className="mb-5">
          {onScreen === 0 ? (
            <p className="text-sm text-ink-500 rounded-xl bg-cream-50 px-3 py-2.5">
              Nothing on this week to save yet.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder={suggested}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save() }}
                aria-label="Name this week"
              />
              <button className="btn-primary shrink-0" onClick={save}>
                <BookmarkPlus size={15} /> Save
              </button>
            </div>
          )}
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-ink-500">
            Nothing saved yet. Plan a week you like, then keep it.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {templates.map((template) => (
              <Row
                key={template.id}
                template={template}
                justSaved={saved === template.id}
                onScreen={onScreen}
                confirming={confirming === template.id}
                onAsk={() => setConfirming(template.id)}
                onCancel={() => setConfirming(null)}
                onApply={() => { applyTemplate(template.id); onClose() }}
                onRemove={() => {
                  // The guard used to be on the recoverable action and missing
                  // from the permanent one: applying a week asked first, the
                  // bin next to it did not.
                  removeTemplate(template.id)
                  offerUndo(`Forgot ${template.name}`, () => restoreTemplate(template))
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({
  template, justSaved, onScreen, confirming, onAsk, onCancel, onApply, onRemove,
}: {
  template: WeekTemplate
  justSaved: boolean
  onScreen: number
  confirming: boolean
  onAsk: () => void
  onCancel: () => void
  onApply: () => void
  onRemove: () => void
}) {
  const meals = template.days.reduce((n, d) => n + d.meals.length, 0)
  const days = template.days.length

  return (
    <li className="rounded-xl bg-cream-50 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-900 truncate">{template.name}</p>
          <p className="text-xs text-ink-500">
            {meals} meal{meals === 1 ? '' : 's'} across {days} day{days === 1 ? '' : 's'}
            {justSaved ? ' · just saved' : ''}
          </p>
        </div>

        {confirming ? null : (
          <>
            <button className="btn-secondary shrink-0" onClick={onAsk}>Use it</button>
            <button
              className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-coral-600"
              onClick={onRemove}
              aria-label={`Forget ${template.name}`}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>

      {/* The second tap. What it costs is on the button rather than above it,
          so the number is where the thumb already is. */}
      {confirming && (
        <div className="mt-2.5 pt-2.5 border-t border-border-200">
          <p className="text-xs text-ink-700 mb-2">
            {onScreen > 0
              ? `This replaces the whole week, including ${onScreen} meal${onScreen === 1 ? '' : 's'} already on it.`
              : 'This writes the saved week onto the week on screen.'}
          </p>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={onApply}>
              <Check size={15} />
              {onScreen > 0
                ? `Replace ${onScreen} ${onScreen === 1 ? 'meal' : 'meals'}`
                : 'Write the week'}
            </button>
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  )
}
