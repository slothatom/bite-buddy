import { supabase } from '../supabase'

/**
 * Asking the database, directly, whether saving works.
 *
 * Every failure in this area has looked the same from the outside: things you
 * typed are not there any more. Underneath they were four different problems, a
 * policy that refused every write, an account that was never added to the
 * household, a constraint that made deletions impossible, and a merge that
 * handed the device's data back to an older copy. Telling them apart took a
 * database and a fair amount of guessing.
 *
 * This does what that guessing was for: writes a row, reads it back, deletes
 * it, and says which of those three worked. It touches nothing real, the id is
 * its own, and it leaves the row deleted.
 */

export interface ProbeStep {
  what: string
  ok: boolean
  detail?: string
}

const PROBE_ID = 'saving-probe'

export async function probeSaving(): Promise<ProbeStep[]> {
  const db = supabase
  if (!db) {
    return [{ what: 'Sharing is not set up', ok: false, detail: 'This copy runs on its own device only.' }]
  }

  const steps: ProbeStep[] = []
  const stamp = new Date().toISOString()

  const { data: me } = await db.auth.getUser()
  const uid = me.user?.id
  steps.push({
    what: 'Signed in',
    ok: Boolean(uid),
    detail: uid ? me.user?.email ?? undefined : 'No session, so every request goes out as nobody.',
  })
  if (!uid) return steps

  // Membership is what every policy in the database consults. Without it an
  // account is signed in and allowed to touch nothing, which is the state that
  // looked exactly like an app that had stopped saving.
  const { data: member, error: memberError } = await db
    .from('members').select('id').eq('id', uid).maybeSingle()
  steps.push({
    what: 'In the household',
    ok: Boolean(member),
    detail: memberError?.message
      ?? (member ? undefined : 'This account is not on the members list, so nothing can be read or written.'),
  })

  const { error: writeError } = await db.from('settings').upsert(
    { id: PROBE_ID, data: { probe: stamp }, updated_by: uid },
    { onConflict: 'id' },
  )
  steps.push({ what: 'Wrote a row', ok: !writeError, detail: writeError?.message })

  const { data: back, error: readError } = await db
    .from('settings').select('data').eq('id', PROBE_ID).maybeSingle()
  const returned = (back?.data as { probe?: string } | undefined)?.probe
  steps.push({
    what: 'Read it back',
    ok: returned === stamp,
    detail: readError?.message
      ?? (returned === undefined ? 'The row was not there afterwards.' : undefined),
  })

  // Deleting is its own question: a tombstone carries only an id and a time, and
  // a column marked not null further up refuses that write even though the row
  // already exists.
  const { error: deleteError } = await db.from('settings').upsert(
    { id: PROBE_ID, deleted_at: new Date().toISOString(), updated_by: uid },
    { onConflict: 'id' },
  )
  steps.push({ what: 'Deleted it again', ok: !deleteError, detail: deleteError?.message })

  return steps
}
