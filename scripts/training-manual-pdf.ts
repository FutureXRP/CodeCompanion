/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Renders TRAINING-MANUAL.md as a branded PDF (pdfkit — the only extra dep).
 *
 *   npm run training:pdf                       # → docs/training/CodeCompanion-Training-Manual.pdf
 *   npm run training:pdf -- --src=X.md --out=Y.pdf
 *
 * The Markdown is the source of truth — edit it, re-run this. Supported subset:
 * `#` cover title (and the paragraphs before the first `##` as the cover text),
 * `##` chapters (listed in the contents with page numbers), `###` sections,
 * paragraphs, `- ` bullets (a leading **bold** phrase becomes the lead),
 * `1. ` numbered steps, `| |` tables, ``` code blocks, `![caption](file.png)`
 * images (missing files render as a placeholder), `> [!NOTE]` / `> [!TIP]` /
 * `> [!WARNING]` callouts, `---` page breaks, inline **bold** and `code`.
 */
import PDFDocument from 'pdfkit'
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// ---- args -------------------------------------------------------------------
function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const SRC = path.resolve(arg('src', 'TRAINING-MANUAL.md'))
const OUT = path.resolve(arg('out', path.join('docs', 'training', 'CodeCompanion-Training-Manual.pdf')))

// ---- palette (shared with the athena guide) ---------------------------------
const SAGE = '#3f7d6a', SAGE_D = '#34685a', INK = '#1f2d27', SUB = '#586860'
const FAINT = '#9aa69f', GOLD = '#b8862a', CLAY = '#c1633f', LINE = '#e7e1d6'
const WARMCELL = '#faf8f3', SLATE = '#33403a'
const LEFT = 58, WIDTH = 496, RIGHT = LEFT + WIDTH, PAGE_H = 792, BOTTOM = PAGE_H - 58

// ---- markdown subset → blocks ---------------------------------------------
type Block =
  | { kind: 'title'; text: string }
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'code'; lines: string[] }
  | { kind: 'image'; caption: string; file: string }
  | { kind: 'callout'; variant: 'info' | 'warn' | 'gold'; text: string }
  | { kind: 'pagebreak' }

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: { kind: 'bullets' | 'numbered'; items: string[] } | null = null
  let quote: string[] | null = null
  let table: string[][] | null = null
  let code: string[] | null = null

  const flushPara = () => { if (para.length) { blocks.push({ kind: 'para', text: para.join(' ') }); para = [] } }
  const flushList = () => { if (list) { blocks.push(list); list = null } }
  const flushTable = () => { if (table) { blocks.push({ kind: 'table', rows: table }); table = null } }
  const flushQuote = () => {
    if (!quote) return
    let variant: 'info' | 'warn' | 'gold' = 'info'
    const body = [...quote]
    const tag = /^\[!(\w+)\]\s*$/.exec(body[0] ?? '')
    if (tag) {
      body.shift()
      variant = /warn|caution|important/i.test(tag[1]) ? 'warn' : /tip/i.test(tag[1]) ? 'gold' : 'info'
    }
    blocks.push({ kind: 'callout', variant, text: body.join(' ').trim() })
    quote = null
  }
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable() }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (code) {
      if (/^```/.test(line)) { blocks.push({ kind: 'code', lines: code }); code = null } else code.push(line)
      continue
    }
    if (/^```/.test(line)) { flushAll(); code = []; continue }
    if (line.trim() === '') { flushAll(); continue }
    if (/^---+$/.test(line.trim())) { flushAll(); blocks.push({ kind: 'pagebreak' }); continue }
    let m: RegExpExecArray | null
    if ((m = /^#\s+(.*)$/.exec(line))) { flushAll(); blocks.push({ kind: 'title', text: m[1] }); continue }
    if ((m = /^##\s+(.*)$/.exec(line))) { flushAll(); blocks.push({ kind: 'h1', text: m[1] }); continue }
    if ((m = /^###\s+(.*)$/.exec(line))) { flushAll(); blocks.push({ kind: 'h2', text: m[1] }); continue }
    if ((m = /^!\[(.*?)\]\((.*?)\)\s*$/.exec(line))) { flushAll(); blocks.push({ kind: 'image', caption: m[1], file: m[2] }); continue }
    if (/^\|/.test(line)) {
      flushPara(); flushList(); flushQuote()
      if (/^\|?\s*:?-{2,}/.test(line)) continue // header separator
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
      ;(table ??= []).push(cells)
      continue
    }
    flushTable()
    if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); (quote ??= []).push(m[1]); continue }
    flushQuote()
    if ((m = /^[-*]\s+(.*)$/.exec(line))) {
      flushPara()
      if (!list || list.kind !== 'bullets') { flushList(); list = { kind: 'bullets', items: [] } }
      list.items.push(m[1])
      continue
    }
    if ((m = /^\d+\.\s+(.*)$/.exec(line))) {
      flushPara()
      if (!list || list.kind !== 'numbered') { flushList(); list = { kind: 'numbered', items: [] } }
      list.items.push(m[1])
      continue
    }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue }
    flushList()
    para.push(line.trim())
  }
  if (code) blocks.push({ kind: 'code', lines: code })
  flushAll()
  return blocks
}

// ---- inline text ------------------------------------------------------------
/** Strip links to their text and backticks around code; keep ** for the bold splitter. */
function inline(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`([^`]*)`/g, '$1')
}
const plain = (text: string) => inline(text).replace(/\*\*/g, '')

interface Rich { x: number; y?: number; width: number; size: number; color: string; lineGap: number; bold?: boolean }

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 64, bottom: 58, left: LEFT, right: LEFT },
  bufferPages: true,
  info: { Title: 'CodeCompanion — Training Manual', Author: 'CodeCompanion', Subject: 'Staff walkthrough of the CodeCompanion dashboard alongside Tebra' },
})

