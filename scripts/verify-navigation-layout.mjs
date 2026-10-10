// No browser download: supply an already installed Playwright module.
// node scripts/verify-navigation-layout.mjs --playwright <absolute index.mjs> [--engine webkit]
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const option = name => process.argv[process.argv.indexOf(name) + 1]
const modulePath = process.argv.includes('--playwright') ? option('--playwright') : process.env.PLAYWRIGHT_MODULE
if (!modulePath) throw new Error('Provide --playwright for an existing installation; this script does not install it.')
const engine = process.argv.includes('--engine') ? option('--engine') : 'chromium'
const browsers = await import(pathToFileURL(resolve(modulePath)).href)
assert.ok(['chromium', 'webkit'].includes(engine))
const output = `qa/theme-stage45/${engine}`
mkdirSync(output, { recursive: true })
const baselineCSS = execFileSync('git', ['show', '22ab7d2dd53575bc1d6decd438c9e459820312d8:src/styles.css'], { encoding: 'utf8' })
const fixture = '/scripts/fixtures/navigation-layout.ts'
const base = 'http://127.0.0.1:5184'
const profile = '20000000-0000-0000-0000-000000000001'
const server = await createServer({ configFile: false, logLevel: 'error',
  plugins: [{ name: 'local-navigation-regression', enforce: 'pre',
    resolveId(id) { if (id.endsWith('/lib/supabase') || id.endsWith('/lib/supabase.ts')) return resolve('scripts/fixtures/navigation-layout.ts') },
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/App.tsx')) return code.replace('const [theme, setTheme] = useState<Theme>(initialTheme)', 'const [theme, setTheme] = useState<Theme>(initialTheme); window.__qaSetTheme = setTheme')
    },
    configureServer(s) { s.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/local-regression/storage/v1/object/sign/')) {
        res.setHeader('Content-Type', 'image/svg+xml'); res.setHeader('Cache-Control', 'public,max-age=3600')
        res.end(readFileSync('public/covers/gate.svg'))
      } else next()
    }) },
  }, react(), tailwindcss()], resolve: { alias: { '@': resolve('src') } },
  server: { host: '127.0.0.1', port: 5184, strictPort: true } })
