import { EligibilityPanel } from '@/components/eligibility/EligibilityPanel'
import { ScheduleSweep } from '@/components/eligibility/ScheduleSweep'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INK = '#16213a'
const SUB = '#5a6473'

export default function EligibilityPage() {
  const configured = Boolean(process.env.STEDI_API_KEY)
  const sandbox = process.env.STEDI_SANDBOX !== 'false'
  const mode = !configured ? 'Mock' : sandbox ? 'Sandbox' : 'Production'
  const modeColor = mode === 'Production' ? '#c9302c' : mode === 'Sandbox' ? '#1a7a45' : '#92400e'
  const modeBg = mode === 'Production' ? '#fff5f5' : mode === 'Sandbox' ? '#e8f6ee' : '#fdf4e3'

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: 0, letterSpacing: '-0.025em' }}>Eligibility</h1>
        <span style={{ fontSize: 11, fontWeight: 600, color: modeColor, background: modeBg, padding: '3px 10px', borderRadius: 999 }}>{mode}</span>
      </div>
      <p style={{ fontSize: 13.5, color: SUB, margin: '0 0 22px', maxWidth: 660, lineHeight: 1.55 }}>
        Real-time insurance verification (X12 270/271) through Stedi: confirm coverage is active and see
        copay, coinsurance, deductible, and out-of-pocket before the visit. The form is pre-filled with a
        synthetic test member — replace it to check any member. Eligibility needs no payer enrollment.
      </p>
      <EligibilityPanel configured={configured} sandbox={sandbox} />

      <div style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 6px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tomorrow&apos;s schedule sweep</span>
          <div style={{ height: 1, flex: 1, background: '#e9ecf2' }} />
          <span style={{ fontSize: 11.5, color: '#9aa3b2' }}>batch-verify before the visits</span>
        </div>
        <p style={{ fontSize: 12.5, color: SUB, margin: '0 0 14px', maxWidth: 660, lineHeight: 1.5 }}>
          Verify the whole schedule ahead of time so terminated plans and unmet deductibles surface at the front desk, not as denials later.
          In production this runs overnight as a Stedi batch (up to 10k checks per request).
        </p>
        <ScheduleSweep />
      </div>
    </div>
  )
}
