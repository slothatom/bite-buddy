import { describe, expect, it } from 'vitest'
import { deflateSync } from 'node:zlib'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPdfLines } from './pdf'

/**
 * The reader is hand-written and the documents it was written for cannot be
 * committed: they are somebody's named medical correspondence and this
 * repository is public. So the fixtures are built here, small enough to read,
 * and each one is a shape a real plan actually had.
 */

/** A PDF with one page, holding the objects given. */
function pdf(objects: Record<number, string | { dict: string; data: string }>): string {
  const dir = mkdtempSync(join(tmpdir(), 'bite-pdf-'))
  const path = join(dir, 'plan.pdf')
  const parts: Buffer[] = [Buffer.from('%PDF-1.7\n', 'latin1')]

  for (const [n, body] of Object.entries(objects)) {
    if (typeof body === 'string') {
      parts.push(Buffer.from(`${n} 0 obj\n${body}\nendobj\n`, 'latin1'))
      continue
    }
    const deflated = deflateSync(Buffer.from(body.data, 'latin1'))
    parts.push(
      Buffer.from(`${n} 0 obj\n${body.dict}\nstream\n`, 'latin1'),
      deflated,
      Buffer.from('\nendstream\nendobj\n', 'latin1'),
    )
  }

  writeFileSync(path, Buffer.concat(parts))
  return path
}

/** One positioned run of text. */
const at = (x: number, y: number, font: string, show: string) =>
  `BT\n/${font} 11 Tf\n1 0 0 1 ${x} ${y} Tm\n${show} TJ\nET\n`

describe('reading a plan out of a PDF', () => {
  it('reads positioned text down the page and across it', () => {
    const path = pdf({
      3: '<</Type/Page/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
      5: '<</Type/Font/Subtype/TrueType/Name/F1/Encoding/WinAnsiEncoding>>',
      4: {
        dict: '<</Filter/FlateDecode>>',
        data: at(70, 700, 'F1', '[(Szerda:)]')
          + at(70, 680, 'F1', '[(Reggeli: 50 g kenyer)]'),
      },
    })

    expect(readPdfLines(path)).toEqual(['Szerda:', 'Reggeli: 50 g kenyer'])
  })

  it('puts a line back together when it is drawn out of order', () => {
    // Some of these documents are laid down font by font, so the bold label
    // and the text after it are far apart in the stream. Read in stream order
    // one document lost its meal labels and glued the back half of lunch onto
    // the morning snack.
    const path = pdf({
      3: '<</Type/Page/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
      5: '<</Type/Font/Subtype/TrueType/Name/F1/Encoding/WinAnsiEncoding>>',
      4: {
        dict: '<</Filter/FlateDecode>>',
        data: at(200, 680, 'F1', '[(50 g kenyer)]')
          + at(70, 660, 'F1', '[(Uzsi1: 1 alma)]')
          + at(70, 680, 'F1', '[(Reggeli: )]'),
      },
    })

    expect(readPdfLines(path)).toEqual(['Reggeli: 50 g kenyer', 'Uzsi1: 1 alma'])
  })

  it('reads the accented words out of a two-byte font', () => {
    // Word puts every character its WinAnsi subset cannot hold into a Type0
    // font, which stores glyph numbers rather than letters, as hex strings.
    // In Hungarian that is most of the interesting characters, and reading
    // only the literal strings lost every accented word in half the archive:
    // "olívaolaj" arrived as "vaolaj".
    const cmap = `/CIDInit /ProcSet findresource begin
begincmap
2 beginbfchar
<00A4> <00ED>
<0114> <0151>
endbfchar
1 beginbfrange
<0044> <0046> <0061>
endbfrange
endcmap`

    const path = pdf({
      3: '<</Type/Page/Resources<</Font<</F1 5 0 R/F4 17 0 R>>>>/Contents 4 0 R>>',
      5: '<</Type/Font/Subtype/TrueType/Name/F1/Encoding/WinAnsiEncoding>>',
      17: '<</Type/Font/Subtype/Type0/Encoding/Identity-H/ToUnicode 87 0 R>>',
      87: { dict: '<</Filter/FlateDecode>>', data: cmap },
      4: {
        dict: '<</Filter/FlateDecode>>',
        data: at(70, 700, 'F1', '[(ol)]')
          + at(80, 700, 'F4', '[<00A4>]')
          + at(90, 700, 'F1', '[(vaolaj )]')
          + at(130, 700, 'F4', '[<0114>]')
          + at(140, 700, 'F4', '[<00440045>15<0046>]'),
      },
    })

    expect(readPdfLines(path)).toEqual(['olívaolaj őabc'])
  })

  it('does not stop a kerned array at a glyph that contains a bracket', () => {
    // 0x5D is the byte for "]", and it is an ordinary half of a glyph number.
    // Scanning an array as "everything up to the first ]" cut words in half at
    // whatever glyph happened to contain one, and the halves were dropped.
    const cmap = `begincmap
1 beginbfrange
<5D00> <5D02> <0061>
endbfrange
endcmap`

    const path = pdf({
      3: '<</Type/Page/Resources<</Font<</F4 17 0 R>>>>/Contents 4 0 R>>',
      17: '<</Type/Font/Subtype/Type0/Encoding/Identity-H/ToUnicode 87 0 R>>',
      87: { dict: '<</Filter/FlateDecode>>', data: cmap },
      4: {
        dict: '<</Filter/FlateDecode>>',
        data: at(70, 700, 'F4', '[<5D005D015D02>]'),
      },
    })

    expect(readPdfLines(path)).toEqual(['abc'])
  })

  it('reads a wide kern as the space Word did not write', () => {
    // Word writes two words as separate strings with a number between them
    // rather than a space, and without this the plans arrive full of "1alma".
    const path = pdf({
      3: '<</Type/Page/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
      5: '<</Type/Font/Subtype/TrueType/Name/F1/Encoding/WinAnsiEncoding>>',
      4: { dict: '<</Filter/FlateDecode>>', data: at(70, 700, 'F1', '[(1)-278(alma)]') },
    })

    expect(readPdfLines(path)).toEqual(['1 alma'])
  })

  it('joins a wrapped line onto the meal it belongs to', () => {
    // A long meal wraps, and the wrapped part has no label on it. Left alone
    // it would be dropped, taking half a dinner with it.
    const path = pdf({
      3: '<</Type/Page/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
      5: '<</Type/Font/Subtype/TrueType/Name/F1/Encoding/WinAnsiEncoding>>',
      4: {
        dict: '<</Filter/FlateDecode>>',
        data: at(70, 700, 'F1', '[(Ebed: 100 g piept de pui,)]')
          + at(70, 685, 'F1', '[(40 g bulgur)]'),
      },
    })

    expect(readPdfLines(path)).toEqual(['Ebed: 100 g piept de pui, 40 g bulgur'])
  })
})
