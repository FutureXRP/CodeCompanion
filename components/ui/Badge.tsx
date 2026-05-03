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
