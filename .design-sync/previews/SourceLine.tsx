import { SourceLine } from 'bite-buddy'

const romanian = '300 g ciorba de fasole verde (o lingurita de ulei de masline / portie), 30 g paine int, 1 rosie'
const hungarian = '120 g csirkemell (1 tk/ adag) + 180 g karfiol pure (60% karfiol, 40% krumpli) + uborka'

/** Plain foreign text, translated underneath. The English leads. */
export function Translated() {
  return (
    <div style={{ width: 520 }}>
      <SourceLine text={romanian} translate lang="ro" />
    </div>
  )
}

/**
 * The dietician's own wording as the headline.
 *
 * Used in the plan archive, where what she wrote is the record and the English
 * is the gloss. Everywhere else the English goes first.
 */
export function HerWordingLeads() {
  return (
    <div style={{ width: 520, display: 'grid', gap: 18 }}>
      <SourceLine text={romanian} translate lead lang="ro" />
      <SourceLine text={hungarian} translate lead lang="hu" />
    </div>
  )
}

/** One line with an ellipsis, for a dense list where the line is only a hint. */
export function Truncated() {
  return (
    <div style={{ width: 320 }}>
      <SourceLine text={romanian} translate lang="ro" truncate />
    </div>
  )
}

/** Up to three lines, where the original wording is the point. */
export function Clamped() {
  return (
    <div style={{ width: 320, display: 'grid', gap: 18 }}>
      <SourceLine text={romanian} translate lang="ro" clamp={2} />
      <SourceLine text={hungarian} translate lang="hu" clamp={3} />
    </div>
  )
}

/**
 * Foreign text that is not hers.
 *
 * Without `translate` the component shows the words and claims nothing about
 * them, which is the honest default for a food name somebody typed in.
 */
export function Untranslated() {
  return (
    <div style={{ width: 520 }}>
      <SourceLine text="telemea de capra" />
    </div>
  )
}
