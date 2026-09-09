import { inflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

/**
 * A minimal PDF text reader, for the plans that only exist as PDFs.
 *
 * Twelve of the dietician's weeks were never sent as .docx, mostly the autumn
 * 2020 to January 2021 run, and the importer could not open them at all. They
 * are a third of everything she has written.
 *
 * They are Word exports rather than scans, so the text is there to be read,
 * and reading it is a smaller job than it sounds: in the same spirit as
 * `docx.ts` walking a ZIP by hand rather than taking a dependency for one
 * build-time task.
 *
 * What this does not do is general PDF. It has no interest in scans, in
 * encrypted files or in columns. It reads the shape these particular
 * documents have, and `data:check` counts the lines it produced so that a
 * document it reads badly cannot pass unnoticed.
 */

/**
 * The eight printable characters Windows-1252 puts where Latin-1 has controls.
 *
 * Word writes real typographic quotes and dashes, and decoding those bytes as
 * Latin-1 turns them into control characters that survive as far as a food
 * name and then match nothing.
 */
const CP1252_HIGH: Record<number, string> = {
  0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†',
  0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8b: '‹', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–',
  // Escaped rather than written out: it is the em dash, as a value this
  // table has to carry, not as prose.
  0x97: '\u2014', 0x98: '\u02dc', 0x99: '\u2122', 0x9b: '\u203a',
}

type Objects = Map<number, string>

/**
 * Every object in the file, including the ones packed inside object streams.
 *
 * Word writes most of a document's structure into `/Type/ObjStm` containers,
 * so a font dictionary is usually not sitting in the file as plain text.
 * Without unpacking those there is no way to learn that `/F3` is a two-byte
 * font, and every accented word in half these documents reads as rubbish.
 */
function readObjects(buf: Buffer): { objects: Objects; pages: string[] } {
  const objects: Objects = new Map()
  const pages: string[] = []
  const raw = buf.toString('latin1')

  for (const m of raw.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
    const at = (m.index ?? 0) + m[0].length
    const endObj = raw.indexOf('endobj', at)
    if (endObj === -1) continue

    const body = raw.slice(at, endObj)
    objects.set(Number(m[1]), body)

    const streamAt = body.indexOf('stream')
    const endStream = body.indexOf('endstream')
    if (streamAt === -1 || endStream === -1) continue

    const dict = body.slice(0, streamAt)
    let from = at + streamAt + 'stream'.length
    if (buf[from] === 0x0d) from++
    if (buf[from] === 0x0a) from++
    const to = at + endStream
    if (to <= from) continue
    /*
     * `/Length1` is how an embedded font program announces itself.
     *
     * `/FontFile2` names it from the font descriptor, which is a different
     * object, so the stream's own dictionary says only its two lengths. Read
     * as page content, six hundred kilobytes of glyph outlines produced a run
     * of bytes that the line joiner then stuck onto the end of the last meal
     * of the document: "Vacsora: vegyes saláta + 50 g feta + 1 tk. olívaolaj"
     * and then a paragraph of rubbish.
     */
    if (dict.includes('FontFile') || dict.includes('/Length1')) continue
    if (dict.includes('/Image') || dict.includes('/Metadata') || dict.includes('/XRef')) continue

    let data: string
    if (dict.includes('FlateDecode')) {
      try {
        data = inflateSync(buf.subarray(from, to)).toString('latin1')
      } catch {
        // A stream we cannot inflate was not one of ours.
        continue
      }
    } else {
      data = buf.subarray(from, to).toString('latin1')
    }

    if (dict.includes('/ObjStm')) {
      // The header is `number offset` pairs, then the objects, all measured
      // from /First.
      const first = Number(/\/First\s+(\d+)/.exec(dict)?.[1] ?? 0)
      const header = data.slice(0, first).trim().split(/\s+/).map(Number)
      for (let i = 0; i + 1 < header.length; i += 2) {
        const start = first + header[i + 1]
        const stop = i + 3 < header.length ? first + header[i + 3] : data.length
        objects.set(header[i], data.slice(start, stop))
      }
    } else {
      objects.set(Number(m[1]), data)
      pages.push(data)
    }
  }

  return { objects, pages }
}

/**
 * What a two-byte font's glyph numbers mean, from its `/ToUnicode` map.
 *
 * A `Type0` font with `Identity` encoding does not store characters at all: it
 * stores positions of glyphs inside the embedded font file, two bytes each.
 * Read as letters they are noise, which is why every word carrying an accent
 * went missing from half these documents while the plain ones came through
 * intact. Word puts exactly the characters its WinAnsi subset cannot hold into
 * such a font, and in Hungarian that is most of the interesting ones.
 */
function toUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>()
  const chars = (hex: string) =>
    (hex.match(/.{4}/g) ?? []).map((h) => parseInt(h, 16)).filter((n) => n > 0)

  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(pair[1], 16), String.fromCharCode(...chars(pair[2])))
    }
  }

  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    // "<lo> <hi> [<a> <b> <c>]" names each code in the run.
    for (const run of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<[0-9A-Fa-f]+>\s*\[([\s\S]*?)\]/g)) {
      const lo = parseInt(run[1], 16)
      let i = 0
      for (const one of run[2].matchAll(/<([0-9A-Fa-f]+)>/g)) {
        map.set(lo + i, String.fromCharCode(...chars(one[1])))
        i++
      }
    }
    // "<lo> <hi> <first>" walks the two together.
    for (const run of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(run[1], 16)
      const hi = parseInt(run[2], 16)
      const first = parseInt(run[3], 16)
      for (let i = 0; i <= hi - lo && i < 0x10000; i++) {
        if (!map.has(lo + i)) map.set(lo + i, String.fromCharCode(first + i))
      }
    }
  }

  return map
}

