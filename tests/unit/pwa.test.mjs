import test from 'node:test';
import assert from 'node:assert/strict';

function element() {
  const listeners = new Map();
  return {
    hidden: true, disabled: false,
    addEventListener(name, listener) { listeners.set(name, listener); },
    click() { listeners.get('click')?.({}); }
  };
}

test('PWA update lifecycle deduplicates notice events and confirms installation after reload', async () => {
  const elements = new Map([
    ['pwa-update-notice', element()], ['pwa-status-notice', element()], ['pwa-update-action', element()],
    ['pwa-update-dismiss', element()], ['pwa-status-message', element()]
  ]);
  const storage = new Map();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: (id) => elements.get(id), querySelectorAll: () => [] } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key)
  } });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async () => ({ ok: true, async json() { return { version: '1.01Oct2026-100000' }; } }) });
  const { PwaManager } = await import('../../js/pwa.js');
  const events = [];
  const installed = [];
  const manager = new PwaManager({ appVersion: '1.01Oct2026-090000', onEvent: (name, details) => events.push({ name, details }), onInstalled: (version) => installed.push(version) });
  manager.registration = { waiting: { postMessage(message) { assert.deepEqual(message, { type: 'SKIP_WAITING' }); } } };
  await manager.showUpdate();
  await manager.showUpdate();
  assert.equal(events.filter((event) => event.name === 'pwa_update_available').length, 1);
  manager.applyUpdate();
  assert.equal(events.at(-1).name, 'pwa_update_accepted');
  const next = new PwaManager({ appVersion: '1.01Oct2026-100000', onEvent: (name, details) => events.push({ name, details }), onInstalled: (version) => installed.push(version) });
  next.completePendingUpdate();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(events.at(-1).name, 'pwa_update_completed');
  assert.deepEqual(installed, ['1.01Oct2026-100000']);
  assert.equal(storage.has('gitaverse-pending-update'), false);
});
