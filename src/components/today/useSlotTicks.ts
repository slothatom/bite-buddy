import { useMealPlanStore } from '../../store/useMealPlanStore'
import { offerUndo } from '../../store/useUndo'
import { SLOT_LABELS } from '../../types'
import type { SlotRow } from './todayModel'

/**
 * Ticking a whole slot from Today, line by line.
 *
 * Per line rather than per meal on purpose. Marking the meal would overwrite a
 * coffee you had already said you left, and the planner has kept those answers
 * apart since it learned to: only the lines nobody has spoken about are ticked,
 * and undoing it clears only the ticks. Each is offered back on the undo bar,
 * the same as every other edit to a day.
 */
export function useSlotTicks(date: string) {
  const setEntryOutcome = useMealPlanStore((s) => s.setEntryOutcome)

  const markEaten = (row: SlotRow) => {
    const lines = row.undecided
    for (const l of lines) setEntryOutcome(date, l.mealId, l.index, 'eaten')
    offerUndo(`${SLOT_LABELS[row.slot]} marked eaten`, () => {
      for (const l of lines) setEntryOutcome(date, l.mealId, l.index, undefined)
    })
  }

  const unmark = (row: SlotRow) => {
    const lines = row.eaten
    for (const l of lines) setEntryOutcome(date, l.mealId, l.index, undefined)
    offerUndo(`${SLOT_LABELS[row.slot]} no longer marked eaten`, () => {
      for (const l of lines) setEntryOutcome(date, l.mealId, l.index, 'eaten')
    })
  }

  return { markEaten, unmark }
}
