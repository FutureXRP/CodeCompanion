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
