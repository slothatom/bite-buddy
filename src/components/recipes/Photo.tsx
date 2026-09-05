import { useEffect, useState } from 'react'
import { photoUrl } from '../../lib/photos'

/**
 * A recipe's photograph, once one has been signed for.
 *
 * The bucket is private, so there is no address to put in a `src` until the
 * app has asked for one. That makes every photo a small async job, and it makes
 * "no photo" and "not signed yet" two different states that must not look the
 * same: the first shows nothing at all, the second holds the space so the card
 * does not jump when the picture lands.
 *
 * Nothing is rendered when signing fails. A household that has not run
 * photos.sql, a phone that is offline and has not seen this one before, an
 * expired session: all of them end here, and a broken image icon in a recipe
 * card would be worse than a card with no picture in it.
 */
export default function Photo({
  path, className = '', alt,
}: {
  path: string | undefined
  className?: string
  /** What the picture is of. Never the word "photo": that is the element. */
  alt: string
}) {
  /*
   * One piece of state carrying which path it is the answer to.
   *
   * Two separate pieces, cleared at the top of the effect, is the obvious
   * shape and the wrong one: clearing them is a synchronous set inside an
   * effect, which sets React rendering twice for every card on the shelf. Held
   * together with the path they belong to, nothing has to be cleared, because
   * a stale answer is one whose path no longer matches.
   */
  const [answer, setAnswer] = useState<{ path: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!path) return
    let live = true
    photoUrl(path)
      .then((url) => { if (live) setAnswer({ path, url }) })
      .catch(() => { if (live) setAnswer({ path, url: null }) })
    // Cancelled on the way out, so a slow signature for a card you have
    // scrolled past does not arrive and set state on something unmounted.
    return () => { live = false }
  }, [path])

  if (!path) return null

  const settled = answer?.path === path ? answer : null
  // Signed and refused. Nothing at all, rather than a hole where a picture is
  // going to appear and never will.
  if (settled && !settled.url) return null

  return (
    <div className={`overflow-hidden bg-cream-50 ${className}`}>
      {settled?.url && (
        <img
          src={settled.url}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
          // A URL that signs and then will not load is the same outcome as one
          // that would not sign, so it ends in the same place.
          onError={() => setAnswer({ path, url: null })}
        />
      )}
    </div>
  )
}
