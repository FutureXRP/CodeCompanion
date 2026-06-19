import { EligibilityPanel } from '@/components/eligibility/EligibilityPanel'

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
    </div>
  )
}
