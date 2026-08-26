// app/(marketing)/sign-up/[[...sign-up]]/page.tsx
//
// Same catch-all pattern as sign-in: Clerk's multi-step sign-up navigates
// through sub-paths that all have to resolve here. Renders nothing for the
// same reason: the form is a panel of this group's layout, so it occupies the
// same slot as sign-in and slides in from the same side.

export const metadata = {
  title: 'Create your Cardstack account',
}

export default function SignUpPage() {
  return null
}
