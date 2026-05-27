// app/layout.tsx — the root layout.
//
// In Next.js App Router, every page is nested inside layout files.
// This is the outermost one — it wraps the entire app.
//
// ClerkProvider must live here (not in individual layouts) so the auth
// context is available everywhere, including the dashboard and API routes.

import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cardstack',
  description: 'Your credit card command center.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-white text-slate-900 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
