import type { SupabaseClient, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Database } from '../remote/database.types.ts'
import { AccessError, bootstrapInput, recoverBootstrap, availableProfiles, isInvalidSession } from './policies.ts'
import { createRepositories } from '../remote/repositories.ts'
import type { StoredProfile } from '../remote/contracts.ts'

export interface HouseholdAccess { id: string; name: string; profiles: StoredProfile[] }
function fail(error: { code?: string; message?: string } | null) {
  if (error) throw new AccessError(error.message === 'already_initialized' ? 'already_initialized' : error.code || 'network_error')
}
export function createAuthService(client: SupabaseClient<Database>) {
  return {
    async signInWithPassword(email: string, password: string) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      fail(error); return data.session
    },
    async signOut() { const { error } = await client.auth.signOut({ scope: 'local' }); fail(error) },
    async getCurrentSession() { const { data, error } = await client.auth.getSession(); fail(error); return data.session },
    async getCurrentUser() { const { data, error } = await client.auth.getUser(); fail(error); return data.user },
    onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
      return client.auth.onAuthStateChange(callback).data.subscription
    },
    async restore() {
      const { data, error } = await client.auth.getSession()
      if (error) { if (isInvalidSession(error)) { await client.auth.signOut({ scope: 'local' }); return null }; fail(error) }
      if (!data.session) return null
      const result = await client.auth.getUser()
      if (result.error) {
        if (isInvalidSession(result.error) || result.error.status === 401 || result.error.status === 403) {
          await client.auth.signOut({ scope: 'local' }); return null
        }
        fail(result.error) // Network failure keeps the SDK's stored session intact.
      }
      return data.session
    },
  }
}
export function createHouseholdService(client: SupabaseClient<Database>) {
  async function load(userId: string): Promise<HouseholdAccess | null> {
    const members = await client.from('household_members').select('household_id').eq('user_id', userId)
    fail(members.error)
    if (!members.data?.length) return null
    if (members.data.length !== 1) throw new AccessError('ambiguous_membership')
    const id = members.data[0].household_id
    const result = await client.from('households').select('id,name').eq('id', id).single()
    fail(result.error)
    if (!result.data) throw new AccessError('household_unavailable')
    const profiles = await createRepositories(client, id).profiles.listProfiles()
    return { ...result.data, profiles: availableProfiles(profiles, id) }
  }
  return {
    load,
    async bootstrap(userId: string, name: string, names: string[]) {
      const input = bootstrapInput(name, names)
      return recoverBootstrap(async () => {
        const { error } = await client.rpc('bootstrap_household', { p_household_name: input.name, p_profile_names: input.names })
        fail(error)
      }, () => load(userId))
    },
  }
}
