import { supabase } from './supabase'

/**
 * A photograph of a recipe.
 *
 * The recipe stores a path inside the bucket, never a URL. Two reasons, and
 * both are about the URL being the wrong thing to keep: the bucket is private
 * so a usable URL is signed and expires, and a stored URL carries the project
 * it came from, so a household that ever moved projects would hold a library of
 * links to a database they no longer use.
 *
 * Everything here degrades to nothing when there is no account or the bucket
 * has not been created. See supabase/photos.sql, which somebody runs once.
 */

export const BUCKET = 'recipe-photos'

/** Types a browser will reliably re-encode, and that the bucket accepts. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/** The longest edge a stored photo keeps. A card shows it at 400px at most. */
const LONGEST_EDGE = 1400

/** After downscaling. Anything above this is a fault rather than a photo. */
const MOST_BYTES = 5 * 1024 * 1024

export type PhotoResult =
  | { ok: true; path: string }
  | { ok: false; reason: string }

/**
 * Whether adding a photo is possible at all, right now.
 *
 * Asked rather than assumed, because the bucket is a piece of setup somebody
 * does by hand and the app must not offer a control that cannot work. A single
 * listing of nothing is the cheapest question that distinguishes "the bucket is
 * there" from "it is not".
 */
export async function photosAvailable(): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.storage.from(BUCKET).list('', { limit: 1 })
  return !error
}

/**
 * Shrinks a photo before it is uploaded.
 *
 * A modern phone takes a 12 megapixel photograph of a bowl of porridge, and
 * nothing in this app ever shows one larger than about 400px across. Uploading
 * the original would spend somebody's data allowance on pixels no screen here
 * will ever ask for, and the bucket refuses anything over 5 MB anyway, so the
 * alternative to shrinking is not "a bigger photo", it is "an error".
 *
 * Falls back to the original file when the browser cannot do it, which is the
 * right way round: a slightly large upload that works beats a clever one that
 * silently drops the photo.
 */
export async function downscale(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return file

  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    // Already small enough. Re-encoding it would only lose a generation.
    if (longest <= LONGEST_EDGE) {
      bitmap.close()
      return file
    }

    const scale = LONGEST_EDGE / longest
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
  } catch {
    return file
  }
}

/**
 * Stores a photo for a recipe and returns the path to keep.
 *
 * The path carries the recipe id and a random suffix rather than being the
 * recipe id alone. Replacing a photo therefore writes a new object and deletes
 * the old one, instead of overwriting in place: an overwrite leaves every
 * device that has already signed a URL for that path showing the previous
 * picture until its cache gives up.
 */
export async function uploadPhoto(recipeId: string, file: File): Promise<PhotoResult> {
  if (!supabase) return { ok: false, reason: 'This copy runs on its own, with no account.' }
  if (!ACCEPTED.includes(file.type)) {
    return { ok: false, reason: 'That has to be a JPEG, PNG or WebP.' }
  }

  const body = await downscale(file)
  if (body.size > MOST_BYTES) {
    return { ok: false, reason: 'That photo is too large even after shrinking it.' }
  }

  const suffix = body.type === 'image/webp' ? 'webp' : file.name.split('.').pop() || 'jpg'
  const path = `${recipeId}/${crypto.randomUUID()}.${suffix}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: body.type,
    upsert: false,
  })
  if (error) return { ok: false, reason: error.message }
  return { ok: true, path }
}

/** Takes one out of the bucket. Quiet about failure: it is a tidy-up. */
export async function removePhoto(path: string): Promise<void> {
  if (!supabase) return
  await supabase.storage.from(BUCKET).remove([path])
}

// ─── Showing one ──────────────────────────────────────────────────────────────

/**
 * Signed URLs, held for as long as the tab lives.
 *
 * A private bucket has no permanent address, so every photo on screen needs one
 * minted. Without a cache the recipe shelf would sign every visible card on
 * every render, which is a request per card per keystroke in the search box.
 *
 * Held in memory rather than in a store: these expire, and a URL that outlived
 * its signature in a backup or a synced row would be a link that worked on the
 * device that made it and nowhere else.
 */
const signed = new Map<string, { url: string; until: number }>()

/** An hour, less a minute, so one is never handed out as it expires. */
const LIFETIME = 60 * 60
const MARGIN = 60_000

export async function photoUrl(path: string): Promise<string | null> {
  if (!supabase) return null

  const held = signed.get(path)
  if (held && held.until > Date.now() + MARGIN) return held.url

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, LIFETIME)
  if (error || !data?.signedUrl) return null

  signed.set(path, { url: data.signedUrl, until: Date.now() + LIFETIME * 1000 })
  return data.signedUrl
}

/** For tests, and for a sign-out, after which nothing signed is valid. */
export function forgetSignedUrls(): void {
  signed.clear()
}
