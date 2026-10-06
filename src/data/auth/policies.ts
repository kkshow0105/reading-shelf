import type { Session, User } from '@supabase/supabase-js'
import type { StoredProfile } from '../remote/contracts.ts'

export type AuthState = { status: 'loading'; user: null } | { status: 'unauthenticated'; user: null }
  | { status: 'authenticated'; user: User }
export function sessionState(session: Session | null): AuthState {
  return session ? { status: 'authenticated', user: session.user } : { status: 'unauthenticated', user: null }
}
export class AccessError extends Error {
  readonly code: string
  constructor(code: string) { super('书房请求未完成。'); this.name = 'AccessError'; this.code = code }
}
export function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code
  return 'network_error'
}
export function isInvalidSession(error: unknown) {
  return ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'user_not_found', 'bad_jwt', 'invalid_jwt', 'jwt_expired'].includes(errorCode(error))
}
export function accessMessage(error: unknown): string {
  const code = errorCode(error)
  if (code === 'invalid_credentials') return '邮箱或密码不正确。'
  if (code === 'email_not_confirmed') return '这个账号尚未确认邮箱，请先在家庭账号设置中确认。'
  if (['over_request_rate_limit', 'over_email_send_rate_limit', '429'].includes(code)) return '尝试次数较多，请稍后再试。'
  if (code === 'invalid_household_name') return '请填写 1～80 字的书房名称。'
  if (code === 'invalid_profile_name') return '请为两个阅读档案填写 1～20 字的姓名。'
  if (code === 'invalid_profile_count') return '请填写两个阅读档案。'
  if (code === 'ambiguous_membership') return '账号关联了多个书房，请先核对家庭设置。'
  if (code === 'household_unavailable') return '暂时无法读取这个书房，请重试。'
  if (isInvalidSession(error) || code === 'PGRST301') return '登录已失效，请重新登录。'
  if (code === '42501') return '无法访问这个书房，请核对家庭访问设置。'
  return '暂时无法连接书房，请稍后重试。'
}
const characterCount = (value: string) => Array.from(value).length
export function bootstrapInput(householdName: string, profileNames: string[]) {
  const name = householdName.trim(), names = profileNames.map(value => value.trim())
  if (!name || characterCount(name) > 80) throw new AccessError('invalid_household_name')
  if (names.length !== 2) throw new AccessError('invalid_profile_count')
  if (names.some(value => !value || characterCount(value) > 20)) throw new AccessError('invalid_profile_name')
  return { name, names }
}
export function availableProfiles(profiles: StoredProfile[], householdId: string): StoredProfile[] {
  return profiles.filter(p => p.householdId === householdId && p.archivedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.profile.id.localeCompare(b.profile.id))
}
export function validActiveProfile(id: string | null, profiles: StoredProfile[], householdId: string) {
  return availableProfiles(profiles, householdId).find(p => p.profile.id === id)?.profile.id ?? null
}
export const ACTIVE_PROFILE_KEY = 'reading-shelf.activeProfileId'
export function readActiveProfile() { try { return localStorage.getItem(ACTIVE_PROFILE_KEY) } catch { return null } }
export function saveActiveProfile(id: string | null) {
  try { if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, id); else localStorage.removeItem(ACTIVE_PROFILE_KEY) } catch { /* Selection remains usable for this session. */ }
}
// A committed RPC with a lost response is recovered by reading server membership.
export async function recoverBootstrap<T>(call: () => Promise<unknown>, reload: () => Promise<T | null>): Promise<T> {
  try { await call() } catch (error) { if (errorCode(error) !== 'already_initialized') throw error }
  const household = await reload()
  if (!household) throw new AccessError('household_unavailable')
  return household
}
