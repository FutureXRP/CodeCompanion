/**
 * Small RFC-4180-style CSV reader: quoted fields, doubled quotes, CR/LF line
 * ends, no dependencies. Used for the files a practice hands us — fee-schedule
 * and contract exports, CMS NCCI tables — which are small and well-formed.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.startsWith('﻿') ? text.slice(1) : text
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/** Header row → objects keyed by the normalized header (lower-case, single-spaced, trimmed). */
export function csvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(text)
  if (rows.length === 0) return { headers: [], records: [] }
  const headers = rows[0].map(normalizeHeader)
  const records = rows.slice(1).map((r) => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim()
    })
    return o
  })
  return { headers, records }
}

export function normalizeHeader(h: string): string {
  return h.replace(/﻿/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** The first header matching any of the patterns, in priority order. */
export function findHeader(headers: string[], patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const hit = headers.find((h) => p.test(h))
    if (hit) return hit
  }
  return undefined
}
