/**
 * Minimal XML helpers for Tebra's SOAP responses. The payloads are flat WCF
 * DataContract records (<ChargeData><ID>…</ID>…</ChargeData>): scalar leaves,
 * optional namespace prefixes, xsi:nil for nulls, entity-escaped text. A full XML
 * parser is overkill for that shape; this extractor tolerates prefixes,
 * self-closing / nil elements and entities, and is unit-tested. If a nested shape
 * ever shows up, swap a parser in here — nothing above this file changes.
 */

const NAME = '[A-Za-z_][\\w.-]*'
const PREFIX = `(?:${NAME}:)?`

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Entity decode — `&amp;` last, so "&amp;lt;" correctly becomes the text "&lt;". */
export function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Inner XML of every `<tag>…</tag>` element (any prefix), in document order. */
export function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${PREFIX}${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${PREFIX}${tag}\\s*>`, 'g')
  const out: string[] = []
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push(m[1])
  return out
}

/** The scalar leaf elements of a block → { Name: text }. Empty / nil elements → ''. */
export function leafMap(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = new RegExp(`<${PREFIX}(${NAME})(\\s[^>]*)?(?:/>|>([^<]*)</${PREFIX}\\1\\s*>)`, 'g')
  for (let m = re.exec(block); m; m = re.exec(block)) {
    const name = m[1]
    if (name in out) continue // first occurrence wins
    out[name] = m[3] === undefined ? '' : decodeXml(m[3])
  }
  return out
}

/** Every record element with the tag → a flat field map each. */
export function extractRecords(xml: string, tag: string): Record<string, string>[] {
  return extractBlocks(xml, tag).map(leafMap)
}

/** The first element with the tag as a flat map, or null when absent. */
export function extractFirst(xml: string, tag: string): Record<string, string> | null {
  const [block] = extractBlocks(xml, tag)
  return block === undefined ? null : leafMap(block)
}

/** Records under the first of several candidate tags that yields any — for nested shapes whose element names vary by WSDL version. */
export function extractRecordsAny(xml: string, tags: string[]): Record<string, string>[] {
  for (const tag of tags) {
    const found = extractRecords(xml, tag)
    if (found.length > 0) return found
  }
  return []
}

export function extractFirstAny(xml: string, tags: string[]): Record<string, string> | null {
  for (const tag of tags) {
    const found = extractFirst(xml, tag)
    if (found) return found
  }
  return null
}

/** `<string>` items under a list element (e.g. SecurityResponse.PermissionsMissing). */
export function extractStringList(xml: string, tag: string): string[] {
  const [block] = extractBlocks(xml, tag)
  if (block === undefined) return []
  return extractBlocks(block, 'string')
    .map((s) => decodeXml(s).trim())
    .filter(Boolean)
}
