export function readSupabaseConfig(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string }) {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key || /YOUR_|PLACEHOLDER/i.test(`${url} ${key}`)) throw new Error('请先在 .env.local 配置已确认项目的 Supabase URL 和 publishable key。')
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error('VITE_SUPABASE_URL 不是有效 URL。') }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) throw new Error('Supabase URL 必须是项目根地址，不包含凭据或参数。')
  const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !local) throw new Error('远端 Supabase 必须使用 HTTPS。')
  if (!key.startsWith('sb_publishable_')) {
    // Legacy anon JWT is accepted only after its role is decoded. Never echo a key.
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (key.split('.').length !== 3 || payload.role !== 'anon') throw new Error()
    } catch { throw new Error('前端只接受 publishable 或 legacy anon key，禁止高权限密钥。') }
  }
  return { url: parsed.origin, key }
}