function ensure(h: number) { if (doc.y + h > BOTTOM) doc.addPage() }
function gap(h: number) { doc.y += h }

/**
 * Text with **bold** runs, laid out as one flowing paragraph. The first
 * non-empty run is the one positioned at (x, y) — a text that *starts* with a
 * bold run must not inherit pdfkit's cursor from whatever was drawn before it.
 */
function rich(text: string, r: Rich) {
  const y = r.y ?? doc.y
  const runs = inline(text)
    .split('**')
    .map((s, i) => ({ s, bold: r.bold || i % 2 === 1 }))
    .filter((run) => run.s !== '')
  if (runs.length === 0) return
  runs.forEach((run, i) => {
    doc.font(run.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(r.size).fillColor(r.color)
    const opts = { width: r.width, lineGap: r.lineGap, continued: i < runs.length - 1 }
    if (i === 0) doc.text(run.s, r.x, y, opts)
    else doc.text(run.s, opts)
  })
}
function heightOf(text: string, width: number, size: number, lineGap: number, bold = false): number {
  return doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).heightOfString(plain(text), { width, lineGap })
}

// ---- blocks -----------------------------------------------------------------
const chapterPage = new Map<string, number>()
const pageNumber = () => doc.bufferedPageRange().count

function h1(text: string) {
  ensure(170) // a chapter heading never sits alone at the foot of a page
  gap(10)
  chapterPage.set(text, pageNumber())
  doc.font('Helvetica-Bold').fontSize(15).fillColor(SAGE).text(plain(text), LEFT, doc.y, { width: WIDTH })
  const ly = doc.y + 4
  doc.moveTo(LEFT, ly).lineTo(RIGHT, ly).lineWidth(1).strokeColor(LINE).stroke()
  doc.y = ly + 12
}
function h2(text: string) {
  ensure(34)
  gap(6)
  doc.font('Helvetica-Bold').fontSize(11.2).fillColor(INK).text(plain(text), LEFT, doc.y, { width: WIDTH })
  doc.y += 4
}
function para(text: string, color = INK, size = 9.8) {
  const h = heightOf(text, WIDTH, size, 2.4)
  ensure(Math.min(h, 120) + 7)
  rich(text, { x: LEFT, width: WIDTH, size, color, lineGap: 2.4 })
  doc.y += 6
}
function bullets(items: string[]) {
  const indent = 15
  for (const it of items) {
    const h = heightOf(it, WIDTH - indent, 9.6, 2.2)
    ensure(Math.min(h, 100) + 5)
    const y = doc.y
    doc.fillColor(SAGE).font('Helvetica-Bold').fontSize(9.6).text('›', LEFT + 1, y)
    rich(it, { x: LEFT + indent, y, width: WIDTH - indent, size: 9.6, color: INK, lineGap: 2.2 })
    doc.y += 2.5
  }
  doc.y += 3
}
function numbered(items: string[]) {
  items.forEach((s, i) => {
    const h = heightOf(s, WIDTH - 26, 9.6, 2.2)
    ensure(Math.min(h, 100) + 9)
    const y = doc.y
    doc.circle(LEFT + 8, y + 6, 8.5).fill(SAGE)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.6).text(String(i + 1), LEFT + 4.5, y + 2.4, { width: 8, align: 'center' })
    rich(s, { x: LEFT + 26, y, width: WIDTH - 26, size: 9.6, color: INK, lineGap: 2.2 })
    doc.y = Math.max(doc.y, y + 17) + 5
  })
  doc.y += 2
}
function callout(variant: 'info' | 'warn' | 'gold', text: string) {
  const v = {
    warn: { bg: '#fbeee8', border: '#f0d6c8', accent: CLAY, title: '#9d4a28' },
    info: { bg: '#eaf2ee', border: '#d4e6dd', accent: SAGE, title: SAGE_D },
    gold: { bg: '#f8f1dd', border: '#ecdbb2', accent: GOLD, title: '#7a5a18' },
  }[variant]
  // A leading **Title** becomes the box title.
  const m = /^\*\*([^*]+)\*\*\s*([\s\S]*)$/.exec(text.trim())
  const title = m ? m[1].trim() : ''
  const body = m ? m[2].trim() : text.trim()
  const padX = 13, padY = 11, innerW = WIDTH - padX * 2 - 4
  const tH = title ? heightOf(title, innerW, 9.8, 0, true) + 4 : 0
  const bH = body ? heightOf(body, innerW, 9.4, 2.2) : 0
  const boxH = padY * 2 + tH + bH
  ensure(boxH + 8)
  const y = doc.y
  doc.roundedRect(LEFT, y, WIDTH, boxH, 7).fillAndStroke(v.bg, v.border)
  doc.roundedRect(LEFT, y, 4.5, boxH, 2).fill(v.accent)
  if (title) doc.fillColor(v.title).font('Helvetica-Bold').fontSize(9.8).text(plain(title), LEFT + padX + 4, y + padY, { width: innerW })
  if (body) rich(body, { x: LEFT + padX + 4, y: y + padY + tH, width: innerW, size: 9.4, color: SLATE, lineGap: 2.2 })
  doc.y = y + boxH + 8
}
function codeBox(lines: string[]) {
  const padX = 12, padY = 10, lineH = 12.4
  const boxH = padY * 2 + lines.length * lineH
  ensure(boxH + 8)
  const y = doc.y
  doc.roundedRect(LEFT, y, WIDTH, boxH, 6).fillAndStroke('#f3f1ea', '#e2ddd0')
  doc.font('Courier').fontSize(8.4)
  lines.forEach((ln, i) => {
    doc.fillColor(ln.trimStart().startsWith('#') ? FAINT : SLATE).text(ln, LEFT + padX, y + padY + i * lineH, { width: WIDTH - padX * 2, lineBreak: false })
  })
  doc.y = y + boxH + 8
}
function table(rows: string[][]) {
  if (rows.length === 0) return
  const header = rows[0]
  const body = rows.slice(1)
  const cols = header.length
  // Column widths from the longest text in each column, capped — then normalized.
  const weights = header.map((_, i) => Math.min(42, Math.max(8, ...rows.map((r) => plain(r[i] ?? '').length))))
  const total = weights.reduce((s, w) => s + w, 0)
  const widths = weights.map((w) => Math.round((w / total) * WIDTH))
  const xs: number[] = []
  let cx = LEFT
  for (const w of widths) { xs.push(cx); cx += w }
  const padX = 7, padY = 5.5
  const drawHeader = () => {
    const hH = 19
    const hy = doc.y
    doc.rect(LEFT, hy, WIDTH, hH).fill(SAGE)
    doc.font('Helvetica-Bold').fontSize(8.4).fillColor('#ffffff')
    header.forEach((c, i) => doc.text(plain(c), xs[i] + padX, hy + 5.5, { width: widths[i] - padX * 2, lineBreak: false }))
    doc.y = hy + hH
  }
  ensure(60)
  drawHeader()
  let zebra = false
  for (const row of body) {
    let rowH = 0
    for (let i = 0; i < cols; i++) rowH = Math.max(rowH, heightOf(row[i] ?? '', widths[i] - padX * 2, 8.4, 1.5, i === 0))
    rowH += padY * 2
    if (doc.y + rowH > BOTTOM) { doc.addPage(); drawHeader(); zebra = false }
    const y = doc.y
    if (zebra) doc.rect(LEFT, y, WIDTH, rowH).fill(WARMCELL)
    for (let i = 0; i < cols; i++) {
      rich(row[i] ?? '', { x: xs[i] + padX, y: y + padY, width: widths[i] - padX * 2, size: 8.4, color: i === 0 ? INK : SUB, lineGap: 1.5, bold: i === 0 })
    }
    doc.moveTo(LEFT, y + rowH).lineTo(RIGHT, y + rowH).lineWidth(0.6).strokeColor(LINE).stroke()
    doc.y = y + rowH
    zebra = !zebra
  }
  doc.y += 10
}
function pngSize(file: string): { w: number; h: number } | null {
  try {
    const b = readFileSync(file)
    if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  } catch {
    return null
  }
}
const IMAGE_MAX_H = 330
function imagePath(file: string): string {
  return path.isAbsolute(file) ? file : path.resolve(path.dirname(SRC), file)
}
/** Height the image will take on the page (placeholder box when the file is missing). */
function imageHeight(file: string): number {
  const size = existsSync(imagePath(file)) ? pngSize(imagePath(file)) : null
  if (!size) return 60
  return size.h * Math.min(WIDTH / size.w, IMAGE_MAX_H / size.h) + 30
}
function image(caption: string, file: string) {
  const abs = imagePath(file)
  const size = existsSync(abs) ? pngSize(abs) : null
  const maxH = IMAGE_MAX_H
  if (!size) {
    ensure(64)
    const y = doc.y
    doc.roundedRect(LEFT, y, WIDTH, 52, 6).fillAndStroke('#f6f3ec', LINE)
    doc.font('Helvetica').fontSize(9).fillColor(FAINT).text(`Screenshot: ${file} — run npm run training:shots with the app running to capture it.`, LEFT + 12, y + 19, { width: WIDTH - 24 })
    doc.y = y + 60
    return
  }
  const scale = Math.min(WIDTH / size.w, maxH / size.h)
  const w = size.w * scale, h = size.h * scale
  ensure(h + 30)
  const y = doc.y
  doc.image(abs, LEFT, y, { width: w, height: h })
  doc.rect(LEFT, y, w, h).lineWidth(0.8).strokeColor(LINE).stroke()
  doc.y = y + h + 5
  if (caption) {
    doc.font('Helvetica-Oblique').fontSize(8.6).fillColor(FAINT).text(plain(caption), LEFT, doc.y, { width: WIDTH })
    doc.y += 4
  }
  doc.y += 8
}

