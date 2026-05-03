#!/bin/bash
# CodeCompanion — Phase 3 Polish Script
# Full design system overhaul — clean clinical aesthetic
# Run from repo root: bash setup-phase3.sh

set -e
echo "✨ Applying CodeCompanion design system..."

# ── Install Google Fonts package ─────────────────────────────
npm install next/font 2>/dev/null || true

# ── app/globals.css — full design system ─────────────────────
cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; }

:root {
  --font-sans: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'DM Mono', 'Fira Code', monospace;

  /* Neutral palette */
  --gray-0:   #ffffff;
  --gray-50:  #f8f9fb;
  --gray-100: #f1f3f7;
  --gray-200: #e4e8ef;
  --gray-300: #cdd3de;
  --gray-400: #9aa3b2;
  --gray-500: #6b7585;
  --gray-600: #4a5366;
  --gray-700: #333d4d;
  --gray-800: #1e2533;
  --gray-900: #0f1520;

  /* Brand blue — precise, trustworthy */
  --blue-50:  #f0f4ff;
  --blue-100: #dce6ff;
  --blue-200: #b8ccff;
  --blue-500: #3b6ef8;
  --blue-600: #2d5de8;
  --blue-700: #1e4acc;
  --blue-900: #0f2566;

  /* Semantic */
  --green-50:  #f0faf4;
  --green-100: #dcf4e8;
  --green-600: #1a7a45;
  --green-700: #145e35;

  --red-50:   #fff5f5;
  --red-100:  #ffe0e0;
  --red-600:  #c9302c;
  --red-700:  #a32522;

  --amber-50:  #fffbf0;
  --amber-100: #fef3d0;
  --amber-600: #b45309;
  --amber-700: #92400e;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(15,21,32,0.05);
  --shadow-md: 0 2px 8px 0 rgba(15,21,32,0.08), 0 1px 2px 0 rgba(15,21,32,0.04);
  --shadow-lg: 0 8px 24px 0 rgba(15,21,32,0.1), 0 2px 4px 0 rgba(15,21,32,0.06);

  /* Borders */
  --border: 1px solid var(--gray-200);
  --border-focus: 1px solid var(--blue-500);

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--gray-800);
  background: var(--gray-50);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--gray-300); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--gray-400); }

/* Focus */
:focus-visible { outline: 2px solid var(--blue-500); outline-offset: 2px; }

/* Table resets */
table { border-collapse: collapse; width: 100%; }
EOF
echo "✓ app/globals.css"

# ── app/layout.tsx ───────────────────────────────────────────
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeCompanion — Revenue Intelligence',
  description: 'AI-powered coding and revenue intelligence for independent primary care',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
EOF
echo "✓ app/layout.tsx"

# ── tailwind.config.ts ───────────────────────────────────────
cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dce6ff',
          500: '#3b6ef8',
          600: '#2d5de8',
          700: '#1e4acc',
          900: '#0f2566',
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(15,21,32,0.06), 0 1px 2px -1px rgba(15,21,32,0.04)',
        'card-hover': '0 4px 12px 0 rgba(15,21,32,0.10), 0 1px 3px 0 rgba(15,21,32,0.06)',
        'modal': '0 20px 60px 0 rgba(15,21,32,0.18)',
      },
    },
  },
  plugins: [],
}
export default config
EOF
echo "✓ tailwind.config.ts"

# ── components/ui/Badge.tsx ──────────────────────────────────
cat > components/ui/Badge.tsx << 'EOF'
type BadgeVariant = 'red' | 'amber' | 'green' | 'blue' | 'gray' | 'purple'

const styles: Record<BadgeVariant, string> = {
  red:    'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  amber:  'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  green:  'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  blue:   'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  gray:   'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200',
}

