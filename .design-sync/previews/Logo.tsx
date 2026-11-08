import { Logo } from 'bite-buddy'

/** The horizontal lockup, as the header and sign-in show it. */
export function Horizontal() {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <Logo size={24} />
      <Logo size={34} />
      <Logo size={48} title="Bite Buddy" />
    </div>
  )
}

/** The mark alone, as empty, error and loading states show it. */
export function Mark() {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <Logo variant="mark" size={32} />
      <Logo variant="mark" size={56} />
      <Logo variant="mark" size={84} />
    </div>
  )
}
