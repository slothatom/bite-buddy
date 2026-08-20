import { describe, it, expect } from 'vitest'
import { parseDate, parseDuration, parseGarminCsv, parseGarminJson } from './garminImport'

describe('reading a date out of an export', () => {
  it('takes ISO, European and written dates', () => {
    expect(parseDate('2026-08-20')).toBe('2026-08-20')
    expect(parseDate('20/08/2026')).toBe('2026-08-20')
    expect(parseDate('20.08.2026')).toBe('2026-08-20')
    expect(parseDate('2026-08-20T22:14:00.0')).toBe('2026-08-20')
  })

  it('says nothing rather than inventing a day', () => {
    expect(parseDate('')).toBeUndefined()
    expect(parseDate('not a date')).toBeUndefined()
  })
})

describe('reading a sleep duration', () => {
  it('takes every shape Garmin writes one in', () => {
    expect(parseDuration('7h 32m')).toBeCloseTo(7.533, 2)
    expect(parseDuration('7:32')).toBeCloseTo(7.533, 2)
    expect(parseDuration('7.5')).toBe(7.5)
    expect(parseDuration('452')).toBeCloseTo(7.533, 2)   // minutes
    expect(parseDuration('27120')).toBeCloseTo(7.533, 2) // seconds
  })

  it('refuses what it cannot read', () => {
    expect(parseDuration('')).toBeUndefined()
    expect(parseDuration('plenty')).toBeUndefined()
  })
})

describe('a steps export', () => {
  it('reads the report Connect produces', () => {
    const csv = [
      'Date,Steps,Goal,Distance',
      '2026-08-18,"9,412",8000,6.7',
      '2026-08-19,"11,003",8000,7.9',
    ].join('\n')

    const out = parseGarminCsv(csv, { personId: 'arany', kind: 'steps' })
    expect(out.steps).toHaveLength(2)
    expect(out.steps[0]).toMatchObject({ date: '2026-08-18', steps: 9412, source: 'garmin' })
    expect(out.skipped).toBe(0)
  })

  it('gives every day one stable id, so the same file twice is one month', () => {
    const csv = 'Date,Steps\n2026-08-18,9412'
    const a = parseGarminCsv(csv, { personId: 'arany', kind: 'steps' })
    const b = parseGarminCsv(csv, { personId: 'arany', kind: 'steps' })
    expect(a.steps[0].id).toBe(b.steps[0].id)
  })

  it('counts what it could not read rather than dropping it quietly', () => {
    const csv = 'Date,Steps\n2026-08-18,9412\nnonsense,nonsense'
    expect(parseGarminCsv(csv, { personId: 'arany', kind: 'steps' }).skipped).toBe(1)
  })

  it('returns nothing at all for a file with no columns it knows', () => {
    const csv = 'Something,Else\n1,2'
    expect(parseGarminCsv(csv, { personId: 'arany', kind: 'steps' }).steps).toEqual([])
  })
})

describe('a sleep export', () => {
  it('reads a duration column whatever it is called', () => {
    const csv = 'Date;Duration\n20.08.2026;7:32'
    const out = parseGarminCsv(csv, { personId: 'oli', kind: 'sleep' })
    expect(out.sleep[0]).toMatchObject({ date: '2026-08-20', personId: 'oli' })
    expect(out.sleep[0].hours).toBeCloseTo(7.53, 1)
  })
})

describe('the account export', () => {
  it('reads steps and sleep out of the JSON', () => {
    const json = JSON.stringify([
      { calendarDate: '2026-08-18', totalSteps: 9412 },
      { calendarDate: '2026-08-19', sleepTimeSeconds: 27120 },
    ])
    const out = parseGarminJson(json, 'arany')
    expect(out.steps).toHaveLength(1)
    expect(out.sleep[0].hours).toBeCloseTo(7.53, 1)
  })

  it('shrugs at a file that is not the one you meant', () => {
    expect(parseGarminJson('not json', 'arany')).toEqual({ steps: [], sleep: [], skipped: 0 })
  })
})
