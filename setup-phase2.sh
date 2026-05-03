#!/bin/bash
# CodeCompanion — Phase 2 Setup Script
# Builds the full app shell, dashboard layout, and coding suggestion UI
# Run from the root of your CodeCompanion repo

set -e
echo "🏗️  Building Phase 2 — App Shell + Dashboard UI..."

# ── app/layout.tsx (no Clerk for now) ───────────────────────
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeCompanion',
  description: 'AI-powered coding and revenue intelligence for primary care',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
EOF
echo "✓ app/layout.tsx"

# ── app/globals.css ──────────────────────────────────────────
cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  body { margin: 0; }
}
EOF
echo "✓ app/globals.css"

# ── components/ui/Badge.tsx ──────────────────────────────────
cat > components/ui/Badge.tsx << 'EOF'
import { clsx } from 'clsx'

type BadgeVariant = 'red' | 'amber' | 'green' | 'blue' | 'gray' | 'purple'

const variants: Record<BadgeVariant, string> = {
  red:    'bg-red-50 text-red-700 ring-red-600/20',
  amber:  'bg-amber-50 text-amber-700 ring-amber-600/20',
  green:  'bg-green-50 text-green-700 ring-green-600/20',
  blue:   'bg-blue-50 text-blue-700 ring-blue-600/20',
  gray:   'bg-gray-50 text-gray-600 ring-gray-500/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
}

