import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeCompanion',
  description: 'AI-powered coding and revenue intelligence for primary care',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
