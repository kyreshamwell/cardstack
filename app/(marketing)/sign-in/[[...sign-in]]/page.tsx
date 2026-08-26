// app/(marketing)/sign-in/[[...sign-in]]/page.tsx
//
// Why [[...sign-in]]?
//   Clerk's <SignIn /> handles multi-step flows internally using sub-paths
//   (/sign-in/factor-one, /sign-in/sso-callback…). The double-bracket
//   catch-all serves all of them from this one file.
//
// Why (marketing)?
//   So sign-in shares the filmstrip with the pitch and the demo, and arriving
//   here slides rather than loads. The form itself is a panel in that group's
//   layout (see MarketingFrame), which is why this file renders nothing.

export const metadata = {
  title: 'Sign in to Cardstack',
}

export default function SignInPage() {
  return null
}
