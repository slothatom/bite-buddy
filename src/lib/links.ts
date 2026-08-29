/**
 * Letting a recipe point at where it came from, without letting it point
 * anywhere else.
 *
 * A recipe is data: typed in on this device, restored from a backup file, or
 * arrived from the other phone. Rendering a link from data means rendering
 * whatever that data says, and `javascript:` in an href is a script that runs
 * on your own page with your own session. It has never been a hypothetical.
 *
 * So a link is only ever http or https, it is checked at the moment it is shown
 * rather than only when it is saved, and anything else is treated as not a link
 * at all rather than quietly repaired into one.
 */

export function safeUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  try {
    // Without a scheme it is a hostname somebody typed, which is the common
    // case for a person and never a way to smuggle anything in.
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

/**
 * What to call it on screen: the site, not the whole address.
 *
 * "bbcgoodfood.com" is the useful half of a 120-character link with a tracking
 * tail on it, and it fits on a phone.
 */
export function linkLabel(url: URL): string {
  return url.hostname.replace(/^www\./, '')
}
