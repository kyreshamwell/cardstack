import Link from 'next/link'
import { DemoDashboard } from '@/components/DemoDashboard'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-xs font-bold text-white">CS</span>
          </div>
          <span className="text-base font-semibold tracking-tight">Cardstack</span>
        </div>
        <Link
          href="/sign-in"
          className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Built with Plaid · Supabase · Next.js 15
        </div>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Your credit cards,
          <br />
          <span className="text-slate-400">finally organized.</span>
        </h1>
        <p className="mt-6 text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
          Track balances, utilization, and due dates across every card — in one clean dashboard. Connect via Plaid or add manually.
        </p>
        <div className="mt-10 flex justify-center">
          <Link
            href="/sign-up"
            className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>

      {/* Live interactive demo — real components, mock data, no sign-up required */}
      <div className="mx-auto max-w-5xl px-8 pb-24">
        <DemoDashboard />
      </div>

      {/* Features */}
      <div className="border-t border-white/10 py-16">
        <div className="mx-auto max-w-3xl px-8 grid grid-cols-1 gap-8 sm:grid-cols-3 text-center">
          <div>
            <p className="text-2xl font-bold">Real-time sync</p>
            <p className="mt-1 text-sm text-slate-400">Plaid connects directly to your bank — balances update on demand.</p>
          </div>
          <div>
            <p className="text-2xl font-bold">Utilization tracking</p>
            <p className="mt-1 text-sm text-slate-400">Per-card and overall utilization, the #1 factor in your credit score.</p>
          </div>
          <div>
            <p className="text-2xl font-bold">Payment alerts</p>
            <p className="mt-1 text-sm text-slate-400">Due dates color-coded so you never miss a payment again.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
