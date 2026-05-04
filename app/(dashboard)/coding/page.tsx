import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const suggestions = [
  {
    id: 'E001', patient: 'R. Okonkwo', date: 'May 3, 2026', encounterId: 'ENC-4821',
    billedEm: '99213', suggestedEm: '99214',
    icd10: [
      { code: 'E11.9',  desc: 'Type 2 diabetes mellitus without complications' },
      { code: 'I10',    desc: 'Essential hypertension' },
      { code: 'E11.40', desc: 'T2DM with diabetic neuropathy, unspecified (new)' },
    ],
    cpt: [{ code: '99214', desc: 'Office or other outpatient visit, moderate complexity', units: 1 }],
    modifiers: [] as string[],
    confidence: 94,
    mdmLevel: 'Moderate',
    timeMinutes: 35,
    reasoning: 'The note documents a new finding of peripheral neuropathy (bilateral decreased monofilament sensation at plantar surface), which constitutes a new problem with uncertain prognosis. Combined with prescription drug management (new gabapentin, consideration of GLP-1 agent), and review of 2 chronic conditions, this meets moderate complexity MDM. The documented 35-minute total time also independently supports 99214 by time alone.',
    gaps: ['Consider explicitly stating MDM complexity in assessment section to strengthen audit defensibility'],
    delta: '+$68',
    revenue: 160,
  },
  {
    id: 'E002', patient: 'D. Patel', date: 'May 3, 2026', encounterId: 'ENC-4822',
    billedEm: '99213', suggestedEm: '99214',
    icd10: [
      { code: 'E11.65', desc: 'T2DM with hyperglycemia' },
      { code: 'I10',    desc: 'Essential hypertension' },
      { code: 'E11.40', desc: 'T2DM with diabetic neuropathy' },
    ],
    cpt: [{ code: '99214', desc: 'Office or other outpatient visit, moderate complexity', units: 1 }],
    modifiers: [] as string[],
    confidence: 91,
    mdmLevel: 'Moderate',
    timeMinutes: 35,
    reasoning: 'Uncontrolled T2DM with a new diabetic complication represents a chronic illness with exacerbation. New prescription (gabapentin) with consideration of GLP-1 agent constitutes prescription drug management meeting moderate risk. Documented 35 minutes supports 99214 by time as well.',
    gaps: [],
    delta: '+$68',
    revenue: 160,
  },
  {
    id: 'E003', patient: 'M. Castillo', date: 'May 2, 2026', encounterId: 'ENC-4819',
    billedEm: '99215', suggestedEm: 'G0439',
    icd10: [{ code: 'Z00.00', desc: 'Encounter for general adult medical examination' }],
    cpt: [{ code: 'G0439', desc: 'Annual wellness visit, includes a personalized prevention plan, subsequent visit', units: 1 }],
    modifiers: [] as string[],
    confidence: 88,
    mdmLevel: 'N/A — Preventive',
    timeMinutes: null,
    reasoning: "This encounter contains comprehensive preventive content consistent with an Annual Wellness Visit (AWV). Billing as G0439 (subsequent AWV) is more accurate than 99215 and reimbursed at $174 vs $211 — verify the patient's last AWV date to confirm G0439 vs G0438 (initial). If significant, separately identifiable acute problems were also addressed, a 99213/99214 with modifier 25 may be additionally billable.",
    gaps: ["Verify last AWV date to confirm G0439 vs G0438", "Document if any acute problems were addressed separately (enables additional E&M with modifier 25)"],
    delta: '+$174',
    revenue: 174,
  },
]

