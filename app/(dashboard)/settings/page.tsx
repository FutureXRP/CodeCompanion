import { Badge } from '@/components/ui/Badge'

const sections = [
  {
    title: 'Athena EHR connection',
    items: [
      { label: 'Connection status', value: 'Mock data (dev mode)', badge: { label: 'Not connected', variant: 'amber' as const } },
      { label: 'Practice ID', value: 'Pending Athena credentials', badge: null },
      { label: 'Last sync', value: 'N/A', badge: null },
      { label: 'API version', value: 'FHIR R4 + Proprietary', badge: null },
    ],
    action: { label: 'Connect Athena', color: '#2d5de8', bg: '#f0f4ff', border: '#dce6ff' },
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
    action: { label: 'Manage billing', color: '#4a5366', bg: '#f8f9fb', border: '#e4e8ef' },
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
    action: { label: 'Sign BAAs', color: '#c9302c', bg: '#fff5f5', border: '#ffe0e0' },
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
    <div style={{ padding: '28px 32px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>Practice configuration, integrations, and compliance.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {sections.map((section, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f3f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{section.title}</span>
              {section.action && (
                <button style={{
                  padding: '6px 14px', fontSize: '12.5px', fontWeight: '500',
                  background: section.action.bg, color: section.action.color,
                  border: `1px solid ${section.action.border}`, borderRadius: '8px', cursor: 'pointer',
                }}>
                  {section.action.label}
                </button>
              )}
            </div>
            <div style={{ padding: '4px 0' }}>
              {section.items.map((item, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: j < section.items.length - 1 ? '1px solid #f8f9fb' : 'none' }}>
                  <span style={{ fontSize: '13px', color: '#6b7585' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#333d4d', fontWeight: '500' }}>{item.value}</span>
                    {item.badge && <Badge label={item.badge.label} variant={item.badge.variant} />}
                  </div>
                </div>
              ))}
            </div>
            {section.note && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f3f7', background: '#f8f9fb' }}>
                <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{section.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
