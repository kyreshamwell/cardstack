// app/(auth)/sign-up/[[...sign-up]]/page.tsx
//
// Same catch-all pattern as sign-in — Clerk's multi-step sign-up flow
// navigates through sub-paths that all need to resolve to this component.

import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignUp />
    </div>
  )
}
