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
