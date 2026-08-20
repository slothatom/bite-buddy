/**
 * Copying text out of the app.
 *
 * The clipboard API is blocked in a few places that matter here: an insecure
 * origin, an iframe without permission, and Safari when the copy did not come
 * straight from a tap. The textarea fallback is ugly and deprecated, and it
 * still works in all three, so it stays until it does not.
 *
 * Returns whether the text actually made it, because the button says "Copied"
 * and that should be true.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }
}
