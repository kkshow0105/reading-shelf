// Only for actual UI QA with a disposable account. Credentials are process-memory only.
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'node:http'
import { randomUUID, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { PROJECT_URL, projectKeys, check, query } from './supabase-remote-utils.mjs'
const ledger = 'qa/household-ui-ledger.json'
const { adminKey } = projectKeys()
const admin = createClient(PROJECT_URL, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
try {
  if (process.argv[2] === 'serve') {
    check(!existsSync(ledger), 'no unfinished UI fixture')
    const excludedHouseholdIds = query('select id from public.households;').map(row => row.id)
    const email = `reading-shelf-ui-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url')
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    check(!error && data.user?.id, 'disposable UI Auth user')
    mkdirSync('qa', { recursive: true }); writeFileSync(ledger, JSON.stringify({ userId: data.user.id, excludedHouseholdIds }))
    // One-use loopback pipe into the browser QA controller's MEMORY, never a log/file.
    // This is a disposable test account, never a formal household credential.
    const server = createServer((req, res) => {
      if (req.url !== '/fixture' || req.method !== 'GET') { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ email, password })); server.close()
    })
    server.listen(0, '127.0.0.1', () => console.log(`One-use disposable QA pipe ready on port ${server.address().port}; no credentials displayed.`))
    setTimeout(() => server.close(), 60000).unref()
  } else if (process.argv[2] === 'cleanup') {
    check(existsSync(ledger), 'own UI ledger exists')
    const { userId, excludedHouseholdIds } = JSON.parse(readFileSync(ledger, 'utf8'))
    check(Array.isArray(excludedHouseholdIds), 'UI fixture has formal household exclusion list')
    check(/^[0-9a-f-]{36}$/.test(userId), 'own disposable user ID')
    const memberships = query(`select household_id from public.household_members where user_id='${userId}';`)
    for (const { household_id: id } of memberships) {
      check(/^[0-9a-f-]{36}$/.test(id), 'own UI household ID')
      check(!excludedHouseholdIds.includes(id), 'never clean a pre-existing household')
      check(query(`select count(*) n from public.household_members where household_id='${id}' and user_id <> '${userId}';`)[0].n === 0, 'disposable household has no other users')
      check(query(`select count(*) n from storage.objects where split_part(name,'/',1)='${id}';`)[0].n === 0, 'UI fixture has no Storage files')
      query(`begin; delete from public.books where household_id='${id}'; delete from public.profiles where household_id='${id}'; delete from public.household_members where household_id='${id}'; delete from public.households where id='${id}'; commit;`)
      check(query(`select (select count(*) from public.households where id='${id}') + (select count(*) from public.profiles where household_id='${id}') + (select count(*) from public.household_members where household_id='${id}') n;`)[0].n === 0, 'UI household cleanup complete')
    }
    check(!(await admin.auth.admin.deleteUser(userId)).error, 'UI Auth cleanup')
    check(query(`select count(*) n from auth.users where id='${userId}';`)[0].n === 0, 'UI Auth user removed')
    unlinkSync(ledger); console.log('Disposable UI Auth/Household/Profile fixtures removed; zero remainder.')
  } else throw new Error('Explicit serve or cleanup mode required')
} catch {
  console.error('STOP UI fixture operation did not complete; inspect ignored ledger without printing credentials.')
  process.exitCode = 1
}
