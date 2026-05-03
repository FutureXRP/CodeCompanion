import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const codingFlags = [
  { patient: 'R. Okonkwo',  billed: '99213', suggested: '99214', delta: '+$68' },
  { patient: 'D. Patel',    billed: '99213', suggested: '99214', delta: '+$68' },
  { patient: 'M. Castillo', billed: '99215', suggested: 'G0439', delta: '+$174' },
]

const careGaps = [
  { patient: 'M. Castillo', type: 'Annual Wellness Visit', code: 'G0439', revenue: '$174',    priority: 'high' as const },
  { patient: 'R. Okonkwo',  type: 'CCM Enrollment',       code: '99490', revenue: '$62/mo',  priority: 'high' as const },
  { patient: 'D. Patel',    type: 'HbA1c overdue',        code: 'lab',   revenue: 'recall',  priority: 'medium' as const },
  { patient: '4 patients',  type: 'Depression screening', code: 'G0444', revenue: '$44 each',priority: 'medium' as const },
]

const scheduleRisks = [
  { time: '10:00a', patient: 'B. Nwosu',     risk: 82, level: 'high' as const },
  { time: '11:30a', patient: 'T. Larsson',   risk: 71, level: 'amber' as const },
  { time: '2:00p',  patient: 'F. Adeola',    risk: 22, level: 'low' as const },
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
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Est. revenue today" value="$2,840" delta="+$310 vs avg" deltaType="up" />
        <StatCard label="Coding leakage" value="$480" delta="3 encounters flagged" deltaType="down" />
        <StatCard label="Care gaps open" value="14" delta="$2,100 recoverable" deltaType="neutral" />
        <StatCard label="No-show risk" value="2 slots" delta="High confidence" deltaType="down" />
      </div>
      <div className="grid grid-cols-2 gap-5 mb-5">
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
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{f.patient}</td>
                    <td className="px-3 py-3"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{f.billed}</span></td>
                    <td className="px-3 py-3"><span className="font-mono text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">{f.suggested}</span></td>
                    <td className="px-5 py-3 text-right font-medium text-green-600">{f.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3"><a href="/coding" className="text-xs text-blue-600 hover:underline">Review all →</a></div>
          </CardBody>
        </Card>
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
      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Care gap opportunities</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-green-600">$2,100–$3,400 recoverable</span>
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
                  <td className="px-5 py-3"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{g.code}</span></td>
                  <td className="px-5 py-3 font-medium text-green-600">{g.revenue}</td>
                  <td className="px-5 py-3">
                    <Badge label={g.priority} variant={g.priority === 'high' ? 'red' : g.priority === 'medium' ? 'amber' : 'gray'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3"><a href="/gaps" className="text-xs text-blue-600 hover:underline">View all care gaps →</a></div>
        </CardBody>
      </Card>
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