let browser
const results = []
try {
  await server.listen(); browser = await browsers[engine].launch({ headless: true })
  for (const [width, height] of [[390, 844], [768, 1024], [1366, 768], [1920, 1080]]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height } })
    await context.addInitScript(t => localStorage.setItem('reading-shelf.theme', t), theme)
    const page = await context.newPage(), errors = [], external = []
    page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message))
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return route.continue()
      external.push(url.origin); return route.abort()
    })
    await page.goto(base); await page.locator('#login-email').fill('qa@example.invalid'); await page.locator('#login-password').fill('local-only')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.getByRole('link', { name: '进入测试甲的书房', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.book-entry').length === 120)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.querySelectorAll('.book-cover img')].filter(el => {
      const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0
    }).every(el => el.complete && el.naturalWidth > 0))
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'))
    const snapshot = () => page.evaluate(() => [...document.querySelectorAll('.site-header,.shelf-page,.book-grid,.book-entry,.book-cover,.book-caption,.book-caption h2,.book-author,.book-date,.book-date time')].slice(0, 36).map(el => {
      const c = getComputedStyle(el), r = el.getBoundingClientRect()
      return { cls: el.className, rect: [r.x, r.y, r.width, r.height], font: [c.fontFamily, c.fontSize, c.fontWeight, c.lineHeight], color: c.color, background: c.backgroundColor, padding: c.padding, margin: c.margin, edges: [c.borderTop, c.borderRight, c.borderBottom, c.borderLeft], radius: c.borderRadius, shadow: c.boxShadow }
    }))
    const normal = await snapshot()
    const currentPNG = await page.screenshot({ path: `${output}/${theme}-normal-${width}.png` })
    await page.evaluate(css => { const style = document.createElement('style'); style.id = 'qa-baseline'; style.textContent = css; document.head.append(style) }, baselineCSS)
    assert.deepEqual(await snapshot(), normal)
    const oldPNG = await page.screenshot({ path: `${output}/${theme}-baseline-${width}.png` })
    assert.ok(currentPNG.equals(oldPNG), 'Normal-font pixels must match the accepted baseline')
    await page.evaluate(() => document.getElementById('qa-baseline').remove())
    const metrics = await page.evaluate(() => ({ columns: getComputedStyle(document.querySelector('.book-grid')).gridTemplateColumns.split(' ').length, covers: [...document.querySelectorAll('.book-cover')].slice(0, 6).map(el => [el.offsetWidth, el.offsetHeight]) }))
    await page.evaluate(() => { window.__qaShelf = document.querySelector('.shelf-page'); window.scrollTo(0, 900) })
    const counts = () => page.evaluate(path => import(path).then(m => ({ ...m.counts })), fixture)
    const before = await counts()
    await page.evaluate(t => window.__qaSetTheme(t === 'dark' ? 'light' : 'dark'), theme)
    await page.waitForFunction(t => document.documentElement.dataset.theme !== t, theme)
    assert.equal(await page.evaluate(() => window.scrollY), 900)
    assert.equal(await page.evaluate(() => window.__qaShelf === document.querySelector('.shelf-page')), true)
    assert.deepEqual(await counts(), before)
    await page.evaluate(t => window.__qaSetTheme(t), theme)
    await page.waitForFunction(t => document.documentElement.dataset.theme === t, theme)
    await page.evaluate(() => [...document.querySelectorAll('.book-entry')].find(el => {
      const r = el.getBoundingClientRect(); return r.top > 150 && r.bottom < innerHeight
    }).click()); await page.locator('.book-detail').waitFor()
    const detailHash = await page.evaluate(() => location.hash)
    if (width <= 1024) {
      const open = async () => { await page.locator('.profile-mark').click(); await page.locator('.sheet-content').waitFor() }
      const closedOnMain = async () => {
        await page.locator('.sheet-content').waitFor({ state: 'detached' })
        await page.waitForFunction(() => document.activeElement?.id === 'main-content' && !document.activeElement.closest('[hidden],[aria-hidden="true"]'))
      }
      await open(); await page.keyboard.press('Escape'); await page.locator('.sheet-content').waitFor({ state: 'detached' })
      assert.equal(await page.locator('.profile-mark').evaluate(el => el === document.activeElement), true)
      await open(); await page.locator('.overlay-close').click(); await page.locator('.sheet-content').waitFor({ state: 'detached' })
      assert.equal(await page.locator('.profile-mark').evaluate(el => el === document.activeElement), true)
      let rememberedScroll = 900
      for (let i = 0; i < 2; i++) {
        await open(); await page.goBack(); await page.waitForFunction(() => location.hash.endsWith('/shelf')); await closedOnMain()
        assert.equal(await page.evaluate(() => window.scrollY), rememberedScroll)
        assert.equal(await page.evaluate(() => window.__qaShelf === document.querySelector('.shelf-page')), true)
        await open()
        // Radix's existing open-focus can scroll; preserve the actual position
        // at departure, rather than confusing it with a theme/navigation reset.
        rememberedScroll = await page.evaluate(() => window.scrollY)
        await page.goForward(); await page.waitForFunction(hash => location.hash === hash, detailHash); await closedOnMain()
      }
      assert.equal((await counts()).signs, before.signs, 'Shelf/detail navigation must reuse signed-cover URLs')
      await page.getByRole('button', { name: '编辑', exact: true }).click(); await page.locator('.book-form').waitFor()
      const originalNote = await page.locator('#note').inputValue(), editHash = await page.evaluate(() => location.hash)
      await page.locator('#note').fill('阻止离开的隔离草稿')
      await open(); await page.goBack(); await page.getByRole('button', { name: '继续编辑', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => location.hash), editHash, 'Rejected navigation must keep the current path')
      assert.equal(await page.locator('.sheet-content').count(), 1, 'An attempted navigation is not a committed navigation')
      await page.getByRole('button', { name: '继续编辑', exact: true }).click()
      assert.equal(await page.locator('#note').inputValue(), '阻止离开的隔离草稿')
      await page.locator('.sheet-content .overlay-close').click(); await page.locator('.sheet-content').waitFor({ state: 'detached' })
      await page.locator('#note').fill(originalNote)
      await page.getByRole('button', { name: '返回详情', exact: true }).click(); await page.locator('.book-detail').waitFor()
      await open(); await page.getByRole('button', { name: '所有书房', exact: true }).click(); await page.locator('.profiles-page').waitFor(); await closedOnMain()
      await page.getByRole('link', { name: '进入测试甲的书房', exact: true }).click(); await page.locator('.book-entry').last().waitFor()
      await open(); await page.getByRole('button', { name: '测试乙', exact: true }).click(); await closedOnMain()
      await page.waitForFunction(() => document.querySelectorAll('.book-entry').length === 8)
      await open(); await page.getByRole('button', { name: '测试甲', exact: true }).click(); await closedOnMain()
      await page.waitForFunction(() => document.querySelectorAll('.book-entry').length === 120)
    } else {
      await page.getByRole('button', { name: '返回书架', exact: true }).click(); await page.locator('.shelf-page').waitFor({ state: 'visible' })
    }
    assert.equal((await counts()).signs, before.signs + (width <= 1024 ? 8 : 0), 'Only the newly visited second profile may need signatures')
    await page.evaluate(() => window.scrollTo(0, 0))
    const changeDensity = async name => {
      await page.locator('.density-trigger').click()
      await page.getByRole('menuitemradio', { name, exact: true }).click()
      await page.mouse.move(0, 0)
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'))
    }
    let relaxedCovers
    if (width === 390) {
      await changeDensity('舒展 · 两列')
      const relaxedNormal = await snapshot()
      const relaxedPNG = await page.screenshot({ path: `${output}/${theme}-normal-two-columns.png` })
      await page.evaluate(css => { const style = document.createElement('style'); style.id = 'qa-baseline'; style.textContent = css; document.head.append(style) }, baselineCSS)
      assert.deepEqual(await snapshot(), relaxedNormal)
      assert.ok(relaxedPNG.equals(await page.screenshot()), 'Two-column normal pixels must remain unchanged')
      await page.evaluate(() => document.getElementById('qa-baseline').remove())
      relaxedCovers = await page.evaluate(() => [...document.querySelectorAll('.book-cover')].slice(0, 6).map(el => [el.offsetWidth, el.offsetHeight]))
      await changeDensity('紧凑 · 三列')
    }
    // Actual text-only pressure: double font metrics, not a claim about iPhone settings.
    await page.evaluate(() => {
      const all = [...document.querySelectorAll('body,body *')].filter(el => el instanceof HTMLElement)
      const values = all.map(el => { const c = getComputedStyle(el); return [el, parseFloat(c.fontSize), parseFloat(c.lineHeight)] })
      for (const [el, font, line] of values) { el.style.fontSize = font * 2 + 'px'; if (Number.isFinite(line)) el.style.lineHeight = line * 2 + 'px' }
    })
    const enlargedMetrics = () => page.evaluate(() => {
      const h = document.querySelector('.book-caption h2'), c = getComputedStyle(h)
      const datesFit = [...document.querySelectorAll('.book-date')].every(el => {
        const bounds = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el)
        return [...range.getClientRects()].every(r => !r.width || r.left >= bounds.left - 1 && r.right <= bounds.right + 1)
      })
      return { datesFit, titleHeight: h.getBoundingClientRect().height, titleLine: parseFloat(c.lineHeight), overflow: document.documentElement.scrollWidth > innerWidth,
        columns: getComputedStyle(document.querySelector('.book-grid')).gridTemplateColumns.split(' ').length,
        covers: [...document.querySelectorAll('.book-cover')].slice(0, 6).map(el => [el.offsetWidth, el.offsetHeight]) }
    })
    const enlarged = await enlargedMetrics()
    assert.ok(enlarged.datesFit); assert.equal(enlarged.overflow, false)
    if (width > 640) assert.ok(Math.abs(enlarged.titleHeight - enlarged.titleLine * 2) < .01, 'The enlarged title must retain two lines (allow subpixel rounding)')
    assert.deepEqual(enlarged.covers, metrics.covers); assert.equal(enlarged.columns, metrics.columns)
    await page.screenshot({ path: `${output}/${theme}-text200-${width}.png` })
    let enlargedRelaxed
    if (width === 390) {
      await changeDensity('舒展 · 两列')
      enlargedRelaxed = await enlargedMetrics()
      assert.ok(enlargedRelaxed.datesFit); assert.equal(enlargedRelaxed.overflow, false)
      assert.equal(enlargedRelaxed.columns, 2); assert.deepEqual(enlargedRelaxed.covers, relaxedCovers)
      await page.screenshot({ path: `${output}/${theme}-text200-two-columns.png` })
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, [])
    results.push({ width, height, theme, normalComputedAndPixelsEqual: true, navigationFocus: true, themeKeepAliveScroll: true, signedCoverReuse: true, enlarged, enlargedRelaxed })
    console.log(`PASS ${theme} ${width}x${height}: normal baseline, navigation/focus, theme/scroll, 200% text`)
    await context.close()
  }
  writeFileSync(`${output}/navigation-layout-result.json`, JSON.stringify({ engine, results, iPhoneNotTested: true, formalDataRequests: 0 }, null, 2))
} finally { if (browser) await browser.close(); await server.close() }
