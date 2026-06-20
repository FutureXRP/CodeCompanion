import { Badge } from '@/components/ui/Badge'
import { formatCents } from '@/lib/canonical'
import { aggregate } from '@/lib/corpus'
import { sampleObservations } from '@/lib/corpus/sample'
import { corpusPredictor, estimateEncounter, MODEL_ID, type PlannedEncounter, type PredictionBasis } from '@/lib/predict'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASIS: Record<PredictionBasis, { label: string; variant: 'green' | 'amber' | 'gray' }> = {
  corpus_exact: { label: 'exact', variant: 'green' },
  corpus_fallback: { label: 'fallback', variant: 'amber' },
  insufficient_data: { label: 'no data', variant: 'gray' },
}

const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9aa69f',
  textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 12px', borderBottom: '1px solid #ece7dd',
}
const td: React.CSSProperties = {
  fontSize: 13, color: '#3a4640', padding: '10px 12px', borderBottom: '1px solid #f0ece3',
}
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

const ENCOUNTERS: { title: string; enc: PlannedEncounter }[] = [
  { title: 'Commercial · 00840', enc: { payerExternalId: '00840', region: 'OK', specialty: 'family_medicine', contractClass: 'commercial', lines: [{ cptHcpcs: '99214' }, { cptHcpcs: '36415' }] } },
  { title: 'Medicare · 04312', enc: { payerExternalId: '04312', region: 'OK', specialty: 'family_medicine', contractClass: 'medicare', lines: [{ cptHcpcs: '99214' }, { cptHcpcs: '36415' }] } },
  { title: 'Unknown payer · 99999', enc: { payerExternalId: '99999', region: 'OK', specialty: 'family_medicine', contractClass: 'commercial', lines: [{ cptHcpcs: '99214' }] } },
]

export default function PredictPage() {
  const predictor = corpusPredictor(aggregate(sampleObservations()).rows)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1060, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Predictive Adjudication</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 740, lineHeight: 1.5 }}>
          The Rung 2 read-model over the corpus: what a payer will likely allow and pay for a planned encounter, and how often it
          denies the code. Two uses, one model — a point-of-care estimate and a pre-submission denial-risk signal.
        </p>
      </div>

      <div style={{ background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 12, padding: '13px 16px', margin: '16px 0 20px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>Stub · uncalibrated baseline ({MODEL_ID})</div>
        <div style={{ fontSize: 12.5, color: '#7a5212', lineHeight: 1.6 }}>
          This is the empirical median from the corpus, not a trained model — the seam where a calibrated model drops in. It
          returns nothing when the corpus lacks data for a cell (no guessing), and never claims calibration it doesn&apos;t have.
          A real model is trained only once live adjudications are flowing.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ENCOUNTERS.map(({ title, enc }) => {
          const est = estimateEncounter(enc, predictor)
          return (
            <div key={title} style={{ background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2d27' }}>{title}</span>
                <span style={{ fontSize: 12, color: '#9aa69f' }}>
                  est. allowed {formatCents(est.estimatedAllowedCents)} · paid {formatCents(est.estimatedPaidCents)} ·{' '}
                  {est.maxDenialRisk !== null ? `${Math.round(est.maxDenialRisk * 100)}% max denial` : 'denial n/a'} ·{' '}
                  {est.linesWithData > 0 ? `conf ${Math.round(est.confidence * 100)}%` : 'no data'}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>CPT</th>
                    <th style={th}>Basis</th>
                    <th style={{ ...th, ...num }}>Pred. allowed</th>
                    <th style={{ ...th, ...num }}>Pred. paid</th>
                    <th style={{ ...th, ...num }}>Denial risk</th>
                    <th style={{ ...th, ...num }}>Days</th>
                    <th style={{ ...th, ...num }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {est.lines.map((l, i) => {
                    const p = l.prediction
                    const dash = <span style={{ color: '#c0c6d0' }}>—</span>
                    return (
                      <tr key={i}>
                        <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{l.cptHcpcs}</td>
                        <td style={td}><Badge label={BASIS[p.basis].label} variant={BASIS[p.basis].variant} /></td>
                        <td style={{ ...td, ...num }}>{p.predictedAllowedCents !== null ? formatCents(p.predictedAllowedCents) : dash}</td>
                        <td style={{ ...td, ...num }}>{p.predictedPaidCents !== null ? formatCents(p.predictedPaidCents) : dash}</td>
                        <td style={{ ...td, ...num }}>{p.denialRisk !== null ? `${Math.round(p.denialRisk * 100)}%` : dash}</td>
                        <td style={{ ...td, ...num, color: '#6b7280' }}>{p.expectedDaysToPay !== null ? `${p.expectedDaysToPay}d` : dash}</td>
                        <td style={{ ...td, ...num, color: '#9aa69f' }}>{p.basis !== 'insufficient_data' ? `${Math.round(p.confidence * 100)}%` : dash}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 12, color: '#9aa69f', marginTop: 16, lineHeight: 1.55 }}>
        Synthetic corpus. Patient responsibility is intentionally not estimated here — that needs eligibility (270/271) plus a
        patient-responsibility statistic in the corpus, neither of which we guess. The predictor is the pre-submission scrubber&apos;s
        denial-risk signal and the point-of-care estimate that Rung 3 would eventually underwrite against — once it is calibrated.
      </p>
    </div>
  )
}
