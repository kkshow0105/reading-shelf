// Administrator-only, explicitly run AFTER verifying the target project.
// Never imported by Vite. Secrets come from this process environment, not .env.local.
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL: url, SUPABASE_PROJECT_REF: ref, SUPABASE_SECRET_KEY: key } = process.env
let origin
try { origin = url ? new URL(url).origin : undefined } catch { /* Never echo an invalid URL or credential. */ }
if (!url || !ref || !key || origin !== `https://${ref}.supabase.co` || url.replace(/\/$/, '') !== `https://${ref}.supabase.co`) {
  throw new Error('请提供并核对管理员终端的 SUPABASE_URL、SUPABASE_PROJECT_REF 和 SUPABASE_SECRET_KEY；不会输出密钥。')
}
if (!key.startsWith('sb_secret_')) {
  try {
    if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role !== 'service_role') throw new Error()
  } catch { throw new Error('Bucket 初始化只使用管理员 secret / legacy service_role key，不接受浏览器 publishable key。') }
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const allowed = ['image/jpeg', 'image/png', 'image/webp']
const limit = 10 * 1024 * 1024
const { data: existing, error: lookupError } = await client.storage.getBucket('book-covers')
if (existing) {
  if (existing.public || Number(existing.file_size_limit) !== limit || JSON.stringify([...(existing.allowed_mime_types || [])].sort()) !== JSON.stringify([...allowed].sort())) {
    throw new Error('现有 book-covers 配置不符；已停止，不自动修改现有 bucket。')
  }
  console.log('book-covers 已存在，private 和限制符合要求；没有修改。')
} else {
  if (lookupError && !['404', '400'].includes(String(lookupError.statusCode ?? lookupError.status))) throw new Error('Bucket 查询失败，已停止。请核查目标与权限，不会输出密钥。')
  // Use the API's list result to distinguish absent bucket from ambiguous lookup errors.
  const { data: buckets, error } = await client.storage.listBuckets()
  if (error || !buckets || buckets.some(bucket => bucket.id === 'book-covers')) throw new Error('无法可靠确认 bucket 不存在，已停止。')
  const created = await client.storage.createBucket('book-covers', { public: false, fileSizeLimit: limit, allowedMimeTypes: allowed })
  if (created.error) throw new Error('Bucket 创建失败；没有更新或删除其他 bucket。')
  console.log('已通过 Storage API 建立 private book-covers。')
}
