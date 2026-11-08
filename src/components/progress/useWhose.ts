import { useResolvedPerson } from '../../store/useHousehold'
import { useUiStore } from '../../store/useUiStore'

/**
 * The person the Progress screens are about: the device's "viewing as", the
 * same choice Today reads its movement from and Settings sets.
 */
export function useWhose(): string {
  return useResolvedPerson(useUiStore((s) => s.viewingAs))
}
