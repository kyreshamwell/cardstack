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
    <ClerkProvider
      appearance={{
        variables: {
          // These CSS variables override Clerk's default design tokens.
          // Change these to match whatever brand direction you want.
          colorPrimary: '#0f172a',        // buttons, active states (slate-900)
          colorBackground: '#ffffff',     // card/modal background
          colorInputBackground: '#f8fafc', // input fields (slate-50)
          colorText: '#0f172a',           // body text
          borderRadius: '0.5rem',         // rounded corners on inputs + buttons
          fontFamily: 'inherit',          // use whatever font the rest of the app uses
        },
        elements: {
          // Target individual Clerk elements with custom Tailwind-style classes.
          // Full list of element keys: https://clerk.com/docs/customization/elements
          card: 'shadow-lg border border-slate-100',
          formButtonPrimary: 'bg-slate-900 hover:bg-slate-700 text-sm',
          footerActionLink: 'text-slate-900 hover:text-slate-600',
        },
      }}
    >
      <html lang="en">
        <body className="bg-white text-slate-900 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
