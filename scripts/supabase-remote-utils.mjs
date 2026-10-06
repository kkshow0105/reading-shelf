// CLI owns login credentials. Key output is captured in memory, never printed/saved.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export const PROJECT_REF = 'agtkrlpiixniouipwdxr'
export const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`
export function check(value, label) { if (!value) throw new Error(`Verification failed: ${label}`) }
export function cli(args) {
  check(readFileSync('supabase/.temp/project-ref', 'utf8').trim() === PROJECT_REF, 'linked ref')
  check(args.every(arg => !/["\r\n&|<>]/.test(arg)), 'CLI arguments')
  // Invoke the exact official npm bin entry, without a shell or credential arguments.
  const result = spawnSync(process.execPath, [join(process.cwd(), 'node_modules/supabase/dist/supabase.js'), ...args],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 90000, windowsHide: true })
  if (result.status !== 0) {
    const error = new Error(`Official CLI ${args.slice(0, 2).join(' ')} failed; raw output suppressed`)
    const diagnostic = String(result.stderr) + String(result.stdout)
    error.sqlState = (diagnostic.match(/SQLSTATE\s+([A-Z0-9]{5})/) || [])[1]
    error.pgCodes = ['23503', '23514', '42501', '42601', 'P0001', '42883', '42703', '42702', '22003', '22P02'].filter(code => diagnostic.includes(code))
    error.failureKinds = ['ambiguous', 'syntax error', 'permission denied', 'foreign key', 'check constraint', 'does not exist', 'timed out'].filter(kind => diagnostic.toLowerCase().includes(kind))
    error.constraints = ['books_deleted_by_fkey', 'profiles_household_id_fkey', 'books_household_id_profile_id_fkey', 'household_members_user_id_fkey'].filter(name => diagnostic.includes(name))
    error.failureLabel = ['deleted_actor_fk_set_null_failed', 'invalid_rating_accepted', 'invalid_status_accepted',
      'invalid_position_x_accepted', 'invalid_position_y_accepted', 'empty_title_accepted', 'empty_author_accepted',
      'empty_household_accepted', 'invalid_profile_fk_accepted', 'duplicate_membership_accepted', 'timestamp_trigger_failed']
      .find(label => diagnostic.includes(label))
    throw error
  }
  return result.stdout
}
export function jsonArray(output) {
  // Human "Initialising login role" goes to stderr; tolerate a prefixed notice.
  const start = output.search(/\[\s*(?:\{|\])/)
  const end = output.lastIndexOf(']')
  check(start >= 0 && end >= start, 'CLI JSON array')
  return JSON.parse(output.slice(start, end + 1))
}
export function query(sql) {
  const path = join(tmpdir(), `reading-shelf-query-${randomUUID()}.sql`)
  writeFileSync(path, sql, { encoding: 'utf8', mode: 0o600 })
  try {
    return jsonArray(cli(['db', 'query', '--linked', '--project-ref', PROJECT_REF, '--file', path, '--output', 'json', '--agent', 'no', '--output-format', 'text']))
  } finally { if (existsSync(path)) unlinkSync(path) }
}
export function projectKeys() {
  const keys = jsonArray(cli(['projects', 'api-keys', '--project-ref', PROJECT_REF, '--reveal', '--output', 'json', '--agent', 'no', '--output-format', 'text']))
  const publishable = keys.find(key => key.type === 'publishable')
  const admin = keys.find(key => key.type === 'secret') || keys.find(key => key.name === 'service_role')
  const publishableKey = publishable?.api_key || publishable?.key
  const adminKey = admin?.api_key || admin?.key
  check(typeof publishableKey === 'string' && publishableKey.startsWith('sb_publishable_'), 'project publishable key')
  check(typeof adminKey === 'string' && (adminKey.startsWith('sb_secret_') || adminKey.startsWith('eyJ')), 'project administrator key')
  return { publishableKey, adminKey }
}
