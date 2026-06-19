import Link from 'next/link'

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
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/demo"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
          >
            View demo
          </Link>
          <Link
            href="/sign-in"
            className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </div>

      {/* Card preview */}
      <div className="mx-auto max-w-5xl px-8 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1 - Cap One */}
          <MockCard
            bank="Capital One"
            name="Quicksilver"
            mask="4823"
            balance="$1,240.00"
            available="$3,760.00"
            limit="$5,000.00"
            utilization={25}
            utilizationColor="emerald"
            dueLabel="Due Jun 24"
            dueBadge="due-soon"
            minPayment="$35.00"
          />
          {/* Card 2 - Chase */}
          <MockCard
            bank="Chase"
            name="Sapphire Preferred"
            mask="9141"
            balance="$3,400.00"
            available="$5,100.00"
            limit="$8,500.00"
            utilization={40}
            utilizationColor="yellow"
            dueLabel="Due Jul 15"
            dueBadge="upcoming"
            minPayment="$85.00"
          />
          {/* Card 3 - Amazon */}
          <MockCard
            bank="Synchrony Bank"
            name="Amazon Prime Card"
            mask="2267"
            balance="$290.00"
            available="$1,710.00"
            limit="$2,000.00"
            utilization={15}
            utilizationColor="emerald"
            dueLabel="Due Jul 22"
            dueBadge="upcoming"
            minPayment="$25.00"
          />
        </div>
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

// ── Static mock card — purely visual, no interactivity ──────────────────────
type BadgeType = 'due-soon' | 'upcoming'
type UtilizationColor = 'emerald' | 'yellow' | 'red'

function MockCard({
  bank, name, mask, balance, available, limit,
  utilization, utilizationColor, dueLabel, dueBadge, minPayment,
}: {
  bank: string
  name: string
  mask: string
  balance: string
  available: string
  limit: string
  utilization: number
  utilizationColor: UtilizationColor
  dueLabel: string
  dueBadge: BadgeType
  minPayment: string
}) {
  const barColor = {
    emerald: 'bg-emerald-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400',
  }[utilizationColor]

  const utilColor = {
    emerald: 'text-emerald-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
  }[utilizationColor]

  const badgeStyle = {
    'due-soon': 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
    upcoming: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
  }[dueBadge]

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border border-white/10">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 pt-5 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">{bank}</p>
            <p className="mt-0.5 text-base font-semibold text-white">{name}</p>
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Current balance</p>
          <p className="mt-1 text-3xl font-bold text-white tabular-nums">{balance}</p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="font-mono text-sm tracking-widest text-slate-400">•••• {mask}</p>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeStyle}`}>
            {dueLabel}
          </span>
        </div>
        <div className="mt-4 h-1 w-full rounded-full bg-white/10">
          <div
            className={`h-1 rounded-full ${barColor}`}
            style={{ width: `${utilization}%` }}
          />
        </div>
      </div>
      <div className="bg-white px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Available</span>
          <span className="text-sm font-semibold text-slate-900">{available}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Credit limit</span>
          <span className="text-sm font-semibold text-slate-900">{limit}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Utilization</span>
          <span className={`text-sm font-semibold ${utilColor}`}>{utilization}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Min. payment</span>
          <span className="text-sm font-semibold text-slate-900">{minPayment}</span>
        </div>
      </div>
    </div>
  )
}
