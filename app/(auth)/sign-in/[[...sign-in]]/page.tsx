// app/(auth)/sign-in/[[...sign-in]]/page.tsx
//
// Why [[...sign-in]]?
//   Clerk's <SignIn /> component handles multi-step flows internally,
//   but it uses sub-paths (e.g. /sign-in/factor-one, /sign-in/sso-callback).
//   The double-bracket catch-all route lets Next.js serve all of those
//   from this single file instead of requiring a page for each step.
//
// Why (auth)?
//   Route groups (parentheses) create layout boundaries without affecting URLs.
//   This page is at /sign-in, not /auth/sign-in.

import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignIn />
    </div>
  )
}
