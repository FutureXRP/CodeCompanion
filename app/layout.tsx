import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PracticeCompanion — Revenue Intelligence',
  description: 'AI-powered revenue intelligence and practice management for independent primary care',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
