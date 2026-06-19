'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/dashboard',  label: 'Dashboard',      badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/></svg> },
  { href: '/found-money', label: 'Found Money',    badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4.3v7.4M9.9 5.9c-.3-.7-1-1.1-1.9-1.1-1 0-1.9.5-1.9 1.4 0 2 3.8 1 3.8 3.1 0 .9-.9 1.5-1.9 1.5-1 0-1.7-.4-2-1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/claims',      label: 'Claims (RCM)',   badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
  { href: '/ledger',      label: 'Patient Balances', badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5"/><circle cx="11.5" cy="9.5" r="1" fill="currentColor"/></svg> },
  { href: '/scrub',       label: 'Scrubber',        badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5.5 2.2v3.8c0 3-2.2 5.3-5.5 6.3-3.3-1-5.5-3.3-5.5-6.3V3.7L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5.7 7.8l1.7 1.7 3-3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/upload',      label: 'Upload & Test',  badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 10.5V2.5M5 5.5L8 2.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/clearinghouse', label: 'Clearinghouse', badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14.5 1.5L7 9M14.5 1.5L10 14.5 7 9 1.5 6 14.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/enrollments', label: 'Enrollments', badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5.5h6M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9.5 11l1.2 1.2L13 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/coding',     label: 'Coding',         badge: { count: 3, color: '#b45309', bg: '#fef3d0' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/gaps',       label: 'Care Gaps',      badge: { count: 8, color: '#4a5366', bg: '#f1f3f7' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/audit',      label: 'Audit Shield',   badge: { count: 2, color: '#c9302c', bg: '#ffe0e0' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  { href: '/pulse',      label: 'Practice Pulse', badge: { count: 7, color: '#c9302c', bg: '#ffe0e0' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8h2.5l2-5 2 10 2-6 1.5 3H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/analytics',  label: 'Analytics',      badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l3.5-4 3 3 3-6L15 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/corpus',     label: 'Corpus',         badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="3" cy="3.5" r="1.4" stroke="currentColor" strokeWidth="1.3"/><circle cx="13" cy="3.5" r="1.4" stroke="currentColor" strokeWidth="1.3"/><circle cx="3" cy="12.5" r="1.4" stroke="currentColor" strokeWidth="1.3"/><circle cx="13" cy="12.5" r="1.4" stroke="currentColor" strokeWidth="1.3"/><path d="M6.2 6.8L4.1 4.6M9.8 6.8l2.1-2.2M6.2 9.2L4.1 11.4M9.8 9.2l2.1 2.2" stroke="currentColor" strokeWidth="1.2"/></svg> },
  { href: '/schedule',   label: 'Schedule',       badge: { count: 2, color: '#c9302c', bg: '#ffe0e0' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/account',    label: 'Account',        badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2.5 14c0-2.8 2.5-4.6 5.5-4.6s5.5 1.8 5.5 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/settings',   label: 'Settings',       badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

export function Sidebar({ authEnabled = false, userEmail = null }: { authEnabled?: boolean; userEmail?: string | null }) {
  const pathname = usePathname()
  return (
    <aside style={{ width: '220px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e4e8ef', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f1f3f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3l-2.5 4 2.5 4M10 3l2.5 4-2.5 4M8 1l-2 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533', letterSpacing: '-0.01em' }}>CodeCompanion</span>
        </div>
        <p style={{ fontSize: '11px', color: '#9aa3b2', marginLeft: '36px', marginTop: '0' }}>Revenue Intelligence</p>
      </div>
      <nav style={{ flex: 1, padding: '10px' }}>
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '7px 10px', borderRadius: '8px',
              fontSize: '13.5px', fontWeight: active ? '500' : '400',
              color: active ? '#2d5de8' : '#4a5366',
              background: active ? '#f0f4ff' : 'transparent',
              textDecoration: 'none', marginBottom: '1px', transition: 'all 0.1s',
            }}>
              <span style={{ color: active ? '#3b6ef8' : '#9aa3b2', display: 'flex', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{ fontSize: '11px', fontWeight: '600', background: item.badge.bg, color: item.badge.color, padding: '1px 7px', borderRadius: '99px' }}>
                  {item.badge.count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '14px 16px', borderTop: '1px solid #f1f3f7' }}>
        {authEnabled && userEmail ? (
          <div>
            <Link href="/account" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', marginBottom: '8px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#dce6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#2d5de8', flexShrink: 0, textTransform: 'uppercase' }}>{userEmail.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: '#333d4d', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
                <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>View account</p>
              </div>
            </Link>
            <form action="/auth/signout" method="post" style={{ margin: 0 }}>
              <button type="submit" style={{ width: '100%', fontSize: '12px', fontWeight: '600', color: '#4a5366', background: '#f3f5f9', border: '1px solid #e4e8ef', borderRadius: '8px', padding: '7px 0', cursor: 'pointer' }}>Sign out</button>
            </form>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: '#34d399', display: 'block' }} />
            </div>
            <div>
              <p style={{ fontSize: '12.5px', fontWeight: '500', color: '#333d4d', margin: 0 }}>Demo mode</p>
              <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>synthetic data</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
