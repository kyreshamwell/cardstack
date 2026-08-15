'use client'
// app/sso-callback/page.tsx — where Google and Apple send the browser back to.
//
// OAuth is the one flow that leaves the site entirely: the browser goes to
// Google, the user approves, and Google redirects back here with a code in the
// URL. `AuthenticateWithRedirectCallback` completes the handshake and forwards
// on to the dashboard.
//
// This route exists because the auth panel runs `routing="virtual"`. Virtual
// routing keeps Clerk's multi-step state in memory rather than in the URL,
// which is what lets the form live permanently in the marketing layout — but
// it means Clerk has no path of its own to return into. So the return address
// has to be a real page, and this is it.
//
// Deliberately OUTSIDE the (marketing) route group: that group renders the
// three-panel filmstrip, and this is a transient screen nobody should see for
// more than a moment. It gets a plain centred spinner instead.

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

export default function SSOCallback() {
  return (
    <div className="grid h-dvh place-items-center bg-ground text-ink">
      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink"
        />
        <p className="text-sm text-ink-2">Signing you in…</p>
      </div>

      {/*
        Renders nothing. It reads the OAuth response out of the URL, finishes
        the sign-in, and navigates on — the spinner above is the entire visible
        state of this page.
      */}
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </div>
  )
}
