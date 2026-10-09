import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { initialTheme, applyTheme, THEME_STORAGE_KEY } from './theme.ts'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)![1]
function pageDocument(theme = 'light') {
  const meta = { content: '#F4F0E8', setAttribute(_name: string, value: string) { this.content = value } }
  return { documentElement: { dataset: { theme } }, querySelector: () => meta, meta }
}

test('HTML 同步初始化早于模块，默认明确暖纸且不查询系统配色', () => {
  assert.match(html, /<html[^>]*data-theme="light"/)
  assert.ok(html.indexOf('<script>') < html.indexOf('<script type="module"'))
  assert.ok(!bootstrap.includes('matchMedia') && !bootstrap.includes('prefers-color-scheme'))
})
test('首次访问、旧 system 与无效存储均回退暖纸，系统深色不影响结果', () => {
  for (const systemDark of [false, true]) for (const value of [null, 'system', 'invalid', '', 'light']) {
    const document = pageDocument()
    runInNewContext(bootstrap, { document, localStorage: { getItem(key: string) { assert.equal(key, THEME_STORAGE_KEY); return value } }, matchMedia: () => ({ matches: systemDark }) })
    assert.equal(document.documentElement.dataset.theme, 'light')
    assert.equal(document.meta.content, '#F4F0E8')
  }
})
test('首屏读取夜航偏好并同步浏览器栏颜色', () => {
  const document = pageDocument()
  runInNewContext(bootstrap, { document, localStorage: { getItem: () => 'dark' } })
  assert.equal(document.documentElement.dataset.theme, 'dark')
  assert.equal(document.meta.content, '#211F1B')
})
test('localStorage 读取抛错、访问被拒绝或不存在均不阻止首屏', () => {
  for (const mode of ['read-error', 'access-error', 'missing']) {
    const document = pageDocument(), scope = { document } as Record<string, unknown>
    if (mode === 'read-error') scope.localStorage = { getItem() { throw new Error('denied') } }
    if (mode === 'access-error') Object.defineProperty(scope, 'localStorage', { get() { throw new Error('denied') } })
    assert.doesNotThrow(() => runInNewContext(bootstrap, scope))
    assert.equal(document.documentElement.dataset.theme, 'light')
  }
})

// Exercise the actual React-side helpers against a minimal browser environment.
function withPage(action: (document: ReturnType<typeof pageDocument>) => void) {
  const saved = ['document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  const document = pageDocument('dark')
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: document })
    action(document)
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key)
    }
  }
}
test('React 接续首屏而不重复读存储，两个手动选择均能在重启后恢复', () => withPage(document => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { throw new Error('React must not re-read storage') }, setItem(key: string, value: string) { values.set(key, value) } } })
  assert.equal(initialTheme(), 'dark')
  for (const theme of ['light', 'dark'] as const) {
    applyTheme(theme)
    assert.equal(initialTheme(), theme)
    const restarted = pageDocument()
    runInNewContext(bootstrap, { document: restarted, localStorage: { getItem: (key: string) => values.get(key) } })
    assert.equal(restarted.documentElement.dataset.theme, theme)
    assert.equal(restarted.meta.content, document.meta.content)
  }
}))
test('保存偏好抛错、storage 缺失或访问拒绝仍能手动切换', () => withPage(document => {
  for (const storage of [{ setItem() { throw new Error('quota') } }, undefined]) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    assert.doesNotThrow(() => applyTheme('dark'))
    assert.equal(document.documentElement.dataset.theme, 'dark')
    assert.equal(document.meta.content, '#211F1B')
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied') } })
  assert.doesNotThrow(() => applyTheme('light'))
  assert.equal(initialTheme(), 'light')
}))