export default function CodingPage() {
  const totalRecoverable = suggestions.reduce((sum, s) => sum + parseInt(s.delta.replace(/[^0-9]/g, '')), 0)

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Coding suggestions
        </h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>
          Review AI-suggested codes for each encounter. Accept, edit, or reject — your existing Athena coding workflow handles claim submission.
        </p>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', background: '#fff', borderRadius: '10px',
        border: '1px solid #e4e8ef', marginBottom: '20px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
      }}>
        <Badge label="3 pending review" variant="amber" />
        <Badge label="0 approved today" variant="green" />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#9aa3b2' }}>Recoverable today:</span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#1a7a45' }}>${totalRecoverable}</span>
        </div>
      </div>

      {/* Suggestion cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {suggestions.map(s => (
          <Card key={s.id}>
            {/* Card header */}
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{s.patient}</span>
                <span style={{ fontSize: '12px', color: '#9aa3b2' }}>{s.date}</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#9aa3b2', background: '#f1f3f7', padding: '1px 6px', borderRadius: '4px' }}>{s.encounterId}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#9aa3b2' }}>Confidence: <strong style={{ color: s.confidence >= 90 ? '#1a7a45' : '#b45309' }}>{s.confidence}%</strong></span>
                <Badge label="pending" variant="amber" />
              </div>
            </CardHeader>

            <CardBody>
              {/* Code comparison */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '12px 16px', background: '#f8f9fb', borderRadius: '8px',
                marginBottom: '16px', border: '1px solid #f1f3f7',
              }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '0 0 5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Currently billed</p>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: '500', background: '#e4e8ef', color: '#4a5366', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>{s.billedEm}</span>
                </div>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: '#9aa3b2', flexShrink: 0 }}>
                  <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '0 0 5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI suggestion</p>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: '500', background: '#dcf4e8', color: '#1a7a45', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>{s.suggestedEm}</span>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '0 0 3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue impact</p>
                  <span style={{ fontSize: '22px', fontWeight: '700', color: '#1a7a45', letterSpacing: '-0.02em' }}>{s.delta}</span>
                </div>
              </div>

              {/* Codes grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>ICD-10 diagnoses</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {s.icd10.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '6px 10px', background: '#f8f9fb', borderRadius: '6px' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11.5px', fontWeight: '500', color: '#3b6ef8', flexShrink: 0 }}>{c.code}</span>
                        <span style={{ fontSize: '12px', color: '#4a5366' }}>{c.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>CPT procedure codes</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {s.cpt.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '6px 10px', background: '#f8f9fb', borderRadius: '6px' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11.5px', fontWeight: '500', color: '#3b6ef8', flexShrink: 0 }}>{c.code}</span>
                        <span style={{ fontSize: '12px', color: '#4a5366' }}>{c.desc}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '8px', padding: '6px 10px', background: '#f8f9fb', borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>MDM level: <strong style={{ color: '#333d4d' }}>{s.mdmLevel}</strong></span>
                    {s.timeMinutes && <span style={{ fontSize: '12px', color: '#6b7585', marginLeft: '12px' }}>Time: <strong style={{ color: '#333d4d' }}>{s.timeMinutes} min</strong></span>}
                  </div>
                </div>
              </div>

              {/* AI Reasoning */}
              <div style={{
                padding: '12px 14px', background: '#f0f4ff',
                borderRadius: '8px', border: '1px solid #dce6ff', marginBottom: '12px',
              }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#2d5de8', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  AI reasoning
                </p>
                <p style={{ fontSize: '12.5px', color: '#1e4acc', lineHeight: '1.6', margin: 0 }}>{s.reasoning}</p>
              </div>

              {/* Documentation gaps */}
              {s.gaps.length > 0 && (
                <div style={{
                  padding: '10px 14px', background: '#fffbf0',
                  borderRadius: '8px', border: '1px solid #fef3d0', marginBottom: '14px',
                }}>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#b45309', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Documentation notes</p>
                  {s.gaps.map((g, i) => (
                    <p key={i} style={{ fontSize: '12.5px', color: '#92400e', margin: i < s.gaps.length - 1 ? '0 0 4px' : 0, lineHeight: '1.5' }}>• {g}</p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button style={{
                  padding: '8px 18px', background: '#2d5de8', color: '#fff',
                  fontSize: '13px', fontWeight: '500', borderRadius: '8px',
                  border: 'none', cursor: 'pointer', letterSpacing: '-0.01em',
                }}>
                  Accept suggestion
                </button>
                <button style={{
                  padding: '8px 18px', background: '#fff', color: '#333d4d',
                  fontSize: '13px', fontWeight: '500', borderRadius: '8px',
                  border: '1px solid #e4e8ef', cursor: 'pointer',
                }}>
                  Edit codes
                </button>
                <button style={{
                  padding: '8px 18px', background: '#fff', color: '#9aa3b2',
                  fontSize: '13px', fontWeight: '400', borderRadius: '8px',
                  border: '1px solid #e4e8ef', cursor: 'pointer',
                }}>
                  Reject
                </button>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9aa3b2' }}>
                  Suggestion saved for encounter {s.encounterId}
                </span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
