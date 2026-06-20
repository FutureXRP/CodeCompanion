import { pullClaims, adjudicate } from '@/lib/mock-ehr'
import { buildLedger, buildStatement } from '@/lib/ledger'
import { BillingPanel, type BillingAccount } from '@/components/billing/BillingPanel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INK = '#1f2d27'
const FAINT = '#9aa69f'

export default function BillingPage() {
  const claims = pullClaims()
  const remittances = adjudicate(claims)
  const ledger = buildLedger({ claims, remittances })

  const accounts: BillingAccount[] = ledger.accounts
    .filter((a) => a.balance.patientArCents > 0)
    .map((a) => {
      const statement = buildStatement(a)
      return {
        accountKey: a.accountKey,
        patientName: a.patientName,
        payerName: a.payerName,
        patientArCents: a.balance.patientArCents,
        standing: a.standing,
        lines: statement.lines
          .filter((l) => l.patientRespCents > 0)
          .map((l) => ({
            cptHcpcs: l.cptHcpcs,
            dateOfService: l.dateOfService,
            chargedCents: l.chargedCents,
            insurancePaidCents: l.insurancePaidCents,
            adjustedCents: l.adjustedCents,
            patientRespCents: l.patientRespCents,
          })),
      }
    })

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: 0, letterSpacing: '-0.025em' }}>Patient Billing</h1>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1a7a45', background: '#e8f6ee', padding: '3px 10px', borderRadius: 999 }}>Mock payments</span>
      </div>
      <p style={{ fontSize: 13.5, color: FAINT, margin: '0 0 22px', maxWidth: 660, lineHeight: 1.55 }}>
        The patient side of the ledger: statements derived from the 835, and payments recorded against the balance.
        This closes the patient-A/R loop that A/R &amp; Denials surfaces.
      </p>
      <BillingPanel accounts={accounts} totalPatientArCents={ledger.totals.patientArCents} />
    </div>
  )
}
