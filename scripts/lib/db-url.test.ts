import { describe, it, expect } from 'vitest'
import { parseDbUrl } from './db-url'

const HOST = 'aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
const USER = 'postgres.ksexpattemicrlltnavg'

describe('the database secret, as people actually paste it', () => {
  it('passes a clean string through', () => {
    const r = parseDbUrl(`postgresql://${USER}:abc123@${HOST}`)
    expect(r.problems).toEqual([])
    expect(r.url).toBe(`postgresql://${USER}:abc123@${HOST}`)
  })

  it('encodes a password with @ # / ? % in it', () => {
    const r = parseDbUrl(`postgresql://${USER}:p@ss#w/rd?%x@${HOST}`)
    expect(r.problems).toEqual([])
    expect(new URL(r.url!).password).toBe(encodeURIComponent('p@ss#w/rd?%x'))
    expect(decodeURIComponent(new URL(r.url!).password)).toBe('p@ss#w/rd?%x')
  })

  it('does not encode an already encoded password twice', () => {
    const r = parseDbUrl(`postgresql://${USER}:p%40ss@${HOST}`)
    expect(r.url).toBe(`postgresql://${USER}:p%40ss@${HOST}`)
  })

  it('forgives whitespace, quotes and leftover brackets', () => {
    const r = parseDbUrl(`  "postgresql://${USER}:[abc123]@${HOST}"\n`)
    expect(r.problems).toEqual([])
    expect(r.url).toBe(`postgresql://${USER}:abc123@${HOST}`)
  })

  it('names the mistakes it cannot fix, without echoing the value', () => {
    const secret = 'hunter2'
    const cases = [
      `postgresql://${USER}:[YOUR-PASSWORD]@${HOST}`,
      'https://ksexpattemicrlltnavg.supabase.co',
      `postgresql://${USER}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
      `postgresql://${USER}:${secret} @${HOST}`,
    ]
    for (const c of cases) {
      const r = parseDbUrl(c)
      expect(r.url).toBeUndefined()
      expect(r.problems.length).toBeGreaterThan(0)
      expect(r.problems.join(' ')).not.toContain(secret)
    }
  })
})