/**
 * The two-byte fonts, by the name a page calls them.
 *
 * A page names its fonts as `/Font<</F1 5 0 R/F3 15 0 R>>`. Only the ones that
 * turn out to be `Type0` need translating; the rest are WinAnsi and are
 * already letters.
 */
function wideFonts(objects: Objects): Map<string, Map<number, string>> {
  const named = new Map<string, Map<number, string>>()

  for (const [, body] of objects) {
    for (const entry of body.matchAll(/\/(F\d+)\s+(\d+)\s+\d+\s+R/g)) {
      if (named.has(entry[1])) continue
      const font = objects.get(Number(entry[2]))
      if (!font?.includes('/Type0')) continue
      const ref = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(font)
      const cmap = ref ? objects.get(Number(ref[1])) : undefined
      if (cmap) named.set(entry[1], toUnicode(cmap))
    }
  }

  return named
}

/** A PDF string literal, as the bytes it stands for. */
function bytesOf(literal: string): number[] {
  const out: number[] = []
  let i = 0

  while (i < literal.length) {
    const ch = literal[i]
    if (ch !== '\\') {
      out.push(literal.charCodeAt(i))
      i++
      continue
    }

    const next = literal[i + 1]
    const octal = literal.slice(i + 1).match(/^[0-7]{1,3}/)
    if (octal) {
      out.push(parseInt(octal[0], 8))
      i += 1 + octal[0].length
    } else if (next === 'n' || next === 'r' || next === 't' || next === 'b' || next === 'f') {
      out.push(0x20)
      i += 2
    } else {
      out.push((next ?? '').charCodeAt(0))
      i += 2
    }
  }

  return out
}

/**
 * The bytes of a hex string.
 *
 * The other way PDF writes a string, and the way Word writes every two-byte
 * one: `<004E004C>` rather than a literal. Reading only literals is why the
 * accented words were still missing after the fonts were understood, since
 * those are exactly the runs that go into the two-byte font.
 */
function hexBytes(hex: string): number[] {
  const clean = hex.replace(/\s+/g, '')
  const pairs = clean.length % 2 ? `${clean}0` : clean
  return (pairs.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16))
}

