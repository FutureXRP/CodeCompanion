'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const nav = [
  { href: '/',         label: 'Dashboard',   icon: '◉' },
  { href: '/coding',   label: 'Coding',      icon: '✦' },
  { href: '/gaps',     label: 'Care Gaps',   icon: '◈' },
  { href: '/audit',    label: 'Audit Shield',icon: '⬡' },
  { href: '/schedule', label: 'Schedule',    icon: '◷' },
  { href: '/settings', label: 'Settings',    icon: '⚙' },
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
