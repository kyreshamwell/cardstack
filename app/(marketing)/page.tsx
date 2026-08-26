// app/(marketing)/page.tsx: the pitch.
//
// Renders nothing: the hero is a panel of the filmstrip in this group's
// layout, which is what lets it slide to the demo without unmounting. This
// file exists to own `/` and to keep signed-in visitors out of the marketing
// page entirely.

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return null
}
