import { inflateRawSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

/**
 * A minimal .docx reader.
 *
 * A .docx is a ZIP holding `word/document.xml`. Rather than take a dependency
 * for a single build-time task, this walks the ZIP central directory and
 * inflates the one entry we need.
 */

const EOCD_SIG = 0x06054b50
const CEN_SIG = 0x02014b50
const LOC_SIG = 0x04034b50

function findEocd(buf: Buffer): number {
  // The EOCD is at the end, after an optional comment of up to 64 KiB.
  const start = Math.max(0, buf.length - 0x10000 - 22)
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  throw new Error('not a zip file: no end-of-central-directory record')
}

/** Reads one entry out of a ZIP archive by name. */
export function readZipEntry(zipPath: string, entryName: string): Buffer {
  const buf = readFileSync(zipPath)
  const eocd = findEocd(buf)
  const entryCount = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)

  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) throw new Error('corrupt central directory')
    const method = buf.readUInt16LE(p + 10)
    const compressedSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')

    if (name === entryName) {
      if (buf.readUInt32LE(localOffset) !== LOC_SIG) throw new Error('corrupt local header')
      const locNameLen = buf.readUInt16LE(localOffset + 26)
      const locExtraLen = buf.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + locNameLen + locExtraLen
      const data = buf.subarray(dataStart, dataStart + compressedSize)
      return method === 0 ? Buffer.from(data) : inflateRawSync(data)
    }

    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`entry not found in archive: ${entryName}`)
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

/**
 * Returns the document's paragraphs as plain text.
 *
 * Word splits a single visible sentence across many `<w:t>` runs whenever
 * formatting changes mid-line, so runs are concatenated within each `<w:p>`
 * and only paragraph boundaries become line breaks.
 */
export function readDocxParagraphs(path: string): string[] {
  const xml = readZipEntry(path, 'word/document.xml').toString('utf8')
  const paragraphs: string[] = []

  for (const p of xml.split(/<w:p[ >]/).slice(1)) {
    const body = p.slice(0, p.indexOf('</w:p>') === -1 ? undefined : p.indexOf('</w:p>'))
    let text = ''
    for (const m of body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
      text += decodeEntities(m[1])
    }
    // Word encodes non-breaking spaces literally; normalise them to plain spaces.
    text = text.replace(/\u00a0/g, ' ').trim()
    if (text) paragraphs.push(text)
  }

  return paragraphs
}
