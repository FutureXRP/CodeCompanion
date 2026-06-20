import { SandboxPanel } from '@/components/sandbox/SandboxPanel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INK = '#1f2d27'
const SUB = '#65726b'

export default function ClearinghousePage() {
  const configured = Boolean(process.env.STEDI_API_KEY)
  const sandbox = process.env.STEDI_SANDBOX !== 'false'

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: 0, letterSpacing: '-0.025em' }}>Clearinghouse</h1>
        <span style={{ fontSize: 11, fontWeight: 600, color: sandbox ? '#2f8a5b' : '#cf5547', background: sandbox ? '#e6f4ec' : '#fae9e6', padding: '3px 10px', borderRadius: 999 }}>
          {sandbox ? 'Sandbox' : 'Production'}
        </span>
      </div>
      <p style={{ fontSize: 13.5, color: SUB, margin: '0 0 22px', maxWidth: 640, lineHeight: 1.55 }}>
        Live trial of the submission rail: generate the synthetic sample 837, send it through the
        Stedi {sandbox ? 'sandbox' : 'production network'}, and inspect the raw response — acknowledgments,
        claim status, and 835 remittances. {sandbox ? 'Synthetic test data only; no real PHI.' : ''}
      </p>
      <SandboxPanel configured={configured} sandbox={sandbox} />
    </div>
  )
}
