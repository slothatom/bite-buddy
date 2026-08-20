import { describe, it, expect, beforeEach } from 'vitest'
import { useBodyStore } from './useBodyStore'
import type { BodyMeasurement, WeightEntry } from '../types'

const weight = (id: string, memberId: string | undefined, w: number): WeightEntry =>
  ({ id, date: `2026-08-${id.padStart(2, '0')}`, weight: w, unit: 'kg', memberId })

const measured = (id: string, memberId: string | undefined, waist: number): BodyMeasurement =>
  ({ id, date: `2026-08-${id.padStart(2, '0')}`, measurements: { waist }, unit: 'cm', memberId })

/** The rule the screen relies on, kept here rather than reimplemented there. */
const forMember = (memberId: string | undefined) =>
  useBodyStore.getState().weightEntries.filter((e) => e.memberId === memberId)

describe('two bodies, one app', () => {
  beforeEach(() => useBodyStore.setState({ weightEntries: [], measurements: [] }))

  it('keeps each person\'s weights apart', () => {
    // Averaging two people into one trend line is a graph of nothing.
    const { addWeightEntry } = useBodyStore.getState()
    addWeightEntry(weight('01', 'arany', 68))
    addWeightEntry(weight('02', 'oli', 59))
    addWeightEntry(weight('03', 'arany', 67.4))

    expect(forMember('arany').map((e) => e.weight)).toEqual([68, 67.4])
    expect(forMember('oli').map((e) => e.weight)).toEqual([59])
  })

  it('keeps measurements apart the same way', () => {
    const { addMeasurement } = useBodyStore.getState()
    addMeasurement(measured('01', 'arany', 80))
    addMeasurement(measured('02', 'oli', 71))

    const mine = useBodyStore.getState().measurements.filter((m) => m.memberId === 'arany')
    expect(mine).toHaveLength(1)
    expect(mine[0].measurements.waist).toBe(80)
  })

  it('records only the measurements actually taken', () => {
    // A blank is "not measured today", not a zero that reads as a change.
    useBodyStore.getState().addMeasurement({
      id: '1', date: '2026-08-20', unit: 'cm', memberId: 'arany',
      measurements: { waist: 80, thighs: 55 },
    })

    const m = useBodyStore.getState().measurements[0].measurements
    expect(m.waist).toBe(80)
    expect(m.thighs).toBe(55)
    expect(m).not.toHaveProperty('hips')
    expect(m.chest).toBeUndefined()
  })

  it('leaves entries from before there were people unassigned', () => {
    // Folding them into whoever is looking would hand one person the other's
    // history, silently.
    const { addWeightEntry } = useBodyStore.getState()
    addWeightEntry(weight('01', undefined, 70))

    expect(forMember('arany')).toHaveLength(0)
    expect(forMember(undefined)).toHaveLength(1)
  })

  it('treats an id that is nobody as unclaimed, so it can be given back', () => {
    // Entries used to be stamped with the signed-in account's id, which named
    // a session rather than a person and differed per device. Those ids mean
    // nothing now; hiding the entries behind them would lose the history.
    const { addWeightEntry, claimUnassigned } = useBodyStore.getState()
    addWeightEntry(weight('01', 'a3f0c9de-0000-4000-8000-000000000000', 70))

    expect(forMember('arany')).toHaveLength(0)
    claimUnassigned('arany')
    expect(forMember('arany')).toHaveLength(1)
  })

  it('claims the unassigned ones when told to, and only those', () => {
    const { addWeightEntry, addMeasurement, claimUnassigned } = useBodyStore.getState()
    addWeightEntry(weight('01', undefined, 70))
    addWeightEntry(weight('02', 'oli', 59))
    addMeasurement(measured('03', undefined, 80))

    claimUnassigned('arany')

    expect(forMember('arany')).toHaveLength(1)
    expect(forMember('oli')).toHaveLength(1)
    expect(forMember(undefined)).toHaveLength(0)
    expect(useBodyStore.getState().measurements[0].memberId).toBe('arany')
  })

  it('deletes one person\'s entry without touching the other\'s', () => {
    const { addWeightEntry, removeWeightEntry } = useBodyStore.getState()
    addWeightEntry(weight('01', 'arany', 68))
    addWeightEntry(weight('02', 'oli', 59))

    removeWeightEntry('01')

    expect(forMember('arany')).toHaveLength(0)
    expect(forMember('oli')).toHaveLength(1)
  })

  it('works with no accounts at all, where everything is unassigned', () => {
    // A local clone, or the app before anyone signs in.
    const { addWeightEntry } = useBodyStore.getState()
    addWeightEntry(weight('01', undefined, 70))
    addWeightEntry(weight('02', undefined, 69.5))

    expect(forMember(undefined).map((e) => e.weight)).toEqual([70, 69.5])
  })
})