/** One drawn string, read either as letters or as glyph numbers. */
function decode(bytes: number[], wide: Map<number, string> | undefined): string {
  if (!wide) return bytes.map((b) => CP1252_HIGH[b] ?? String.fromCharCode(b)).join('')

  let out = ''
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += wide.get((bytes[i] << 8) | bytes[i + 1]) ?? ''
  }
  return out
}

/**
 * Kerned-apart words, put back together.
 *
 * Word does not always write a space. It writes the two words as separate
 * strings in a `TJ` array with a number between them, and that number is how
 * far to move before drawing the next one. A large enough move is a space, and
 * without this the plans arrive full of "1alma" and "gcsirkéscsorba", which
 * resolve to nothing. A quarter of an em is the usual threshold, and `TJ`
 * numbers are thousandths of an em, negative when they move forward.
 */
const SPACE_KERN = -250

/** Either way PDF writes a string: a literal, or hex between angle brackets. */
const STRING = String.raw`\((?:[^()\\]|\\[\s\S])*\)|<[0-9A-Fa-f\s]*>`

function showText(operand: string, wide: Map<number, string> | undefined): string {
  let out = ''

  for (const m of operand.matchAll(new RegExp(`${STRING}|-?\\d+(?:\\.\\d+)?`, 'g'))) {
    const token = m[0]
    if (token.startsWith('(')) out += decode(bytesOf(token.slice(1, -1)), wide)
    else if (token.startsWith('<')) out += decode(hexBytes(token.slice(1, -1)), wide)
    else if (Number(token) <= SPACE_KERN && out && !out.endsWith(' ')) out += ' '
  }

  return out
}

interface Run { x: number; y: number; text: string }

/**
 * Every piece of drawn text on a page, with where it was drawn.
 *
 * Grouping by "the block before this one sat at the same height" is what a
 * first attempt does, and it works only while a line is drawn in one go. These
 * documents are not: some are laid down font by font, so the bold "Ebéd:" and
 * the plain text after it are far apart in the stream and the pieces of one
 * line arrive interleaved with another's. Read that way, one document lost its
 * meal labels and glued the back half of lunch onto the morning snack.
 *
 * So position is read rather than inferred: `a b c d e f Tm` puts text at e
 * across and f up, and `tx ty Td` moves relative to the line before it.
 */
function runs(stream: string, fonts: Map<string, Map<number, string>>): Run[] {
  const found: Run[] = []
  let x = 0
  let y = 0
  let wide: Map<number, string> | undefined

  /*
   * The array form has to know where its strings are.
   *
   * A glyph number in a two-byte font is any pair of bytes, and plenty of them
   * are the byte for "]". Scanning an array as "everything up to the first ]"
   * therefore cut words in half at whatever glyph happened to contain one, and
   * the halves were dropped: "olívaolaj" arrived as "vaolaj". So strings are
   * consumed as strings, and only what is between them is read as numbers.
   */
  const TOKENS = new RegExp([
    String.raw`(-?[\d.]+)\s+(-?[\d.]+)\s+(Tm|Td|TD)\b`,
    String.raw`\/(F\d+)\s+[\d.]+\s+Tf\b`,
    String.raw`((?:\[(?:${STRING}|[^\[\]])*\]|${STRING})\s*(?:TJ|Tj|'|"))`,
  ].join('|'), 'g')

  for (const m of stream.matchAll(TOKENS)) {
    if (m[3] === 'Tm') {
      x = Number(m[1])
      y = Number(m[2])
    } else if (m[3] === 'Td' || m[3] === 'TD') {
      x += Number(m[1])
      y += Number(m[2])
    } else if (m[4]) {
      wide = fonts.get(m[4])
    } else if (m[5]) {
      const text = showText(m[5], wide)
      if (text) found.push({ x, y, text })
    }
  }

  return found
}

/**
 * The runs gathered into lines, down the page and then across it.
 *
 * Heights are compared with a little slack, because a line carrying a
 * superscript or a second font size is not drawn at exactly one height.
 */
