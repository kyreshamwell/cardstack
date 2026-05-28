// lib/supabase.ts — two Supabase clients with different permission levels.
//
// Why two clients?
//
//   supabase (anon key)
//     — safe to use in browser/client components
//     — respects Row Level Security (RLS) policies
//     — can only read rows where user_id matches the authenticated user
//
//   supabaseAdmin (service role key)
//     — bypasses RLS entirely — has full read/write access to all rows
//     — ONLY use in server-side code: API routes, server components, server actions
//     — NEVER import this in a client component or expose it to the browser
//     — think of it like a database superuser — powerful, must be kept server-side

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Anon client — client-safe, RLS-enforced.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client — server-side only, RLS bypassed.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