// ---- render -----------------------------------------------------------------
function main() {
  if (!existsSync(SRC)) throw new Error(`Source not found: ${SRC}`)
  mkdirSync(path.dirname(OUT), { recursive: true })
  doc.pipe(createWriteStream(OUT))
  const blocks = parse(readFileSync(SRC, 'utf8'))

  // Cover: the title and everything before the first chapter.
  const firstChapter = blocks.findIndex((b) => b.kind === 'h1')
  const cover = blocks.slice(0, firstChapter === -1 ? blocks.length : firstChapter)
  const body = firstChapter === -1 ? [] : blocks.slice(firstChapter)
  const title = cover.find((b): b is { kind: 'title'; text: string } => b.kind === 'title')?.text ?? 'CodeCompanion — Training Manual'

  doc.rect(0, 0, doc.page.width, 132).fill(SAGE)
  doc.rect(0, 132, doc.page.width, 4).fill(GOLD)
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#cfe3d9').text('CODECOMPANION  ·  TRAINING MANUAL', LEFT, 40, { characterSpacing: 1.2 })
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#ffffff').text(plain(title), LEFT, 60, { width: WIDTH })
  doc.y = 156
  for (const b of cover) {
    if (b.kind === 'para') para(b.text, SUB, 10.5)
    else if (b.kind === 'callout') callout(b.variant, b.text)
    else if (b.kind === 'bullets') bullets(b.items)
  }

  // Contents — page numbers are filled in after the chapters are laid out.
  gap(4)
  doc.font('Helvetica-Bold').fontSize(8.6).fillColor(SAGE).text('CONTENTS', LEFT, doc.y, { characterSpacing: 0.8 })
  doc.y += 5
  const toc: { text: string; y: number }[] = []
  const tocPageIndex = pageNumber() - 1
  for (const b of body) {
    if (b.kind !== 'h1') continue
    ensure(16)
    toc.push({ text: b.text, y: doc.y })
    doc.font('Helvetica').fontSize(9.6).fillColor(INK).text(plain(b.text), LEFT + 4, doc.y, { width: WIDTH - 50 })
    doc.y += 3
  }

  doc.addPage()
  body.forEach((b, i) => {
    if (b.kind === 'h1') {
      // Keep a chapter heading with its opening paragraph and screenshot: if
      // they will not fit below it, start the chapter on a fresh page.
      let need = 70
      const n1 = body[i + 1]
      const n2 = body[i + 2]
      if (n1?.kind === 'para') need += heightOf(n1.text, WIDTH, 9.8, 2.4) + 7
      const img = n1?.kind === 'image' ? n1 : n2?.kind === 'image' ? n2 : null
      if (img) need += imageHeight(img.file)
      ensure(Math.min(need, BOTTOM - 64 - 20))
    }
    switch (b.kind) {
      case 'h1': h1(b.text); break
      case 'h2': h2(b.text); break
      case 'para': para(b.text); break
      case 'bullets': bullets(b.items); break
      case 'numbered': numbered(b.items); break
      case 'table': table(b.rows); break
      case 'code': codeBox(b.lines); break
      case 'image': image(b.caption, b.file); break
      case 'callout': callout(b.variant, b.text); break
      case 'pagebreak': doc.addPage(); break
      case 'title': break
    }
  })

  // Fill in the contents' page numbers, then the footers.
  const range = doc.bufferedPageRange()
  doc.switchToPage(range.start + tocPageIndex)
  for (const t of toc) {
    const n = chapterPage.get(t.text)
    if (n) doc.font('Helvetica').fontSize(9.6).fillColor(FAINT).text(String(n), LEFT, t.y, { width: WIDTH, align: 'right', lineBreak: false })
  }
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    doc.page.margins.bottom = 0
    const fy = PAGE_H - 40
    doc.moveTo(LEFT, fy).lineTo(RIGHT, fy).lineWidth(0.6).strokeColor(LINE).stroke()
    doc.font('Helvetica').fontSize(7.6).fillColor(FAINT)
    doc.text('CodeCompanion  ·  Training manual  ·  Internal — screenshots are synthetic demo data', LEFT, fy + 6, { width: WIDTH * 0.75, lineBreak: false })
    doc.text(`Page ${i + 1} of ${range.count}`, LEFT, fy + 6, { width: WIDTH, align: 'right', lineBreak: false })
  }
  doc.end()
  console.log('Wrote', OUT)
}

main()
