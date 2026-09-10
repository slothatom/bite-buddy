import { Photo } from 'bite-buddy'

/**
 * A recipe card asking for a photograph that will not sign.
 *
 * The bucket is private, so a picture exists only once a signed URL comes back,
 * and here none does: no account on this copy, no signature, no image. The
 * component renders nothing at all rather than a broken image or a grey
 * rectangle, so the card closes up around the title instead of holding a hole.
 *
 * This is the only state it has outside a signed-in household, so it is the
 * only one that can be photographed. See .design-sync/learnings/D.md.
 */
export function NoPictureToSign() {
  return (
    <div style={{ width: 320 }} className="card overflow-hidden">
      <Photo path="dish-ciorba-vegetable/8f2c.webp" alt="Vegetable sour soup" className="w-full aspect-video" />
      <div className="p-4">
        <p className="text-sm font-semibold text-ink-900">🍲 Vegetable sour soup</p>
        <p className="text-xs text-ink-500">ciorbă de legume · 2 servings · 186 kcal</p>
      </div>
    </div>
  )
}

/**
 * The recipe shelf, where the absence has to be tidy rather than merely safe.
 *
 * Two of these three name a photo and one has never had one, which are
 * different states inside the component and the same thing from outside: no
 * element. Worth looking at because it is the case that decides the rule.
 * A placeholder tile per card would have the shelf mostly grey, and 261 shipped
 * recipes have no photograph.
 */
export function AShelfWithoutPictures() {
  const shelf = [
    { emoji: '🍲', en: 'Vegetable sour soup', sub: 'ciorbă de legume · 186 kcal', path: 'dish-ciorba-vegetable/8f2c.webp' },
    { emoji: '🥣', en: 'Rolled oats with yogurt', sub: 'zabpehely joghurttal · 412 kcal', path: undefined },
    { emoji: '🥗', en: 'Telemea and tomato salad', sub: 'salată cu telemea · 214 kcal', path: 'meal-salad-telemea/1a90.webp' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 240px)', gap: 16 }}>
      {shelf.map((r) => (
        <div key={r.en} className="card overflow-hidden">
          <Photo path={r.path as string} alt={r.en} className="w-full aspect-video" />
          <div className="p-4">
            <p className="text-sm font-semibold text-ink-900">{r.emoji} {r.en}</p>
            <p className="text-xs text-ink-500">{r.sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
