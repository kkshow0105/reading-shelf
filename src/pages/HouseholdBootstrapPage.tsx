import { useState } from 'react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { bootstrapInput, accessMessage } from '../data/auth/policies.ts'
export function HouseholdBootstrapPage({ onCreate }: { onCreate: (name: string, names: string[]) => Promise<void> }) {
  const [name, setName] = useState('私人书房'), [first, setFirst] = useState(''), [second, setSecond] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  return <main id="main-content" className="access-page bootstrap-page page-shell page-enter" tabIndex={-1}>
    <div className="access-intro"><span className="editorial-label">EX LIBRIS · 共同的书房</span><h1>建立你的私人书房</h1><p>一起使用同一个书房，阅读记录各自独立。</p></div>
    <form className="access-form" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setError(null)
      try { const input = bootstrapInput(name, [first, second]); setBusy(true); await onCreate(input.name, input.names) }
      catch (reason) { setError(accessMessage(reason)) } finally { setBusy(false) }
    }} aria-busy={busy}>
      <div className="access-field"><label htmlFor="household-name">书房名称</label><Input id="household-name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></div>
      <fieldset className="initial-profiles"><legend>阅读档案</legend><div className="access-field"><label htmlFor="profile-first">档案一 · 姓名<span aria-hidden="true"> *</span></label><Input id="profile-first" required maxLength={20} autoComplete="off" value={first} onChange={e => setFirst(e.target.value)} disabled={busy} /></div>
        <div className="access-field"><label htmlFor="profile-second">档案二 · 姓名<span aria-hidden="true"> *</span></label><Input id="profile-second" required maxLength={20} autoComplete="off" value={second} onChange={e => setSecond(e.target.value)} disabled={busy} /></div></fieldset>
      <p className="access-note">可以进入彼此的书房；书单、评分、日期与短评各自保存。</p>
      {error && <p className="access-error" role="alert">{error}</p>}
      <Button variant="primary" type="submit" disabled={busy} className="access-submit">{busy ? '正在建立…' : '建立书房'}</Button>
    </form>
  </main>
}
