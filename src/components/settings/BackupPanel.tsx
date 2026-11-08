import { useState } from 'react'
import { Upload, Download, ClipboardCopy, ClipboardPaste, Undo2 } from 'lucide-react'
import {
  applyBackup, backupFilename, createBackup, inspectBackup, type Backup,
  type RestorePlan,
} from '../../lib/backup'
import { saveTextFile } from '../../lib/download'
import { copyToClipboard } from '../../lib/clipboard'
import { useAuthStore } from '../../store/useAuth'
import { isConfigured } from '../../lib/supabase'

/**
 * Backup and restore.
 *
 * Deliberately offers three ways out and two ways back in, because the
 * situations where you most need a backup are the ones where the browser is
 * restricting something: a download that never lands, a clipboard that is
 * blocked, a file picker that isn't offered. At least one path works
 * everywhere the app runs.
 */

export function BackupPanel() {
  // Whether there is anywhere else this data lives, which is the difference
  // between the two things this panel can truthfully say.
  const shared = useAuthStore((s) => Boolean(s.session)) && isConfigured
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; message: string } | null>(null)
  const [pasted, setPasted] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  // A backup that has been read and found sound, waiting to be agreed to.
  const [plan, setPlan] = useState<RestorePlan | null>(null)
  // What the last restore replaced, so it can be put back.
  const [undo, setUndo] = useState<Backup | null>(null)

  const backupText = () => JSON.stringify(createBackup(), null, 2)

  async function onDownload() {
    const outcome = await saveTextFile(backupFilename(), backupText())
    setStatus(
      outcome === 'saved' ? { tone: 'ok', message: 'Backup saved.' }
      : outcome === 'declined' ? { tone: 'bad', message: 'Save cancelled.' }
      : { tone: 'bad', message: "This browser wouldn't save the file. Use Copy backup instead and paste it somewhere safe." },
    )
  }

  async function onCopy() {
    const ok = await copyToClipboard(backupText())
    setStatus(ok
      ? { tone: 'ok', message: 'Backup copied. Paste it into a note or a message to yourself.' }
      : { tone: 'bad', message: "This browser blocked the clipboard. Try Download backup instead." })
  }

  /**
   * Reads the file and stops, so the next step is a decision rather than a
   * report of something already done.
   *
   * This used to write straight through and then say "Restored 3 of your 10
   * saved sections", which is the wrong moment for that sentence twice over:
   * nobody agreed to it, and by the time it appears the other seven are gone.
   */
  function onOffered(text: string) {
    const result = inspectBackup(text)
    if (!result.ok) {
      setPlan(null)
      setStatus({ tone: 'bad', message: result.error })
      return
    }
    setStatus(null)
    setPlan(result.plan)
  }

  function onConfirm() {
    if (!plan) return
    const snapshot = applyBackup(plan)
    setPlan(null)
    setPasted('')
    setShowPaste(false)
    setUndo(snapshot)
    setStatus({ tone: 'ok', message: `Restored everything from the backup${savedOn(plan)}.` })
  }

  /**
   * Puts back what the restore replaced.
   *
   * Kept on screen rather than offered for a few seconds like the undo
   * elsewhere in the app. Replacing everything is the largest thing this app
   * can do, and noticing that a week is missing takes longer than noticing a
   * meal is, so the way back stays until it is used or the page is left.
   */
  function onUndo() {
    if (!undo) return
    const back = inspectBackup(JSON.stringify(undo))
    if (!back.ok) {
      setStatus({ tone: 'bad', message: back.error })
      return
    }
    applyBackup(back.plan)
    setUndo(null)
    setStatus({ tone: 'ok', message: 'Put back what was here before the restore.' })
  }

  return (
    <div className="card p-4 space-y-4">
      {/* Two paragraphs, because signing in changes which one is true. Both
          used to be on screen at once, the frightening one first, directly
          above "Signed in as": the app told you there was no account behind it
          and then named the account. */}
      <p className="text-sm text-ink-700">
        {shared
          ? `Everything you plan, log and add is on this device and in the household's shared
             copy, so it reaches the other phone and comes back if this one is lost. A backup
             is still worth having: it is the copy that survives an account going away, and
             the only one you hold yourself.`
          : `Everything you plan, log and add lives in this browser and nowhere else. There's no
             account behind it. A backup is the only copy that survives clearing your browser
             data, switching phone, or a browser that won't let this page save anything at all.`}
      </p>

      <div className="space-y-2">
        <p className="label">Save a copy</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => void onDownload()}>
            <Download size={15} /> Download backup
          </button>
          <button className="btn-secondary" onClick={() => void onCopy()}>
            <ClipboardCopy size={15} /> Copy backup
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="label">Bring one back</p>
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            <Upload size={15} /> Restore from file
            <input
              type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void file.text().then(onOffered)
                e.target.value = ''
              }}
            />
          </label>
          <button className="btn-secondary" onClick={() => setShowPaste((v) => !v)}>
            <ClipboardPaste size={15} /> Paste a backup
          </button>
        </div>

        {showPaste && (
          <div className="space-y-2 pt-1">
            <textarea
              className="input h-28 font-mono text-xs"
              placeholder="Paste the contents of a backup here…"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <button className="btn-primary" disabled={!pasted.trim()} onClick={() => onOffered(pasted)}>
              Read it
            </button>
          </div>
        )}
        {plan && (
          <div className="card-soft p-4 space-y-3 border border-coral-300">
            <p className="text-sm font-semibold text-ink-900">
              This will replace {plan.replacing.length}{' '}
              {plan.replacing.length === 1 ? 'section' : 'sections'} of what is in the app now,
              from a backup{savedOn(plan)}.
            </p>
            {/* Named, not counted. "10 sections" is not something anybody can
                weigh against what they would lose. */}
            <ul className="text-sm text-ink-700 list-disc pl-5 space-y-0.5">
              {plan.replacing.map((what) => <li key={what}>{what}</li>)}
            </ul>
            {plan.unknown.length > 0 && (
              <p className="text-xs text-ink-500">
                {plan.unknown.length === 1 ? 'One section' : `${plan.unknown.length} sections`} in
                that file belong to a version this app does not have, and will be left out.
              </p>
            )}
            <p className="text-xs text-ink-500">
              A copy of what is here now is kept first, so this can be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={onConfirm}>Replace it all</button>
              <button className="btn-secondary" onClick={() => setPlan(null)}>Cancel</button>
            </div>
          </div>
        )}

        <p className="text-xs text-ink-500">
          Restoring replaces what's currently in the app. It says what it is about to replace
          before it does anything, and keeps a copy of what was here.
        </p>
      </div>

      {status && (
        <p className={`text-sm ${status.tone === 'ok' ? 'text-bite-700' : 'text-coral-600'}`}>
          {status.message}
        </p>
      )}

      {undo && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={onUndo}>
            <Undo2 size={15} /> Undo that restore
          </button>
          <button className="btn-ghost text-sm" onClick={() => setUndo(null)}>
            Keep the restored copy
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * When the backup was taken, as a clause that can be left out.
 *
 * A backup with no date in it is a backup somebody hand-edited, and inventing
 * "today" for it would be the app making something up about a file it is about
 * to overwrite everything with.
 */
function savedOn(plan: RestorePlan): string {
  if (!plan.exportedAt) return ''
  const when = new Date(plan.exportedAt)
  if (Number.isNaN(when.getTime())) return ''
  return ` saved on ${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
}
