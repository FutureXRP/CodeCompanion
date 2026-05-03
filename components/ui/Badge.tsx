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
