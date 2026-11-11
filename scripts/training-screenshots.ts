/**
 * Screenshots for the training manual, taken from a running app on the mock
 * (synthetic) data — no PHI. Start the app first:
 *
 *   npm run build && node .next/standalone/server.js      # or: npm run dev
 *   npm run training:shots -- --base=http://localhost:3000 --out=docs/training
 *
 * Needs Playwright with Chromium (npm i -D playwright && npx playwright install
 * chromium). Applies the Tebra preset in Admin first — cookie-scoped to the
 * screenshot browser — so the sidebar shows the loop the manual describes, then
 * captures each page at 1280×900, 2× scale (or one card of it, for long pages).
 */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

interface Shot {
  file: string
  route: string
  /** Capture only the card whose title is this text (for pages that carry more than the manual needs). */
  clipTo?: string
}

const SHOTS: Shot[] = [
  { file: 'frontdesk', route: '/frontdesk' },
  { file: 'review', route: '/review' },
  { file: 'found-money', route: '/found-money' },
  { file: 'workbench', route: '/workbench' },
  { file: 'tasks', route: '/tasks' },
  { file: 'scorecard', route: '/scorecard' },
  { file: 'ehr', route: '/ehr', clipTo: 'Tebra — charges + ERA pull' },
  { file: 'admin', route: '/admin' },
]

// The slice of Playwright's API this script uses, typed locally so the project
// does not need Playwright installed to type-check.
interface Locator {
  locator(selector: string): Locator
  screenshot(opts: { path: string }): Promise<unknown>
}
interface Page {
  goto(url: string, opts?: { waitUntil?: 'networkidle' | 'load' }): Promise<unknown>
  screenshot(opts: { path: string; fullPage?: boolean }): Promise<unknown>
  getByText(text: string, opts?: { exact?: boolean }): Locator
}
interface Context {
  request: { post(url: string, opts: { data: unknown }): Promise<{ ok(): boolean; status(): number }> }
  newPage(): Promise<Page>
}
interface Browser {
  newContext(opts: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<Context>
  close(): Promise<void>
}
interface Playwright {
  chromium: { launch(): Promise<Browser> }
}

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

async function main(): Promise<void> {
  const base = arg('base', 'http://localhost:3000').replace(/\/$/, '')
  const out = arg('out', path.join('docs', 'training'))
  mkdirSync(out, { recursive: true })

  let pw: Playwright
  try {
    pw = createRequire(path.join(process.cwd(), 'package.json'))('playwright') as Playwright
  } catch {
    throw new Error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium')
  }

  const browser = await pw.chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
    const preset = await context.request.post(`${base}/api/admin/flags`, { data: { preset: 'tebra' } })
    if (!preset.ok()) throw new Error(`Could not apply the Tebra preset: HTTP ${preset.status()} — is the app running at ${base}?`)
    const page = await context.newPage()
    for (const s of SHOTS) {
      await page.goto(`${base}${s.route}`, { waitUntil: 'networkidle' })
      const file = path.join(out, `${s.file}.png`)
      if (s.clipTo) {
        // The nearest rounded card around the title — the panel, not the whole page.
        const card = page.getByText(s.clipTo, { exact: true }).locator('xpath=ancestor::div[contains(@style,"border-radius")][1]')
        await card.screenshot({ path: file })
      } else {
        await page.screenshot({ path: file })
      }
      console.log(`  ${s.route.padEnd(14)} → ${file}`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
