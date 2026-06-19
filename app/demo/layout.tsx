import Link from 'next/link'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center">
            <span className="text-xs font-bold text-white">CS</span>
          </div>
          <span className="text-base font-semibold text-slate-900 tracking-tight">Cardstack</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400 hidden sm:block">Demo mode</span>
          <Link
            href="/sign-in"
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </nav>

      {/* Demo banner */}
      <div className="bg-slate-900 text-white px-6 py-2.5 text-center text-sm">
        You&apos;re viewing a demo with sample data.{' '}
        <Link href="/sign-in" className="underline underline-offset-2 font-medium hover:text-slate-300 transition-colors">
          Sign in to connect your real cards →
        </Link>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
