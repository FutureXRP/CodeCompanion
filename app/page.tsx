import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CodeCompanion — Recover the revenue your billing leaves behind',
  description:
    'EHR-agnostic revenue recovery and RCM for independent primary care. Deterministic found-money analysis on your 837/835 — underpayments, un-appealed denials, timely-filing write-offs, undercoding.',
}

// Brand palette (matches the app shell)
const INK = '#1e2533'
const SUB = '#5a6473'
const FAINT = '#9aa3b2'
const LINE = '#e9ecf2'

const leakage = [
  {
    title: 'Underpayments',
    body: 'Paid below your contracted rate, after crediting legitimate patient responsibility. Recovered to the cent.',
    color: '#2d5de8',
  },
  {
    title: 'Un-appealed denials',
    body: 'Classified by CARC into appealable vs. true write-off, then ranked by recoverable dollars.',
    color: '#c9302c',
  },
  {
    title: 'Timely-filing write-offs',
    body: 'Claims submitted with no remittance on file — aging silently toward a permanent write-off until someone acts.',
    color: '#b45309',
  },
  {
    title: 'Undercoding',
    body: 'E/M levels your documentation may support — flagged for chart review, never silently re-coded.',
    color: '#7c3aed',
  },
]

const ladder = [
  {
    rung: 'Rung 0',
    name: 'Found Money',
    status: 'Live',
    statusColor: '#1a7a45',
    statusBg: '#e8f6ee',
    body: 'Diff what you billed (837) vs. what was paid (835) vs. your contracted rate. Contingency-priced — it pays for itself or it costs nothing.',
  },
  {
    rung: 'Rung 1',
    name: 'Full RCM, in-house',
    status: 'Building',
    statusColor: '#b45309',
    statusBg: '#fdf4e3',
    body: 'Submit claims, work denials, and post payments yourself at flat, transparent pricing — displacing the billing company that takes a cut of every dollar.',
  },
  {
    rung: 'Rung 2',
    name: 'Predictive adjudication',
    status: 'Planned',
    statusColor: '#5a6473',
    statusBg: '#f1f3f7',
    body: 'A pre-submission scrubber and point-of-care payment prediction, trained on a de-identified corpus of payer behavior.',
  },
  {
    rung: 'Rung 3',
    name: 'Instant settlement',
    status: 'Future',
    statusColor: '#5a6473',
    statusBg: '#f1f3f7',
    body: 'Advance the practice cash on day one against predicted adjudication. Fintech, not software — built only once prediction is calibrated.',
  },
]

const principles = [
  {
    title: 'Every dollar is deterministic',
    body: 'No LLM touches the math. The diff, underpayment, and denial logic are auditable and reproducible. Claude only drafts language — appeals, narratives, plain-English summaries — and never invents a number.',
  },
  {
    title: 'EHR-agnostic by design',
    body: 'Athena, EDI 837/835, FHIR — every source normalizes into one canonical model. The platform core never depends on a specific vendor, so it travels with you.',
  },
  {
    title: 'HIPAA, mock-first',
    body: 'Runs on synthetic and de-identified data until a BAA is signed. No real patient data flows until the compliance gate is deliberately closed.',
  },
]

const modules = [
  { href: '/found-money', label: 'Found Money', desc: 'Recovery worklist' },
  { href: '/claims', label: 'Claims (RCM)', desc: 'Submission lifecycle' },
  { href: '/coding', label: 'Coding', desc: 'Suggestions to approve' },
  { href: '/gaps', label: 'Care Gaps', desc: 'Open opportunities' },
  { href: '/audit', label: 'Audit Shield', desc: 'Risk monitoring' },
  { href: '/pulse', label: 'Practice Pulse', desc: 'Operational issues' },
  { href: '/schedule', label: 'Schedule', desc: 'No-show risk' },
  { href: '/analytics', label: 'Analytics', desc: 'Revenue trends' },
]

