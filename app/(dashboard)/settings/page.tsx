import { Badge } from '@/components/ui/Badge'

// ── Palette ───────────────────────────────────────────────────
const INK   = '#1f2d27'
const SUB   = '#65726b'
const FAINT = '#9aa69f'
const LINE  = '#ece7dd'
const GREEN = '#2f8a5b'
const AMBER = '#b8862a'

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  boxShadow: '0 1px 3px rgba(15,21,32,0.04)',
}

function SectionLabel({ children, meta }: { children: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#3f7d6a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
      <div style={{ height: 1, flex: 1, background: LINE }} />
      {meta && <span style={{ fontSize: 11.5, color: FAINT }}>{meta}</span>}
    </div>
  )
}

// Section icon tiles — matched to section accent
const sectionIcons: Record<string, { icon: React.ReactNode; accent: string }> = {
  'Athena EHR connection': {
    accent: '#3f7d6a',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  'Subscription': {
    accent: GREEN,
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M11 4H6.5a2.5 2.5 0 000 5h3a2.5 2.5 0 010 5H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  'HIPAA & compliance': {
    accent: AMBER,
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  },
  'AI configuration': {
    accent: '#7c3aed',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2a6 6 0 100 12A6 6 0 008 2zM8 6v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
}

const sections = [
  {
    title: 'Athena EHR connection',
    items: [
      { label: 'Connection status', value: 'Mock data (dev mode)', badge: { label: 'Not connected', variant: 'amber' as const } },
      { label: 'Practice ID', value: 'Pending Athena credentials', badge: null },
      { label: 'Last sync', value: 'N/A', badge: null },
      { label: 'API version', value: 'FHIR R4 + Proprietary', badge: null },
    ],
    action: { label: 'Connect Athena', color: '#3f7d6a', bg: '#eef3f0', border: '#e6efe9' },
    note: 'Register at docs.athenahealth.com for developer credentials. Sandbox access is immediate.',
  },
  {
    title: 'Subscription',
    items: [
      { label: 'Current plan', value: 'Professional', badge: { label: 'Active', variant: 'green' as const } },
      { label: 'Billing', value: '$599 / month', badge: null },
      { label: 'Next renewal', value: 'June 3, 2026', badge: null },
      { label: 'Modules', value: 'All 5 modules enabled', badge: null },
    ],
    action: { label: 'Manage billing', color: SUB, bg: '#f7f5f0', border: LINE },
    note: null,
  },
  {
    title: 'HIPAA & compliance',
    items: [
      { label: 'Supabase BAA', value: 'Required before production', badge: { label: 'Pending', variant: 'amber' as const } },
      { label: 'Anthropic BAA', value: 'Required for coding module', badge: { label: 'Pending', variant: 'amber' as const } },
      { label: 'Data storage', value: 'Derived signals only — no raw PHI', badge: { label: 'Compliant', variant: 'green' as const } },
      { label: 'Encryption', value: 'At rest + in transit', badge: { label: 'Active', variant: 'green' as const } },
    ],
    action: { label: 'Sign BAAs', color: AMBER, bg: `${AMBER}09`, border: `${AMBER}28` },
    note: 'Sign both BAAs before going live with real patient data.',
  },
  {
    title: 'AI configuration',
    items: [
      { label: 'Model', value: 'claude-sonnet-4-20250514', badge: null },
      { label: 'Cost per encounter', value: '~$0.008', badge: { label: 'Estimated', variant: 'gray' as const } },
      { label: 'Monthly AI cost', value: '~$8 at current volume', badge: null },
      { label: 'Note retention', value: 'Zero — notes never stored', badge: { label: 'HIPAA safe', variant: 'green' as const } },
    ],
    action: null,
    note: null,
  },
]

export default function SettingsPage() {
  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #ddd6c8; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>Settings</h1>
        <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>Practice configuration, integrations, and compliance.</p>
      </div>

      <SectionLabel>Configuration</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((section, i) => {
          const iconMeta = sectionIcons[section.title]
          return (
            <div key={i} className="pc-card" style={card}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {iconMeta && (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${iconMeta.accent}14`, color: iconMeta.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {iconMeta.icon}
                    </div>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{section.title}</span>
                </div>
                {section.action && (
                  <button style={{
                    padding: '6px 14px', fontSize: 12.5, fontWeight: 500,
                    background: section.action.bg, color: section.action.color,
                    border: `1px solid ${section.action.border}`, borderRadius: 8, cursor: 'pointer',
                  }}>
                    {section.action.label}
                  </button>
                )}
              </div>
              <div style={{ padding: '4px 0' }}>
                {section.items.map((item, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: j < section.items.length - 1 ? `1px solid #f7f5f0` : 'none' }}>
                    <span style={{ fontSize: 13, color: SUB }}>{item.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{item.value}</span>
                      {item.badge && <Badge label={item.badge.label} variant={item.badge.variant} />}
                    </div>
                  </div>
                ))}
              </div>
              {section.note && (
                <div style={{ padding: '10px 20px', borderTop: `1px solid ${LINE}`, background: '#f7f5f0' }}>
                  <p style={{ fontSize: 12, color: FAINT, margin: 0 }}>{section.note}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
