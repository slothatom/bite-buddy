/**
 * Saving a generated file, wherever the app happens to be running.
 *
 * Normally an anchor with `download` is all this takes. Inside an embedded
 * viewer it isn't: the frame is sandboxed and a download it starts itself is
 * silently inert — the click appears to work and no file arrives. Hosts that
 * sandbox the page expose a bridge instead, which asks the viewer to confirm.
 *
 * So: use the bridge when there is one, fall back to the anchor when there
 * isn't, and report which of the three things actually happened rather than
 * returning a boolean that conflates "declined" with "broken".
 */

export type SaveOutcome = 'saved' | 'declined' | 'failed'

/** The host bridge, if this page is running inside one. */
interface HostDownloads {
  save(request: { filename: string; data: string }): Promise<{ status: 'saved' }>
}

interface HostBridge {
  use?(name: 'downloads'): Promise<HostDownloads | null>
}

function bridge(): HostBridge | undefined {
  return (globalThis as { claude?: HostBridge }).claude
}

function errorCode(e: unknown): string {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
}

export async function saveTextFile(
  filename: string,
  text: string,
  type = 'application/json',
): Promise<SaveOutcome> {
  const host = bridge()

  if (host?.use) {
    try {
      const downloads = await host.use('downloads')
      if (downloads) {
        await downloads.save({ filename, data: text })
        return 'saved'
      }
    } catch (e) {
      // The viewer saying no is a normal outcome, not a failure to report as
      // one — and it must never be retried through the fallback path.
      if (errorCode(e) === 'declined') return 'declined'
      return 'failed'
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'saved'
  } catch {
    return 'failed'
  }
}
