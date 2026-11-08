import { useNavigate } from 'react-router-dom'
import { useUiStore } from '../../store/useUiStore'
import { today } from '../../store/useMealPlanStore'

/**
 * Opens the add sheet on today, at the slot for the time of day.
 *
 * Today, always: the button should not depend on where another screen was
 * left, and the planner's window follows the day rather than the reverse. The
 * sheet belongs to the week view, so that is where it opens. Shared by the
 * phone's centre button and the sidebar's "Add food".
 */
export function useQuickAdd(): () => void {
  const navigate = useNavigate()
  const requestQuickAdd = useUiStore((s) => s.requestQuickAdd)

  return () => {
    requestQuickAdd(today())
    navigate('/plan/week')
  }
}