export function Badge({ label, variant = 'gray' }: { label: string; variant?: BadgeVariant }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
      variants[variant]
    )}>
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
    <div className={clsx('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('px-5 py-4 border-b border-gray-100', className)}>
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
}

export function StatCard({ label, value, delta, deltaType = 'neutral' }: StatCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {delta && (
        <p className={clsx('text-xs mt-1', {
          'text-green-600': deltaType === 'up',
          'text-red-600': deltaType === 'down',
          'text-gray-500': deltaType === 'neutral',
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
  { href: '/',          label: 'Dashboard',      icon: '◉' },
  { href: '/coding',    label: 'Coding',          icon: '✦' },
  { href: '/gaps',      label: 'Care Gaps',       icon: '◈' },
  { href: '/audit',     label: 'Audit Shield',    icon: '⬡' },
  { href: '/schedule',  label: 'Schedule',        icon: '◷' },
  { href: '/settings',  label: 'Settings',        icon: '⚙' },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-base font-semibold text-blue-600 tracking-tight">CodeCompanion</span>
        <p className="text-xs text-gray-400 mt-0.5">Revenue Intelligence</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === item.href
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">Dr. Blair's Practice</p>
        <p className="text-xs text-gray-300 mt-0.5">Professional Plan</p>
      </div>
    </aside>
  )
}
EOF
echo "✓ components/layout/Sidebar.tsx"

# ── app/(dashboard)/layout.tsx ───────────────────────────────
mkdir -p "app/(dashboard)"
cat > "app/(dashboard)/layout.tsx" << 'EOF'
import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/layout.tsx"

# ── app/(dashboard)/page.tsx — Morning Dashboard ─────────────
cat > "app/(dashboard)/page.tsx" << 'EOF'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const codingFlags = [
  { patient: 'R. Okonkwo', billed: '99213', suggested: '99214', delta: '+$68', confidence: 94 },
  { patient: 'D. Patel',   billed: '99213', suggested: '99214', delta: '+$68', confidence: 91 },
  { patient: 'M. Castillo', billed: '99215', suggested: 'G0439', delta: '+$174', confidence: 88 },
]

const careGaps = [
  { patient: 'M. Castillo', type: 'Annual Wellness Visit', code: 'G0439', revenue: '$174', priority: 'high' as const },
  { patient: 'R. Okonkwo',  type: 'CCM Enrollment',       code: '99490',  revenue: '$62/mo', priority: 'high' as const },
  { patient: 'D. Patel',    type: 'HbA1c overdue',        code: 'lab',    revenue: 'recall', priority: 'medium' as const },
  { patient: '4 patients',  type: 'Depression screening', code: 'G0444',  revenue: '$44 each', priority: 'medium' as const },
]

const scheduleRisks = [
  { time: '10:00a', patient: 'B. Nwosu',    risk: 82, level: 'high' as const },
  { time: '11:30a', patient: 'T. Larsson',  risk: 71, level: 'amber' as const },
  { time: '2:00p',  patient: 'F. Adeola',   risk: 22, level: 'low' as const },
  { time: '3:15p',  patient: 'C. Dimitriou', risk: 15, level: 'low' as const },
]

const riskColor = { high: 'bg-red-400', amber: 'bg-amber-400', low: 'bg-green-400' }
const riskBadge = { high: 'red', amber: 'amber', low: 'green' } as const

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Good morning</h1>
        <p className="text-sm text-gray-500 mt-0.5">{today} · 6 patients scheduled · Last synced 6:02am</p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Est. revenue today" value="$2,840" delta="+$310 vs avg" deltaType="up" />
        <StatCard label="Coding leakage" value="$480" delta="3 encounters flagged" deltaType="down" />
        <StatCard label="Care gaps open" value="14" delta="$2,100 recoverable" deltaType="neutral" />
        <StatCard label="No-show risk" value="2 slots" delta="High confidence" deltaType="down" />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Coding flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Coding suggestions</h2>
              <Badge label="3 pending" variant="amber" />
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Patient</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Billed</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Suggested</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Delta</th>
                </tr>
              </thead>
              <tbody>
                {codingFlags.map((f, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                    <td className="px-5 py-3 font-medium text-gray-900">{f.patient}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{f.billed}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">{f.suggested}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-green-600">{f.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3">
              <a href="/coding" className="text-xs text-blue-600 hover:underline">Review all → </a>
            </div>
          </CardBody>
        </Card>

        {/* Schedule risk */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Schedule risk — today</h2>
              <Badge label="2 high risk" variant="red" />
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {scheduleRisks.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-12 shrink-0">{s.time}</span>
                <span className="text-sm text-gray-700 flex-1">{s.patient}</span>
                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${riskColor[s.level]}`} style={{ width: `${s.risk}%` }} />
                </div>
                <Badge label={`${s.risk}%`} variant={riskBadge[s.level]} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Care gaps */}
      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Care gap opportunities</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-green-600">$2,100–$3,400 recoverable this month</span>
              <Badge label="14 patients" variant="blue" />
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Patient</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Gap</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Code</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Revenue</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Priority</th>
              </tr>
            </thead>
            <tbody>
              {careGaps.map((g, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{g.patient}</td>
                  <td className="px-5 py-3 text-gray-600">{g.type}</td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{g.code}</span>
                  </td>
                  <td className="px-5 py-3 font-medium text-green-600">{g.revenue}</td>
                  <td className="px-5 py-3">
                    <Badge
                      label={g.priority}
                      variant={g.priority === 'high' ? 'red' : g.priority === 'medium' ? 'amber' : 'gray'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3">
            <a href="/gaps" className="text-xs text-blue-600 hover:underline">View all care gaps →</a>
          </div>
        </CardBody>
      </Card>

      {/* Audit alert */}
      <Card className="border-red-100 bg-red-50/30">
        <CardBody>
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Audit shield — 2 active flags</p>
              <p className="text-xs text-red-600 mt-0.5">Your 99215 rate (31%) exceeds the RAC threshold (25%). 2 encounter notes missing MDM documentation.</p>
              <a href="/audit" className="text-xs text-red-600 underline mt-1 inline-block">Review audit risks →</a>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/page.tsx"

# ── app/(dashboard)/coding/page.tsx ─────────────────────────
mkdir -p "app/(dashboard)/coding"
cat > "app/(dashboard)/coding/page.tsx" << 'EOF'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const suggestions = [
  {
    id: 'E001', patient: 'R. Okonkwo', date: 'May 3, 2026',
    billedEm: '99213', suggestedEm: '99214',
    icd10: ['E11.9 — Type 2 diabetes', 'I10 — Hypertension', 'E11.40 — Diabetic neuropathy (new)'],
    cpt: ['99214 — Office visit, moderate complexity'],
    modifiers: [],
    confidence: 94,
    reasoning: 'The note documents a new finding of peripheral neuropathy (bilateral decreased monofilament sensation), which constitutes a new problem with uncertain prognosis. Combined with management of 2 chronic conditions and a new prescription (gabapentin), this meets moderate complexity MDM. The documented 35-minute total time also independently supports 99214.',
    delta: '+$68',
    status: 'pending',
  },
  {
    id: 'E002', patient: 'D. Patel', date: 'May 3, 2026',
    billedEm: '99213', suggestedEm: '99214',
    icd10: ['E11.65 — T2DM with hyperglycemia', 'I10 — Hypertension', 'E11.40 — Diabetic neuropathy'],
    cpt: ['99214 — Office visit, moderate complexity'],
    modifiers: [],
    confidence: 91,
    reasoning: 'Patient presents with uncontrolled T2DM (HbA1c likely elevated based on home readings) plus a new diabetic complication. Prescription drug management with gabapentin and consideration of GLP-1 agent meets moderate complexity risk. Documented 35 minutes supports 99214 by time as well.',
    delta: '+$68',
    status: 'pending',
  },
  {
    id: 'E003', patient: 'M. Castillo', date: 'May 2, 2026',
    billedEm: '99215', suggestedEm: 'G0439',
    icd10: ['Z00.00 — Annual wellness visit'],
    cpt: ['G0439 — Annual wellness visit, subsequent'],
    modifiers: [],
    confidence: 88,
    reasoning: 'This encounter appears to be an Annual Wellness Visit based on the comprehensive preventive content documented. Billing as G0439 (AWV subsequent year) rather than 99215 is both more accurate and more reimbursable. Note: verify the patient\'s last AWV date to confirm G0439 vs G0438.',
    delta: '+$174',
    status: 'pending',
  },
]

export default function CodingPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Coding suggestions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review AI-suggested codes for today's encounters. Approve or edit before claims go out.</p>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <Badge label="3 pending review" variant="amber" />
        <Badge label="0 approved today" variant="green" />
        <span className="text-xs text-gray-400 ml-auto">Est. recoverable: <strong className="text-green-600">$310</strong></span>
      </div>

      <div className="space-y-4">
        {suggestions.map(s => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-900">{s.patient}</span>
                  <span className="text-xs text-gray-400 ml-2">{s.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Confidence: <strong className="text-gray-700">{s.confidence}%</strong></span>
                  <Badge label="pending" variant="amber" />
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {/* Code comparison */}
              <div className="flex items-center gap-6 mb-4 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Currently billed</p>
                  <span className="font-mono text-sm bg-gray-200 text-gray-700 px-2.5 py-1 rounded">{s.billedEm}</span>
                </div>
                <span className="text-gray-300 text-lg">→</span>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Suggested</p>
                  <span className="font-mono text-sm bg-green-100 text-green-700 px-2.5 py-1 rounded">{s.suggestedEm}</span>
                </div>
                <div className="ml-auto">
                  <p className="text-xs text-gray-400 mb-1">Revenue impact</p>
                  <span className="text-lg font-semibold text-green-600">{s.delta}</span>
                </div>
              </div>

              {/* Suggested codes */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">ICD-10 diagnoses</p>
                  <ul className="space-y-1">
                    {s.icd10.map((code, i) => (
                      <li key={i} className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">{code}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">CPT procedures</p>
                  <ul className="space-y-1">
                    {s.cpt.map((code, i) => (
                      <li key={i} className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">{code}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Claude's reasoning */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-medium text-blue-700 mb-1">AI reasoning</p>
                <p className="text-xs text-blue-800 leading-relaxed">{s.reasoning}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Approve & push to Athena
                </button>
                <button className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  Edit codes
                </button>
                <button className="px-4 py-2 bg-white text-gray-500 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  Reject
                </button>
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

# ── app/(dashboard)/gaps/page.tsx ────────────────────────────
mkdir -p "app/(dashboard)/gaps"
cat > "app/(dashboard)/gaps/page.tsx" << 'EOF'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function GapsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Care gap scanner</h1>
        <p className="text-sm text-gray-500 mt-0.5">Revenue opportunities and quality gaps across your patient panel.</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Open gaps</h2>
            <Badge label="14 patients" variant="blue" />
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500">Care gap detail view — coming in Phase 3.</p>
        </CardBody>
      </Card>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/gaps/page.tsx"

# ── app/(dashboard)/audit/page.tsx ───────────────────────────
mkdir -p "app/(dashboard)/audit"
cat > "app/(dashboard)/audit/page.tsx" << 'EOF'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function AuditPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Audit shield</h1>
        <p className="text-sm text-gray-500 mt-0.5">RAC and OIG risk scoring across your billing patterns.</p>
      </div>
      <Card className="border-red-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Active risks</h2>
            <Badge label="2 high" variant="red" />
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500">Audit risk detail view — coming in Phase 3.</p>
        </CardBody>
      </Card>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/audit/page.tsx"

# ── app/(dashboard)/schedule/page.tsx ────────────────────────
mkdir -p "app/(dashboard)/schedule"
cat > "app/(dashboard)/schedule/page.tsx" << 'EOF'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function SchedulePage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Schedule risk</h1>
        <p className="text-sm text-gray-500 mt-0.5">No-show predictions for today's appointments.</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Today's schedule</h2>
            <Badge label="2 high risk" variant="red" />
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500">Schedule detail view — coming in Phase 3.</p>
        </CardBody>
      </Card>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/schedule/page.tsx"

# ── app/(dashboard)/settings/page.tsx ────────────────────────
mkdir -p "app/(dashboard)/settings"
cat > "app/(dashboard)/settings/page.tsx" << 'EOF'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Practice configuration and integrations.</p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Athena EHR connection</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Status</p>
              <p className="text-xs text-gray-400 mt-0.5">Connect your Athena practice to enable live data sync</p>
            </div>
            <Badge label="Mock data" variant="amber" />
          </div>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Connect Athena
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Subscription</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Professional Plan</p>
              <p className="text-xs text-gray-400 mt-0.5">All modules including Audit Shield</p>
            </div>
            <Badge label="Active" variant="green" />
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/settings/page.tsx"

# ── Remove old root page if exists ───────────────────────────
rm -f app/page.tsx

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "✅ Phase 2 complete!"
echo ""
echo "Next steps:"
echo "  1. npm run dev"
echo "  2. Open in browser — you should see the full dashboard"
echo "  3. Click through the sidebar navigation"
echo ""
echo "Come back to chat for Phase 3 — live data + Supabase integration"