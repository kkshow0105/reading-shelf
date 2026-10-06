import { useState } from 'react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { accessMessage } from '../data/auth/policies.ts'

export function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  return <main id="main-content" className="access-page page-shell page-enter" tabIndex={-1}>
    <div className="access-intro"><span className="editorial-label">READING SHELF · 私人书架</span><h1>推开书房的门。</h1><p>让阅读，回到自己的时间。</p></div>
    <form className="access-form" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError(null)
      try { await onLogin(email, password); setPassword('') } catch (reason) { setError(accessMessage(reason)) }
      finally { setBusy(false) }
    }} aria-busy={busy}>
      <div className="access-field"><label htmlFor="login-email">邮箱</label><Input id="login-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
      <div className="access-field"><label htmlFor="login-password">密码</label><Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
      {error && <p className="access-error" role="alert">{error}</p>}
      <Button variant="primary" type="submit" disabled={busy} className="access-submit">{busy ? '正在登录…' : '登录'}</Button>
    </form>
  </main>
}
