import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../data/remote/database.types.ts'
import { readSupabaseConfig } from './supabase-config.ts'

let client: SupabaseClient<Database> | undefined
// Lazy by design: frozen mock UI never creates a client or requires .env.local.
export function getSupabaseClient() {
  if (!client) {
    const { url, key } = readSupabaseConfig({ VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY })
    client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    })
  }
  return client
}
