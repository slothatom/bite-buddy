import { describe, expect, it } from 'vitest'
import { REDIRECTS, SECTIONS, SECTION_TABS, isCurrent, isSettings, redirectFor } from './nav'

describe('navigation', () => {
  it('has four places on the bar, in order', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(['Today', 'Plan', 'Recipes', 'Progress'])
  })

  it('sends every old address to where it lives now', () => {
    expect(redirectFor('/plan')).toBe('/plan/week')
    expect(redirectFor('/grocery')).toBe('/plan/grocery')
    expect(redirectFor('/schedule')).toBe('/plan/cooking')
    expect(redirectFor('/foods')).toBe('/recipes/foods')
    expect(redirectFor('/movement')).toBe('/progress/movement')
    expect(redirectFor('/analytics')).toBe('/progress')
    expect(redirectFor('/analytics/summary')).toBe('/progress/summary')
    expect(redirectFor('/history')).toBe('/settings/history')
    expect(redirectFor('/schedule/')).toBe('/plan/cooking')
  })

  it('leaves current addresses alone', () => {
    for (const { tabs } of Object.values(SECTION_TABS)) {
      for (const tab of tabs) expect(redirectFor(tab.to)).toBeNull()
    }
    expect(redirectFor('/')).toBeNull()
    expect(redirectFor('/settings')).toBeNull()
  })

  it('never redirects onto another redirect', () => {
    for (const to of Object.values(REDIRECTS)) expect(redirectFor(to)).toBeNull()
  })

  it('knows which section a path is in', () => {
    expect(isCurrent('/', '/')).toBe(true)
    expect(isCurrent('/', '/plan/week')).toBe(false)
    expect(isCurrent('/plan', '/plan/grocery')).toBe(true)
    expect(isCurrent('/recipes', '/recipes/foods')).toBe(true)
    expect(isCurrent('/plan', '/planner')).toBe(false)
    expect(isSettings('/settings/history')).toBe(true)
    expect(isSettings('/progress')).toBe(false)
  })
})
