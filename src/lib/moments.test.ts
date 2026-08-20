import { describe, it, expect, beforeEach } from 'vitest'
import { noticeMoments, MOMENTS, EMPTY_CONTEXT, type MomentKind } from './moments'
import { useUserStore } from '../store/useUserStore'

/**
 * These guard the property that makes this not a points system: a moment is
 * noticed once and then never again, and nothing about it can be lost. If
 * either of those slips, this quietly turns back into the thing it replaced.
 */

describe('noticeMoments', () => {
  it('notices nothing at all on a blank slate', () => {
    expect(noticeMoments(EMPTY_CONTEXT)).toEqual([])
  })

  it('notices a first planned day', () => {
    expect(noticeMoments({ ...EMPTY_CONTEXT, plannedDays: 1 })).toContain('first-day')
  })

  it('waits for enough of a week before commenting on vegetables', () => {
    // One good day is not a pattern, and saying so would be flattery.
    expect(noticeMoments({ ...EMPTY_CONTEXT, plannedDays: 1, vegGoalMet: true }))
      .not.toContain('plenty-of-veg')
    expect(noticeMoments({ ...EMPTY_CONTEXT, plannedDays: 3, vegGoalMet: true }))
      .toContain('plenty-of-veg')
  })

  it('has a definition for every kind it can return', () => {
    const everything = noticeMoments({
      plannedDays: 7,
      weekFullyPlanned: true,
      loadedFromArchive: true,
      cookedSomething: true,
      ownRecipes: 1,
      ownFoods: 1,
      vegGoalMet: true,
      fibreGoalMet: true,
    })
    expect(everything).toHaveLength(Object.keys(MOMENTS).length)
    for (const kind of everything) expect(MOMENTS[kind]).toBeDefined()
  })

  it('is finite, there is no ninth thing to chase', () => {
    expect(Object.keys(MOMENTS)).toHaveLength(8)
  })
})

describe('the store side', () => {
  beforeEach(() => {
    useUserStore.setState((s) => ({ profile: { ...s.profile, moments: [] } }))
  })

  it('records a moment once, however many times it stays true', () => {
    const { notice } = useUserStore.getState()
    notice({ ...EMPTY_CONTEXT, plannedDays: 1 })
    notice({ ...EMPTY_CONTEXT, plannedDays: 2 })
    notice({ ...EMPTY_CONTEXT, plannedDays: 3 })

    expect(useUserStore.getState().profile.moments.filter((m) => m.kind === 'first-day')).toHaveLength(1)
  })

  it('hands them over oldest first', () => {
    const { notice, markMomentSeen, unseenMoment } = useUserStore.getState()
    notice({ ...EMPTY_CONTEXT, plannedDays: 1 })
    notice({ ...EMPTY_CONTEXT, cookedSomething: true })

    expect(unseenMoment()?.kind).toBe('first-day')
    markMomentSeen('first-day')
    expect(useUserStore.getState().unseenMoment()?.kind).toBe('cooked')
  })

  it('keeps a moment after it has been seen', () => {
    // Nothing here is spent or lost, that is the whole difference from points.
    const { notice, markMomentSeen } = useUserStore.getState()
    notice({ ...EMPTY_CONTEXT, plannedDays: 1 })
    markMomentSeen('first-day')

    const moments = useUserStore.getState().profile.moments
    expect(moments).toHaveLength(1)
    expect(moments[0].seen).toBe(true)
    expect(useUserStore.getState().unseenMoment()).toBeNull()
  })

  it('stops having anything to say once they have all happened', () => {
    const { notice } = useUserStore.getState()
    const everything = {
      plannedDays: 7, weekFullyPlanned: true, loadedFromArchive: true, cookedSomething: true,
      ownRecipes: 1, ownFoods: 1, vegGoalMet: true, fibreGoalMet: true,
    }
    notice(everything)
    for (const m of useUserStore.getState().profile.moments) {
      useUserStore.getState().markMomentSeen(m.kind as MomentKind)
    }

    notice(everything)
    // An app that keeps congratulating you is managing you.
    expect(useUserStore.getState().unseenMoment()).toBeNull()
  })
})
