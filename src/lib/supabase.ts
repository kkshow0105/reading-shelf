import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../data/remote/database.types.ts'
import { readSupabaseConfig } from './supabase-config.ts'

let client: SupabaseClient<Database> | undefined
// One browser client; the SDK owns session storage and token refresh.
export function getSupabaseClient() {
  if (!client) {
    const { url, key } = readSupabaseConfig({ VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY })
    client = createClient<Database>(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      }) },
    })
  }
  return client
}
