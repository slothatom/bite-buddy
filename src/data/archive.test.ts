import { afterAll, describe, expect, it } from 'vitest'
import * as data from './index'
import { DISHES } from './dishes'
import { ArchiveError, archiveCounts, parseArchive, parseArchiveText, type PlanArchive } from './archiveFormat'
import { testArchive } from '../test/archive'

const archive = testArchive()

afterAll(() => data.setArchive(archive))

describe('the archive in place', () => {
  it('is read through live bindings, so a new one reaches every importer', () => {
    data.setArchive(archive)
    expect(data.SOURCE_PLANS).toBe(archive.sourcePlans)
    expect(data.MEAL_RECIPES).toBe(archive.mealRecipes)
    expect(data.ALL_RECIPES).toHaveLength(DISHES.length + archive.mealRecipes.length)

    data.clearArchive()
    expect(data.SOURCE_PLANS).toEqual([])
    expect(data.MEAL_RECIPES).toEqual([])
    expect(data.RECIPE_ALIASES).toEqual({})
    expect(data.TIMES_PLANNED).toEqual({})
    expect(data.currentArchive()).toBeNull()
  })

  it('without one, the library is the hand-written dishes and nothing of hers', () => {
    data.clearArchive()
    expect(data.ALL_RECIPES.map((r) => r.id)).toEqual(DISHES.map((d) => d.id))
    expect(data.ALL_RECIPES.some((r) => r.sourceLine || r.sourcePlanId)).toBe(false)
  })

  it('puts the category and the times planned on each recipe, dishes included', () => {
    data.setArchive(archive)
    const dish = data.ALL_RECIPES.find((r) => r.id === DISHES[0].id)!
    expect(dish.category).toBe(archive.classification[dish.id].category)
    const often = Object.entries(archive.timesPlanned)[0]
    expect(data.ALL_RECIPES.find((r) => r.id === often[0])?.timesPlanned).toBe(often[1])
  })
})

describe('reading an archive file', () => {
  it('accepts what data:build writes, and counts it', () => {
    const round = parseArchiveText(JSON.stringify(archive))
    expect(round).toEqual(archive)
    const counts = archiveCounts(round)
    expect(counts.plans).toBe(archive.sourcePlans.length)
    expect(counts.days).toBe(archive.sourcePlans.reduce((n, p) => n + p.days.length, 0))
    expect(counts.recipes).toBe(archive.mealRecipes.length)
  })

  it('refuses something that is not JSON, in words', () => {
    expect(() => parseArchiveText('not json')).toThrow(/not valid JSON/)
  })

  it('refuses a backup or any other JSON, saying what is missing', () => {
    const backup = { app: 'bite-buddy', schema: 4, stores: {} }
    expect(() => parseArchive(backup)).toThrow(ArchiveError)
    try {
      parseArchive(backup)
    } catch (e) {
      const message = (e as Error).message
      expect(message).toMatch(/^This is not a plan archive\./)
      expect(message).toMatch(/version/)
      expect(message).toMatch(/sourcePlans/)
    }
  })

  it('refuses a newer format rather than half reading it', () => {
    expect(() => parseArchive({ ...archive, version: 2 })).toThrow(/version 2/)
  })

  it('names the plan or recipe that is broken', () => {
    const broken = structuredClone(archive) as PlanArchive
    ;(broken.sourcePlans[1] as unknown as Record<string, unknown>).days = 'seven'
    ;(broken.mealRecipes[0] as unknown as Record<string, unknown>).components = undefined
    expect(() => parseArchive(broken)).toThrow(/Plan 2 has no list of days.*Recipe 1 has no components/)
  })
})
