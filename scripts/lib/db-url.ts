/**
 * Turning what somebody pasted into a GitHub secret into a connection string.
 *
 * The string Supabase shows is `postgresql://user:[YOUR-PASSWORD]@host:5432/db`,
 * and people fill it in by hand. The first real deploy failed with "Invalid
 * URL" and nothing else, because the value is redacted in the log. The usual
 * causes are all recoverable or at least nameable:
 *
 *   - spaces, a trailing newline or quotes around the whole thing
 *   - the square brackets left in around the password
 *   - a password containing `@ # / ? %` and the like, which a URL needs encoded
 *
 * So the password is re-encoded here, and anything that still cannot be read
 * is described by its shape. The value itself is never returned in a message.
 */

export interface DbUrl {
  url?: string
  problems: string[]
  notes: string[]
}

export function parseDbUrl(raw: string): DbUrl {
  const problems: string[] = []
  const notes: string[] = []

  let value = raw.trim()
  if (value !== raw) notes.push('Removed spaces or line breaks around the value.')
  if (/^(['"]).*\1$/s.test(value)) {
    value = value.slice(1, -1).trim()
    notes.push('Removed quotes around the value.')
  }
  if (/\s/.test(value)) problems.push('It contains a space or line break in the middle. Paste it again as one line.')

  const scheme = /^(postgres(?:ql)?):\/\//.exec(value)
  if (!scheme) {
    problems.push(value.startsWith('http')
      ? 'It starts with http. That is the Project URL; this secret needs the postgresql:// connection string.'
      : 'It does not start with postgresql://. Copy the Session pooler string from Connect in Supabase.')
    return { problems, notes }
  }

  // user:password@host:port/db, split on the LAST @ so an @ inside the
  // password does not end it early.
  const rest = value.slice(scheme[0].length)
  const at = rest.lastIndexOf('@')
  if (at < 0) {
    problems.push('There is no @ between the password and the host.')
    return { problems, notes }
  }
  const credentials = rest.slice(0, at)
  const location = rest.slice(at + 1)
  const colon = credentials.indexOf(':')
  if (colon < 0) {
    problems.push('There is no password. It should look like postgres.<ref>:<password>@...')
    return { problems, notes }
  }
  const user = credentials.slice(0, colon)
  let password = credentials.slice(colon + 1)

  if (password === '[YOUR-PASSWORD]' || password === 'YOUR-PASSWORD') {
    problems.push('The password placeholder [YOUR-PASSWORD] is still there. Replace it with the real password.')
    return { problems, notes }
  }
  if (password.startsWith('[') && password.endsWith(']')) {
    password = password.slice(1, -1)
    notes.push('Removed the square brackets around the password.')
  }
  if (!password) {
    problems.push('The password is empty.')
    return { problems, notes }
  }

  // Encode exactly once: decode first in case it was already encoded.
  let plain = password
  try { plain = decodeURIComponent(password) } catch { /* a bare % is a literal */ }
  if (encodeURIComponent(plain) !== password) notes.push('Encoded special characters in the password.')

  if (/:6543\//.test(location)) {
    problems.push('It uses port 6543, the transaction pooler. Use the Session pooler string (port 5432).')
  }
  if (!/^[^/]+(:\d+)?\/[^/?#]+/.test(location)) {
    problems.push('The part after the @ should be host:port/database, like aws-0-eu-central-1.pooler.supabase.com:5432/postgres.')
  }
  if (problems.length) return { problems, notes }

  const url = `${scheme[1]}://${encodeURIComponent(user)}:${encodeURIComponent(plain)}@${location}`
  try {
    new URL(url)
  } catch {
    problems.push('It still cannot be read as an address after fixing the password. Copy it from Supabase again.')
    return { problems, notes }
  }
  return { url, problems, notes }
}
