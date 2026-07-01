'use client'

import { useUser, UserButton } from '@clerk/nextjs'

export function NavUserButton() {
  const { user } = useUser()

  const firstName = user?.firstName ?? 'Account'
  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="nav-user-pill relative inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors pl-1 pr-3 py-1 cursor-pointer select-none">
      {/* Initials avatar */}
      <div className="h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 pointer-events-none">
        <span className="text-xs font-semibold text-white">{initials}</span>
      </div>

      {/* First name — hidden on small screens */}
      <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-200 pointer-events-none">
        {firstName}
      </span>

      {/* Chevron */}
      <svg
        className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>

      {/* Invisible Clerk UserButton covering the full pill — handles clicks + popover */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <UserButton fallbackRedirectUrl="/" />
      </div>
    </div>
  )
}