const SAME_LINE = 3

/**
 * Where a page is split into two columns, if it is.
 *
 * One of the thirty-six weeks is laid out as two columns, and read straight
 * down the page it came out as "Miercuri: Sambata:" and lunch with somebody
 * else's breakfast welded to the end of it. Nothing parsed, and the plan
 * arrived with no days in it at all.
 *
 * A gutter is a band no text begins in, and there are usually several: a left
 * column has sparse patches all through it wherever no run happens to start.
 * Taking the widest put the split inside the left column, which cut "farfurie"
 * in half and posted "rie" to the other side of the page. The gutter is the
 * *last* clear band, because everything to the left of it is still column one.
 *
 * Both sides also have to be substantial, which is what keeps an ordinary page
 * whole: on one column of prose the right-hand end is a thin tail, not half a
 * page of text.
 */
const GUTTER = 35

function columnSplit(all: Run[]): number | null {
  if (all.length < 40) return null

  const xs = [...new Set(all.map((r) => r.x))].sort((a, b) => a - b)
  const low = xs[0]
  const high = xs[xs.length - 1]
  if (high - low < 200) return null

  const enough = all.length * 0.25
  let best: number | null = null

  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] < GUTTER) continue
    const at = (xs[i - 1] + xs[i]) / 2
    const left = all.filter((r) => r.x < at).length
    if (left < enough || all.length - left < enough) continue
    best = at
  }

  return best
}

/** Runs gathered into lines, down the page and then across it. */
function linesFrom(all: Run[]): string[] {
  const sorted = [...all].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: string[] = []
  let top: number | null = null

  for (const run of sorted) {
    if (top === null || Math.abs(run.y - top) > SAME_LINE) {
      top = run.y
      lines.push(run.text)
    } else {
      lines[lines.length - 1] += run.text
    }
  }

  return lines
}

function pageLines(stream: string, fonts: Map<string, Map<number, string>>): string[] {
  const all = runs(stream, fonts)
  const split = columnSplit(all)
  if (split == null) return linesFrom(all)

  // The left column first and then the right, which is the order they are
  // read in and the order the days run.
  return [
    ...linesFrom(all.filter((r) => r.x < split)),
    ...linesFrom(all.filter((r) => r.x >= split)),
  ]
}

/**
 * A line that continues the one above rather than starting something new.
 *
 * The documents are a day name and then five `SLOT: text` lines, but a long
 * meal wraps, and the wrapped part is its own line on the page with no label
 * on it. Left alone it would be dropped, taking half a dinner with it, since
 * the parser only keeps lines it can put a slot to.
 */
function isContinuation(line: string): boolean {
  return !/^\s*[A-Za-zăâîșțáéíóöőúüű_]+[0-9]?\s*:/.test(line)
}

/**
 * The document's lines, in the shape `readDocxParagraphs` returns.
 *
 * Both readers feed the same parser, so a plan is read the same way whichever
 * form it arrived in.
 */
export function readPdfLines(path: string): string[] {
  const buf = readFileSync(path)
  const { objects, pages } = readObjects(buf)
  const fonts = wideFonts(objects)
  const lines: string[] = []

  for (const page of pages) {
    for (const text of pageLines(page, fonts)) {
      // Word writes non-breaking spaces literally, as `docx.ts` also finds.
      const clean = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
      if (!clean) continue
      // Whatever else a meal line is, it is words. A run that is mostly
      // control characters came from something that is not text, and the next
      // one will not have the same dictionary to be excluded by.
      const readable = clean.replace(/[^\p{L}\d\s.,:;()/+%'"-]/gu, '').length
      if (readable / clean.length < 0.8) continue
      // Page numbers, and the header and footer artefacts around them.
      if (/^\d{1,2}$/.test(clean)) continue

      if (lines.length && isContinuation(clean)) lines[lines.length - 1] += ` ${clean}`
      else lines.push(clean)
    }
  }

  return lines
}
