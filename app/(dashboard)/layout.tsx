// app/(dashboard)/layout.tsx: chrome for every signed-in route.
//
// Deliberately thin. The frame itself lives in AppShell so the public demo
// wears the identical thing rather than a copy that drifts; all this layout
// decides is what goes in the right-hand nav slot: for the signed-in app,
// the account button.
//
import { AppShell } from '@/components/dashboard/AppShell'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { PrivacyToggle } from '@/components/cards/PrivacyToggle'
import { NavUserButton } from '@/components/NavUserButton'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navRight={
        <>
          <DarkModeToggle />
          <PrivacyToggle />
          <NavUserButton />
        </>
      }
    >
      {children}
    </AppShell>
  )
}
