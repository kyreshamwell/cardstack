// app/(dashboard)/layout.tsx — layout for all protected dashboard routes.
//
// This wraps /dashboard and any nested routes (e.g. /dashboard/cards).
// The middleware already ensures only authenticated users reach here,
// so this layout focuses purely on visual chrome: nav, max-width container, etc.
//
// We'll add a real nav component with UserButton (Clerk's account menu) once
// the auth flow is verified working.

import { UserButton } from '@clerk/nextjs'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <nav className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-semibold text-slate-900">Cardstack</span>
        {/* UserButton renders the signed-in user's avatar + sign-out menu */}
        <UserButton afterSignOutUrl="/" />
      </nav>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