export default function LandingPage() {
  return (
    <div style={{ background: '#fff', color: INK, minHeight: '100vh' }}>
      <style>{`
        .pc-cta { transition: transform .15s ease, box-shadow .15s ease, background .15s ease; }
        .pc-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(45,93,232,.28); }
        .pc-ghost { transition: border-color .15s ease, color .15s ease, background .15s ease; }
        .pc-ghost:hover { border-color: #b9c6ee; background: #f5f8ff; }
        .pc-card { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(15,21,32,.08); border-color: #d7deea; }
        .pc-mod { transition: background .12s ease, border-color .12s ease, transform .12s ease; }
        .pc-mod:hover { background: #f5f8ff; border-color: #cdd9f6; transform: translateY(-1px); }
        .pc-link { transition: gap .12s ease; }
      `}</style>

      {/* ── Top nav ── */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'saturate(180%) blur(10px)', borderBottom: `1px solid ${LINE}`,
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(45,93,232,.32)' }}>
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M4 3l-2.5 4 2.5 4M10 3l2.5 4-2.5 4M8 1l-2 12" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>CodeCompanion</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Link href="/upload" style={{ fontSize: 13.5, fontWeight: 500, color: SUB, textDecoration: 'none' }}>Upload &amp; test</Link>
            <Link
              href="/dashboard" className="pc-cta"
              style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', padding: '8px 16px', borderRadius: 9, boxShadow: '0 4px 14px rgba(45,93,232,.22)' }}
            >
              Open the platform →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${LINE}`, background: 'radial-gradient(1100px 520px at 50% -160px, #eaf0ff 0%, rgba(234,240,255,0) 60%), #ffffff' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '76px 24px 70px', textAlign: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: '#2d5de8', background: '#eef3ff', border: '1px solid #dbe5fb', padding: '5px 12px', borderRadius: 999, letterSpacing: '0.01em' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#34d399', boxShadow: '0 0 0 3px rgba(52,211,153,.25)' }} />
            EHR-agnostic revenue intelligence for independent primary care
          </span>
          <h1 style={{ fontSize: 52, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-0.035em', margin: '22px auto 0', maxWidth: 760, color: '#16213a' }}>
            Recover the revenue your{' '}
            <span style={{ background: 'linear-gradient(120deg, #1a7a45, #16a34a)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>billing leaves behind.</span>
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.6, color: SUB, margin: '20px auto 0', maxWidth: 600 }}>
            CodeCompanion diffs what you billed against what was paid and what you were contracted —
            then surfaces every underpayment, un-appealed denial, and timely-filing write-off the rest of the industry leaves on the table.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="pc-cta" style={{ fontSize: 14.5, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', padding: '12px 24px', borderRadius: 11, boxShadow: '0 6px 18px rgba(45,93,232,.26)' }}>
              Open the platform →
            </Link>
            <Link href="/upload" className="pc-ghost" style={{ fontSize: 14.5, fontWeight: 600, color: '#2d4a7a', textDecoration: 'none', background: '#fff', border: '1px solid #d7e0f5', padding: '12px 22px', borderRadius: 11 }}>
              Upload &amp; test your claims
            </Link>
          </div>

          {/* proof strip */}
          <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0, marginTop: 46, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 4px 20px rgba(15,21,32,.05)', overflow: 'hidden' }}>
            <Proof value="$287.50" label="recovered on 4 sample claims" accent="#1a7a45" />
            <Proof value="4 leak types" label="found in one deterministic pass" />
            <Proof value="100%" label="auditable — zero LLM in the math" />
          </div>
          <p style={{ fontSize: 12, color: FAINT, marginTop: 14 }}>Figures shown are from the bundled synthetic sample — run it on your own de-identified 837/835 in seconds.</p>
        </div>
      </section>

      {/* ── What it finds ── */}
      <Section eyebrow="What it finds" title="Four kinds of money, one deterministic pass">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(232px, 1fr))', gap: 16 }}>
          {leakage.map((l) => (
            <div key={l.title} className="pc-card" style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '20px 20px 22px', boxShadow: '0 1px 3px rgba(15,21,32,.04)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${l.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color, display: 'block' }} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{l.title}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: SUB, margin: 0 }}>{l.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── The ladder ── */}
      <Section eyebrow="The ladder" title="Start with found money. Grow into the whole revenue cycle." tint>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: SUB, maxWidth: 620, margin: '-8px 0 26px' }}>
          Each rung earns the data and the trust the next one needs. You never have to bet your practice on a big-bang switch —
          the first rung runs <strong style={{ color: INK }}>alongside</strong> your current billing and risks nothing.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {ladder.map((r) => (
            <div key={r.rung} className="pc-card" style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 18px 20px', boxShadow: '0 1px 3px rgba(15,21,32,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: FAINT, fontFamily: 'DM Mono, monospace', letterSpacing: '0.02em' }}>{r.rung}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: r.statusColor, background: r.statusBg, padding: '3px 9px', borderRadius: 999 }}>{r.status}</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 7px', letterSpacing: '-0.01em' }}>{r.name}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: SUB, margin: 0 }}>{r.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Principles ── */}
      <Section eyebrow="Built to be trusted" title="The discipline behind the dollars">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {principles.map((p, i) => (
            <div key={p.title}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2d5de8', fontFamily: 'DM Mono, monospace', marginBottom: 9 }}>0{i + 1}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{p.title}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: SUB, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Modules ── */}
      <Section eyebrow="Inside the platform" title="One office, eight ways to stop the leak" tint>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="pc-mod" style={{ display: 'block', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '15px 16px', textDecoration: 'none' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: INK, margin: '0 0 2px' }}>{m.label}</p>
              <p style={{ fontSize: 12.5, color: FAINT, margin: 0 }}>{m.desc}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── CTA band ── */}
      <section style={{ padding: '8px 24px 64px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '46px 40px', textAlign: 'center', background: 'linear-gradient(135deg, #2b4fd6 0%, #1e4acc 55%, #16308f 100%)', boxShadow: '0 18px 50px rgba(30,74,204,.30)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(600px 240px at 80% -40px, rgba(255,255,255,.18), transparent 60%)' }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontSize: 28, fontWeight: 600, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>See what your billing has been leaving behind.</h2>
              <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,.82)', margin: '12px auto 0', maxWidth: 520, lineHeight: 1.6 }}>
                Drop in a de-identified 837 and 835 and get a ranked recovery worklist — with the dollar figure that proves the whole thesis.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
                <Link href="/upload" className="pc-cta" style={{ fontSize: 14.5, fontWeight: 600, color: '#1e3a8a', textDecoration: 'none', background: '#fff', padding: '12px 24px', borderRadius: 11 }}>
                  Upload &amp; test your claims →
                </Link>
                <Link href="/dashboard" style={{ fontSize: 14.5, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.32)', padding: '12px 22px', borderRadius: 11 }}>
                  Explore the dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${LINE}`, background: '#fafbfc' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 3l-2.5 4 2.5 4M10 3l2.5 4-2.5 4M8 1l-2 12" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>CodeCompanion</span>
          </div>
          <p style={{ fontSize: 12, color: FAINT, margin: 0 }}>
            Synthetic / de-identified data only · no PHI flows until the BAA gate is closed · money math is deterministic, integer cents.
          </p>
        </div>
      </footer>
    </div>
  )
}

function Proof({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div style={{ padding: '16px 22px', borderRight: `1px solid ${LINE}`, minWidth: 168 }}>
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ?? INK, margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ fontSize: 12, color: FAINT, margin: '3px 0 0' }}>{label}</p>
    </div>
  )
}

function Section({ eyebrow, title, children, tint }: { eyebrow: string; title: string; children: React.ReactNode; tint?: boolean }) {
  return (
    <section style={{ background: tint ? '#f8f9fb' : '#fff', borderBottom: `1px solid ${LINE}` }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '56px 24px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 9px' }}>{eyebrow}</p>
        <h2 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 26px', color: '#16213a', maxWidth: 620, lineHeight: 1.2 }}>{title}</h2>
        {children}
      </div>
    </section>
  )
}
