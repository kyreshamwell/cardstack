// app/layout.tsx: the root layout.
//
// In Next.js App Router, every page is nested inside layout files.
// This is the outermost one, and it wraps the entire app.
//
// ClerkProvider must live here (not in individual layouts) so the auth
// context is available everywhere, including the dashboard and API routes.

import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  // Single tag. DarkModeToggle updates it via JS so it tracks the in-app
  // toggle rather than the OS preference (our dark mode is class-based)
  themeColor: '#ffffff',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Cardstack',
  description: 'Your credit card command center.',
  manifest: '/manifest.webmanifest',
  // Lets iOS open the installed app standalone (no Safari chrome) and use
  // "Cardstack" as the home-screen label instead of the page title.
  appleWebApp: {
    capable: true,
    title: 'Cardstack',
    statusBarStyle: 'default',
  },
}

// No Clerk `appearance` prop here on purpose.
//
// This used to carry a slate palette (`card: 'shadow-lg border
// border-slate-100'`, `colorBackground: '#ffffff'`, and friends) left over
// from before the redesign. Two problems with it:
//
//   1. It rendered a bordered, shadowed card INSIDE the card AuthPanel draws,
//      so every auth form had a second white box sitting a pixel or two proud
//      of the fields. That was the pale edge down the left of the inputs.
//   2. `variables` take concrete hex colours, so the form was pinned to the
//      light theme no matter what the rest of the app was doing.
//
// Clerk is themed in globals.css against its stable `cl-*` classes instead,
// which resolve our CSS custom properties and therefore follow dark mode.
// Anything added back here overrides that, so don't.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      // `localization`, not `appearance`. This is copy, not styling, so it
      // doesn't reintroduce the global override problem described above.
      //
      // With a single provider Clerk labels the button "Continue with Google";
      // with two or more it falls back to just the provider name. "Apple" on
      // its own reads as a label rather than an action, so the long form is
      // restored explicitly.
      // Both keys: Clerk uses `socialButtonsBlockButton` when one provider is
      // shown and `...ManyInView` when several are, and only the first has the
      // long form by default. Setting just the one leaves the labels reading
      // "Apple" and "Google" the moment a second provider is enabled.
      localization={{
        socialButtonsBlockButton: 'Continue with {{provider|titleize}}',
        socialButtonsBlockButtonManyInView: 'Continue with {{provider|titleize}}',
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          {/*
            Runs before first paint, deliberately blocking.
            DarkModeToggle applies the theme in an effect, which is too late.
            The browser has already painted a white page, so anyone on a dark
            device got a white flash on every single load. This reads the same
            two sources the toggle does (saved choice first, device preference
            otherwise) and stamps the class on <html> before anything renders.
            suppressHydrationWarning above is required because this mutates the
            element React is about to hydrate.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`,
            }}
          />
        </head>
        {/* Tokens, not fixed colours. The old bg-white/text-slate-900 pair
            left a white page behind the app in dark mode. */}
        <body className={`${inter.className} bg-ground text-ink antialiased`}>
          {children}
          {/* Both last inside <body> so neither delays rendering the page
              they measure. Analytics reports page views and traffic;
              SpeedInsights reports real-user Core Web Vitals. Each only
              collects on a Vercel deployment, so both are inert locally. */}
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  )
}
