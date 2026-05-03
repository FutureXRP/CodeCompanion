'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const nav = [
  { href: '/',         label: 'Dashboard',    icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/></svg>
  )},
  { href: '/coding',   label: 'Coding',       icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  { href: '/gaps',     label: 'Care Gaps',    icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  )},
  { href: '/audit',    label: 'Audit Shield', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
  )},
  { href: '/schedule', label: 'Schedule',     icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  )},
  { href: '/settings', label: 'Settings',     icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  )},
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside style={{
      width: '220px',
      flexShrink: 0,
      background: '#fff',
      borderRight: '1px solid #e4e8ef',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f1f3f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 3l-2.5 4 2.5 4M10 3l2.5 4-2.5 4M8 1l-2 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533', letterSpacing: '-0.01em' }}>CodeCompanion</span>
        </div>
        <p style={{ fontSize: '11px', color: '#9aa3b2', marginLeft: '36px', marginTop: '0' }}>Revenue Intelligence</p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px' }}>
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: active ? '500' : '400',
                color: active ? '#2d5de8' : '#4a5366',
                background: active ? '#f0f4ff' : 'transparent',
                textDecoration: 'none',
                marginBottom: '1px',
                transition: 'all 0.1s',
              }}
            >
              <span style={{ color: active ? '#3b6ef8' : '#9aa3b2', display: 'flex' }}>{item.icon}</span>
              {item.label}
              {item.href === '/coding' && (
                <span style={{
                  marginLeft: 'auto', fontSize: '11px', fontWeight: '600',
                  background: '#fef3d0', color: '#b45309',
                  padding: '1px 7px', borderRadius: '99px',
                }}>3</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Practice info */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f3f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: '#dce6ff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#2d5de8',
          }}>B</div>
          <div>
            <p style={{ fontSize: '12.5px', fontWeight: '500', color: '#333d4d', margin: 0 }}>Dr. Blair</p>
            <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>Professional Plan</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