export function Badge({ label, variant = 'gray' }: { label: string; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${styles[variant]}`}>
      {label}
    </span>
  )
}
EOF
echo "✓ components/ui/Badge.tsx"

# ── components/ui/Card.tsx ───────────────────────────────────
cat > components/ui/Card.tsx << 'EOF'
import { clsx } from 'clsx'

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx(
      'bg-white rounded-xl border border-gray-200 shadow-card',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('px-5 py-3.5 border-b border-gray-100 flex items-center justify-between', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('px-5 py-4', className)}>
      {children}
    </div>
  )
}
EOF
echo "✓ components/ui/Card.tsx"

# ── components/ui/StatCard.tsx ───────────────────────────────
cat > components/ui/StatCard.tsx << 'EOF'
import { clsx } from 'clsx'

interface StatCardProps {
  label: string
  value: string
  delta?: string
  deltaType?: 'up' | 'down' | 'neutral'
  accent?: 'default' | 'warning' | 'danger'
}

export function StatCard({ label, value, delta, deltaType = 'neutral', accent = 'default' }: StatCardProps) {
  return (
    <div className={clsx(
      'rounded-xl p-4 border',
      accent === 'default' && 'bg-white border-gray-200 shadow-card',
      accent === 'warning' && 'bg-amber-50 border-amber-200',
      accent === 'danger'  && 'bg-red-50 border-red-200',
    )}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <p className={clsx(
        'text-[28px] font-semibold leading-none mb-1.5 tracking-tight',
        accent === 'default' && 'text-gray-900',
        accent === 'warning' && 'text-amber-700',
        accent === 'danger'  && 'text-red-700',
      )}>
        {value}
      </p>
      {delta && (
        <p className={clsx('text-xs font-medium', {
          'text-green-600': deltaType === 'up',
          'text-red-500':   deltaType === 'down',
          'text-gray-400':  deltaType === 'neutral',
        })}>
          {delta}
        </p>
      )}
    </div>
  )
}
EOF
echo "✓ components/ui/StatCard.tsx"

# ── components/layout/Sidebar.tsx ───────────────────────────
cat > components/layout/Sidebar.tsx << 'EOF'
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
EOF
echo "✓ components/layout/Sidebar.tsx"

# ── app/(dashboard)/layout.tsx ───────────────────────────────
cat > "app/(dashboard)/layout.tsx" << 'EOF'
import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fb' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/layout.tsx"

# ── app/(dashboard)/page.tsx — polished dashboard ────────────
cat > "app/(dashboard)/page.tsx" << 'EOF'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const codingFlags = [
  { patient: 'R. Okonkwo',  billed: '99213', suggested: '99214', delta: '+$68',  confidence: 94 },
  { patient: 'D. Patel',    billed: '99213', suggested: '99214', delta: '+$68',  confidence: 91 },
  { patient: 'M. Castillo', billed: '99215', suggested: 'G0439', delta: '+$174', confidence: 88 },
]

const careGaps = [
  { patient: 'M. Castillo', type: 'Annual Wellness Visit', code: 'G0439', revenue: '$174',     priority: 'high'   as const },
  { patient: 'R. Okonkwo',  type: 'CCM Enrollment',       code: '99490', revenue: '+$62/mo',  priority: 'high'   as const },
  { patient: 'D. Patel',    type: 'HbA1c overdue',        code: 'lab',   revenue: 'recall',   priority: 'medium' as const },
  { patient: '4 patients',  type: 'Depression screening', code: 'G0444', revenue: '$44 each', priority: 'medium' as const },
]

const scheduleRisks = [
  { time: '10:00a', patient: 'B. Nwosu',     risk: 82, level: 'high'  as const },
  { time: '11:30a', patient: 'T. Larsson',   risk: 71, level: 'amber' as const },
  { time: '2:00p',  patient: 'F. Adeola',    risk: 22, level: 'low'   as const },
  { time: '3:15p',  patient: 'C. Dimitriou', risk: 15, level: 'low'   as const },
]

const riskTrack = { high: '#f87171', amber: '#fbbf24', low: '#34d399' }
const riskBadge = { high: 'red', amber: 'amber', low: 'green' } as const

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: 0, letterSpacing: '-0.02em' }}>
          Good morning, Dr. Blair
        </h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: '4px 0 0' }}>
          {today} &nbsp;·&nbsp; 6 patients scheduled &nbsp;·&nbsp;
          <span style={{ color: '#34d399' }}>●</span> Last synced 6:02am
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Est. revenue today" value="$2,840" delta="↑ $310 vs avg" deltaType="up" />
        <StatCard label="Coding leakage" value="$480" delta="3 encounters flagged" deltaType="down" accent="warning" />
        <StatCard label="Care gaps open" value="14" delta="$2,100 recoverable" deltaType="neutral" />
        <StatCard label="No-show risk" value="2 slots" delta="High confidence" deltaType="down" accent="danger" />
      </div>

      {/* Two column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Coding suggestions */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533' }}>Coding suggestions</span>
            <Badge label="3 pending" variant="amber" />
          </CardHeader>
          <CardBody className="p-0">
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f3f7' }}>
                  {['Patient', 'Billed', 'Suggested', 'Delta'].map((h, i) => (
                    <th key={h} style={{
                      padding: '9px 16px', textAlign: i === 3 ? 'right' : 'left',
                      fontSize: '11px', fontWeight: '600', color: '#9aa3b2',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codingFlags.map((f, i) => (
                  <tr key={i} style={{ borderBottom: i < 2 ? '1px solid #f8f9fb' : 'none' }}>
                    <td style={{ padding: '11px 16px', fontWeight: '500', color: '#1e2533' }}>{f.patient}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#f1f3f7', color: '#4a5366', padding: '2px 8px', borderRadius: '4px' }}>{f.billed}</span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#f0faf4', color: '#1a7a45', padding: '2px 8px', borderRadius: '4px' }}>{f.suggested}</span>
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '600', color: '#1a7a45' }}>{f.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f3f7' }}>
              <a href="/coding" style={{ fontSize: '12px', color: '#3b6ef8', textDecoration: 'none', fontWeight: '500' }}>
                Review &amp; approve all →
              </a>
            </div>
          </CardBody>
        </Card>

        {/* Schedule risk */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533' }}>Schedule risk — today</span>
            <Badge label="2 high risk" variant="red" />
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {scheduleRisks.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#9aa3b2', width: '44px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{s.time}</span>
                  <span style={{ fontSize: '13px', color: '#333d4d', flex: 1 }}>{s.patient}</span>
                  <div style={{ width: '80px', height: '4px', background: '#f1f3f7', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: riskTrack[s.level], borderRadius: '2px', width: `${s.risk}%`, transition: 'width 0.6s ease' }} />
                  </div>
                  <Badge label={`${s.risk}%`} variant={riskBadge[s.level]} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Care gaps */}
      <Card style={{ marginBottom: '16px' }}>
        <CardHeader>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533' }}>Care gap opportunities</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#1a7a45' }}>$2,100–$3,400 recoverable</span>
            <Badge label="14 patients" variant="blue" />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <table style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f3f7' }}>
                {['Patient', 'Gap', 'Code', 'Revenue', 'Priority'].map(h => (
                  <th key={h} style={{
                    padding: '9px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: '600', color: '#9aa3b2',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {careGaps.map((g, i) => (
                <tr key={i} style={{ borderBottom: i < careGaps.length - 1 ? '1px solid #f8f9fb' : 'none' }}>
                  <td style={{ padding: '11px 16px', fontWeight: '500', color: '#1e2533' }}>{g.patient}</td>
                  <td style={{ padding: '11px 16px', color: '#4a5366' }}>{g.type}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#f1f3f7', color: '#4a5366', padding: '2px 8px', borderRadius: '4px' }}>{g.code}</span>
                  </td>
                  <td style={{ padding: '11px 16px', fontWeight: '600', color: '#1a7a45' }}>{g.revenue}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <Badge label={g.priority} variant={g.priority === 'high' ? 'red' : 'amber'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f3f7' }}>
            <a href="/gaps" style={{ fontSize: '12px', color: '#3b6ef8', textDecoration: 'none', fontWeight: '500' }}>View all care gaps →</a>
          </div>
        </CardBody>
      </Card>

      {/* Audit alert */}
      <div style={{
        background: '#fff5f5', border: '1px solid #ffe0e0',
        borderRadius: '12px', padding: '14px 18px',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
          <path d="M9 1L1 16h16L9 1z" stroke="#c9302c" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M9 7v4M9 13.5v.5" stroke="#c9302c" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#c9302c', margin: '0 0 3px' }}>Audit shield — 2 active flags</p>
          <p style={{ fontSize: '12px', color: '#a32522', margin: 0, lineHeight: '1.5' }}>
            Your 99215 rate (31%) exceeds the RAC watch threshold (25%). 2 encounter notes are missing explicit MDM documentation.
          </p>
          <a href="/audit" style={{ fontSize: '12px', color: '#c9302c', fontWeight: '500', textDecoration: 'underline', display: 'inline-block', marginTop: '6px' }}>
            Review audit risks →
          </a>
        </div>
      </div>

    </div>
  )
}
EOF
echo "✓ app/(dashboard)/page.tsx"

# ── app/(dashboard)/coding/page.tsx — polished ───────────────
cat > "app/(dashboard)/coding/page.tsx" << 'EOF'
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
          Review AI-suggested codes before claims go out. Approve or edit each encounter.
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
                  Approve &amp; push to Athena
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
                  Will push to Athena encounter {s.encounterId}
                </span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/coding/page.tsx"

echo ""
echo "✅ Phase 3 polish complete!"
echo ""
echo "The dev server will auto-reload. Refresh your browser."
echo "Commit when happy: git add . && git commit -m 'Phase 3: design system polish'"