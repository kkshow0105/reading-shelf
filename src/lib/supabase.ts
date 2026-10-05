import { createClient } from '@supabase/supabase-js'
import { readSupabaseConfig } from './supabase-config.ts'

let client: ReturnType<typeof createClient> | undefined
// Lazy by design: frozen mock UI never creates a client or requires .env.local.
// Generated Database generic is added only after real database introspection.
export function getSupabaseClient() {
  if (!client) {
    const { url, key } = readSupabaseConfig({ VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY })
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    })
  }
  return client
}
