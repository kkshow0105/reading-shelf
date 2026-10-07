import test from 'node:test'
import assert from 'node:assert/strict'
import { CHECK_INTERVAL, combineSafety, createPwaUpdate, installAvailable, isStandalone, shouldCheck } from './update.ts'

class Worker extends EventTarget {
  state = 'installed'; messages: unknown[] = []; fails = false
  postMessage(message: unknown) { if (this.fails) throw new Error('private error must never be displayed'); this.messages.push(message) }
}
class Registration extends EventTarget {
  active: Worker | null = null
  waiting: Worker | null = null; installing: Worker | null = null
  checks = 0; fails = false
  async update() { this.checks++; if (this.fails) throw new Error('check failed') }
}
class Container extends EventTarget {
  controller: Worker | null = null; registration = new Registration(); calls = 0; fails = false
  async register(url: string, options: unknown) {
    assert.equal(url, '/sw.js'); assert.deepEqual(options, { scope: '/', updateViaCache: 'none' })
    this.calls++; if (this.fails) throw new Error('registration failed'); return this.registration
  }
}
function setup(supported = true) {
  const container = new Container(); container.registration.active = new Worker()
  let reloads = 0, now = 0, timer: (() => void) | undefined
  const service = createPwaUpdate({ container: supported ? container as unknown as ServiceWorkerContainer : undefined,
    registerUrl: '/sw.js', reload: () => { reloads++ }, now: () => now,
    timeout: fn => { timer = fn; return 1 as unknown as ReturnType<typeof setTimeout> }, clearTimeout: () => { timer = undefined },
  })
  return { service, container, reg: container.registration, reloads: () => reloads, time: (value: number) => { now = value }, timeout: () => timer?.(),
    offer: () => { const worker = new Worker(); container.registration.waiting = worker; container.registration.installing = worker; container.registration.dispatchEvent(new Event('updatefound')); worker.dispatchEvent(new Event('statechange')); return worker },
    control: (worker: Worker) => { container.controller = worker; container.dispatchEvent(new Event('controllerchange')) },
  }
}
test('unsupported browser remains usable without registration or refresh', async () => {
  const f = setup(false); await f.service.start(); assert.equal(f.service.snapshot().supported, false); assert.equal(f.service.snapshot().status, 'idle'); assert.equal(f.container.calls, 0); assert.equal(f.service.update(), false)
})
test('startup registers once and checks once even with StrictMode repeated starts', async () => {
  const f = setup(); await Promise.all([f.service.start(), f.service.start()]); assert.equal(f.container.calls, 1); assert.equal(f.reg.checks, 1); assert.equal(f.service.snapshot().status, 'idle')
})
test('only an actually waiting worker makes an update available', async () => {
  const f = setup(); await f.service.start(); f.reg.installing = new Worker(); f.reg.dispatchEvent(new Event('updatefound')); f.reg.installing.dispatchEvent(new Event('statechange')); assert.equal(f.service.snapshot().status, 'idle')
  f.offer(); assert.equal(f.service.snapshot().status, 'updateAvailable'); assert.equal(f.reloads(), 0)
})
test('first-install transient waiting state is never advertised as a new version', async () => {
  const f = setup(); f.reg.active = null; await f.service.start(); const w = f.offer(); assert.equal(f.service.snapshot().status, 'idle'); f.control(w); assert.equal(f.reloads(), 0)
})
test('dismiss is session-only and update/check events do not repeat prompt', async () => {
  const f = setup(); await f.service.start(); f.offer(); f.service.dismiss(); await f.service.check(true); assert.equal(f.service.snapshot().dismissed, true); assert.equal(setup().service.snapshot().dismissed, false)
})
test('first install and another tab controller change never reload this page', async () => {
  const f = setup(); await f.service.start(); f.control(new Worker()); f.offer(); f.control(new Worker()); assert.equal(f.reloads(), 0)
})
test('user update posts SKIP_WAITING; target controller reloads exactly once', async () => {
  const f = setup(); await f.service.start(); const w = f.offer(); assert.equal(f.service.update(), true); assert.equal(f.service.snapshot().status, 'updating'); assert.deepEqual(w.messages, [{ type: 'SKIP_WAITING' }]); assert.equal(f.service.update(), false)
  f.control(new Worker()); assert.equal(f.reloads(), 0); f.control(w); f.control(w); assert.equal(f.reloads(), 1)
})
test('activation timeout revokes consent, late activation cannot trigger a reload loop', async () => {
  const f = setup(); await f.service.start(); const w = f.offer(); f.service.update(); f.timeout(); assert.equal(f.service.snapshot().status, 'error'); f.control(w); assert.equal(f.reloads(), 0)
})
test('activation message failure is recoverable and does not expose native reason', async () => {
  const f = setup(); await f.service.start(); const w = f.offer(); w.fails = true; assert.equal(f.service.update(), false); assert.equal(f.service.snapshot().status, 'error'); assert.equal('error' in f.service.snapshot(), false); w.fails = false; await f.service.retry(); assert.equal(f.service.snapshot().status, 'updateAvailable')
})
test('registration failure allows a safe retry', async () => {
  const f = setup(); f.container.fails = true; await f.service.start(); assert.equal(f.service.snapshot().status, 'error'); f.container.fails = false; await f.service.retry(); assert.equal(f.service.snapshot().status, 'idle')
})
test('update check failure retains old worker and can retry', async () => {
  const f = setup(); await f.service.start(); f.reg.fails = true; await f.service.check(true); assert.equal(f.service.snapshot().status, 'error'); assert.equal(f.reloads(), 0); f.reg.fails = false; await f.service.retry(); assert.equal(f.service.snapshot().status, 'idle')
})
test('visible/periodic checks share hourly throttling and never check during activation', async () => {
  const f = setup(); await f.service.start(); await f.service.check(); f.time(CHECK_INTERVAL - 1); await f.service.check(); assert.equal(f.reg.checks, 1); f.time(CHECK_INTERVAL); await f.service.check(); assert.equal(f.reg.checks, 2); f.offer(); f.service.update(); await f.service.check(true); assert.equal(f.reg.checks, 2)
  assert.equal(shouldCheck(0, CHECK_INTERVAL), true)
})
test('standalone and iOS detection suppress installation; unsupported browsers have no fake prompt', () => {
  assert.equal(isStandalone(true, false), true); assert.equal(isStandalone(false, true), true); assert.equal(isStandalone(false), false)
  assert.equal(installAvailable(true, true, true), false); assert.equal(installAvailable(false, true, false), true); assert.equal(installAvailable(false, false, true), true); assert.equal(installAvailable(false, false, false), false)
})
test('mutation protection takes priority over drafts, including retained session drafts', () => {
  assert.equal(combineSafety(['safe', 'confirm', 'busy']), 'busy'); assert.equal(combineSafety(['safe', 'confirm']), 'confirm'); assert.equal(combineSafety([]), 'safe')
})
