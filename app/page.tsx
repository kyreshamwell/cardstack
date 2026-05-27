// app/page.tsx — the public landing page at "/".
//
// For now this is a minimal placeholder. Unauthenticated users land here;
// authenticated users can click through to the dashboard.
// We'll flesh this out (or replace it with a redirect) once auth is confirmed working.

import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Cardstack
        </h1>
        <p className="mt-3 text-lg text-slate-500">
          Your credit card command center.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/sign-in"
          className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-lg border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
        >
          Sign up
        </Link>
      </div>
    </main>
  )
}
