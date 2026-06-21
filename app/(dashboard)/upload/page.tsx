import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AnalyzePanel } from '@/components/found-money/AnalyzePanel'
import { TestConsole } from '@/components/test/TestConsole'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function read(relativePath: string): string {
  try {
    return readFileSync(join(process.cwd(), relativePath), 'utf8')
  } catch {
    return ''
  }
}

export default function UploadPage() {
  const initial837 = read('lib/adapters/edi/samples/claim_837_sample.edi')
  const initial835 = read('lib/adapters/edi/samples/remit_835_sample.edi')
  const initialCsv = read('lib/adapters/fee-schedule/sample_fee_schedule.csv')

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <TestConsole />
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Upload &amp; Test your own files</h1>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>
        Drop in your own 837 (claims), 835 (remittance), and fee schedule to run the full pipeline on your data —
        the found-money worklist (Rung 0) and each claim&apos;s paid/denied lifecycle (Rung 1). Prefilled with the
        sample files, so you can click <strong>Analyze</strong> now and then swap in your own.
      </p>
      <AnalyzePanel initial837={initial837} initial835={initial835} initialCsv={initialCsv} />
    </div>
  )
}
