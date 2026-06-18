import { Badge } from '@/components/ui/Badge'

// ── Palette ───────────────────────────────────────────────────
const INK   = '#16213a'
const SUB   = '#5a6473'
const FAINT = '#9aa3b2'
const LINE  = '#e9ecf2'
const GREEN = '#1a7a45'
const AMBER = '#b45309'

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  boxShadow: '0 1px 3px rgba(15,21,32,0.04)',
}

function SectionLabel({ children, meta }: { children: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
      <div style={{ height: 1, flex: 1, background: LINE }} />
      {meta && <span style={{ fontSize: 11.5, color: FAINT }}>{meta}</span>}
    </div>
  )
}

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
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #d9e0ea; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 30 }}>
        <div>
          <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
            Coding suggestions
          </h1>
          <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
            Review AI-suggested codes for each encounter. Accept, edit, or reject — your existing Athena coding workflow handles claim submission.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Badge label="3 pending review" variant="amber" />
          <Badge label="0 approved today" variant="green" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6, paddingLeft: 12, borderLeft: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 12, color: FAINT }}>Recoverable today:</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>${totalRecoverable}</span>
          </div>
        </div>
      </div>

      {/* Suggestion cards */}
      <SectionLabel meta={`${suggestions.length} suggestions`}>Pending review</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {suggestions.map(s => (
          <div key={s.id} className="pc-card" style={card}>
            {/* Card header */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{s.patient}</span>
                <span style={{ fontSize: 12, color: FAINT }}>{s.date}</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: SUB, background: '#f3f5f9', padding: '2px 7px', borderRadius: 5 }}>{s.encounterId}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: FAINT }}>Confidence: <strong style={{ color: s.confidence >= 90 ? GREEN : AMBER }}>{s.confidence}%</strong></span>
                <Badge label="pending" variant="amber" />
              </div>
            </div>

            <div style={{ padding: '18px 20px' }}>
              {/* Code comparison */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '12px 16px', background: '#f8f9fb', borderRadius: 10,
                marginBottom: 18, border: `1px solid ${LINE}`,
              }}>
                <div>
                  <p style={{ fontSize: 11, color: FAINT, margin: '0 0 5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Currently billed</p>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 500, background: '#e9ecf2', color: SUB, padding: '4px 12px', borderRadius: 6, display: 'inline-block' }}>{s.billedEm}</span>
                </div>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: FAINT, flexShrink: 0 }}>
                  <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p style={{ fontSize: 11, color: FAINT, margin: '0 0 5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI suggestion</p>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 500, background: `${GREEN}14`, color: GREEN, padding: '4px 12px', borderRadius: 6, display: 'inline-block' }}>{s.suggestedEm}</span>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: FAINT, margin: '0 0 3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue impact</p>
                  <span style={{ fontSize: 22, fontWeight: 700, color: GREEN, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.delta}</span>
                </div>
              </div>

              {/* Codes grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>ICD-10 diagnoses</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {s.icd10.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 10px', background: '#f8f9fb', borderRadius: 6 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11.5, fontWeight: 500, color: '#2d5de8', flexShrink: 0 }}>{c.code}</span>
                        <span style={{ fontSize: 12, color: SUB }}>{c.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>CPT procedure codes</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {s.cpt.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 10px', background: '#f8f9fb', borderRadius: 6 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11.5, fontWeight: 500, color: '#2d5de8', flexShrink: 0 }}>{c.code}</span>
                        <span style={{ fontSize: 12, color: SUB }}>{c.desc}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, padding: '6px 10px', background: '#f8f9fb', borderRadius: 6 }}>
                    <span style={{ fontSize: 12, color: SUB }}>MDM level: <strong style={{ color: INK }}>{s.mdmLevel}</strong></span>
                    {s.timeMinutes && <span style={{ fontSize: 12, color: SUB, marginLeft: 12 }}>Time: <strong style={{ color: INK }}>{s.timeMinutes} min</strong></span>}
                  </div>
                </div>
              </div>

              {/* AI Reasoning */}
              <div style={{
                padding: '12px 14px', background: '#f5f8ff',
                borderRadius: 10, border: `1px solid #dce6ff`, marginBottom: 12,
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#2d5de8', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  AI reasoning
                </p>
                <p style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6, margin: 0 }}>{s.reasoning}</p>
              </div>

              {/* Documentation gaps */}
              {s.gaps.length > 0 && (
                <div style={{
                  padding: '10px 14px', background: `${AMBER}09`,
                  borderRadius: 10, border: `1px solid ${AMBER}28`, marginBottom: 14,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: AMBER, margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Documentation notes</p>
                  {s.gaps.map((g, i) => (
                    <p key={i} style={{ fontSize: 12.5, color: SUB, margin: i < s.gaps.length - 1 ? '0 0 4px' : 0, lineHeight: 1.5 }}>• {g}</p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={{
                  padding: '8px 18px', background: '#2d5de8', color: '#fff',
                  fontSize: 13, fontWeight: 500, borderRadius: 8,
                  border: 'none', cursor: 'pointer', letterSpacing: '-0.01em',
                }}>
                  Accept suggestion
                </button>
                <button style={{
                  padding: '8px 18px', background: '#fff', color: INK,
                  fontSize: 13, fontWeight: 500, borderRadius: 8,
                  border: `1px solid ${LINE}`, cursor: 'pointer',
                }}>
                  Edit codes
                </button>
                <button style={{
                  padding: '8px 18px', background: '#fff', color: FAINT,
                  fontSize: 13, fontWeight: 400, borderRadius: 8,
                  border: `1px solid ${LINE}`, cursor: 'pointer',
                }}>
                  Reject
                </button>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: FAINT }}>
                  Suggestion saved for encounter {s.encounterId}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
