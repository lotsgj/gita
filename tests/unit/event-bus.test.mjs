import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../js/events/event-bus.js';
import { ResumeAdapter } from '../../js/events/resume-adapter.js';
import { DiksoochiAdapter } from '../../js/events/diksoochi-adapter.js';
import { ClarityAdapter } from '../../js/events/clarity-adapter.js';
import { SentryAdapter } from '../../js/events/sentry-adapter.js';
import { ageBand, profileAnalyticsContext } from '../../js/events/profile-analytics.js';

test('event adapters are isolated and resume records are allowlisted', async () => {
  const resumes = new Map();
  const adapterErrors = [];
  const observed = [];
  const bus = new EventBus({
    appVersion: 'test-version',
    contextProvider: () => ({ online: true, displayMode: 'browser' }),
    onAdapterError: (failure) => adapterErrors.push(failure)
  });
  bus.subscribe(new ResumeAdapter({ store: { async saveResume(record) { resumes.set(record.pid, structuredClone(record)); } } }));
  bus.subscribe(new ClarityAdapter());
  bus.subscribe(new SentryAdapter());
  bus.subscribe({ id: 'observer', handle: (event) => observed.push(event) });
  bus.subscribe({ id: 'broken', handle: () => { throw new Error('adapter failure'); } });

  const event = bus.emit('location_changed', {
    profileId: 7,
    anonymousProfileId: 'anonymous-only',
    context: { experience: 'gita-700', sid: '6.7', chapter: '6', language: 'kn' },
    details: { source: 'next' }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(event.context.appVersion, 'test-version');
  assert.equal(observed.length, 1);
  assert.equal(adapterErrors.length, 1);
  assert.deepEqual(resumes.get(7), {
    pid: 7, view: 'experience', experience: 'gita-700', sid: '6.7', language: 'kn', savedAt: event.occurredAt
  });
  assert.equal('anonymousProfileId' in resumes.get(7), false);
});

test('event schema rejects unknown and incomplete events', () => {
  const bus = new EventBus();
  assert.throws(() => bus.emit('unknown_event'), /Unknown Gitaverse event/);
  assert.throws(() => bus.emit('location_changed', { profileId: 7, context: { experience: 'gita-700' } }), /requires experience and sid/);
});

test('Diksoochi records only meaningful engagement thresholds without storing an event queue', async () => {
  const records = [];
  const adapter = new DiksoochiAdapter({ store: { async recordDiksoochiEngagement(record) { records.push(record); } } });
  const bus = new EventBus({ appVersion: 'test-version' });
  bus.subscribe(adapter);
  bus.emit('verse_viewed', { profileId: 4, context: { experience: 'gita-700', sid: '8.3', chapter: '8' } });
  const event = bus.emit('verse_engaged_10s', { profileId: 4, context: { experience: 'gita-700', sid: '8.3', chapter: '8' } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(records, [{
    pid: 4, experience: 'gita-700', sid: '8.3', chapter: '8', seconds: 10, occurredAt: event.occurredAt
  }]);
});

test('profile analytics retains the privacy age-band decisions', () => {
  const now = new Date('2026-09-26T00:00:00Z');
  assert.equal(ageBand('', now), 'missing');
  assert.equal(ageBand('not-a-date', now), 'missing');
  assert.equal(ageBand('2020-01-01', now), 'unknown');
  assert.equal(ageBand('2010-10-01', now), '13-17');
  assert.equal(ageBand('2001-09-26', now), '25-34');
  assert.deepEqual(profileAnalyticsContext({ dob: '1980-01-01', gender: 'self-described', interfaceLanguage: 'kn', contentLanguage: 'en' }, now), {
    ageBand: '45-54', genderGroup: 'self_described', profileLanguage: 'kn'
  });
});

test('Clarity receives only allowlisted analytics values', () => {
  const scripts = [];
  const target = {};
  const clarity = new ClarityAdapter({
    projectId: 'test123',
    target,
    documentRef: {
      head: { appendChild: (script) => scripts.push(script) },
      createElement: () => ({ dataset: {} }),
      querySelector: () => null
    }
  });
  clarity.initialize({ appVersion: '1.test', displayMode: 'standalone' });
  clarity.handle({
    event: 'verse_viewed',
    context: { ageBand: '25-34', genderGroup: 'female', profileLanguage: 'kn', experience: 'gita-700', language: 'kn', appVersion: '1.test', displayMode: 'browser' },
    details: {}, profileId: 99, anonymousProfileId: 'must-not-be-sent'
  });
  const calls = target.clarity.q.map((args) => Array.from(args));
  assert.equal(scripts[0].src, 'https://www.clarity.ms/tag/test123');
  assert.ok(calls.some((call) => call[0] === 'event' && call[1] === 'verse_viewed'));
  assert.ok(calls.some((call) => call[0] === 'set' && call[1] === 'app_version' && call[2] === '1.test'));
  assert.equal(JSON.stringify(calls).includes('must-not-be-sent'), false);
  assert.equal(JSON.stringify(calls).includes('99'), false);
});

test('Clarity captures the privacy-safe PWA update lifecycle without a profile', () => {
  const target = {};
  const clarity = new ClarityAdapter({
    projectId: 'test123', target,
    documentRef: { head: { appendChild() {} }, createElement: () => ({ dataset: {} }), querySelector: () => null }
  });
  clarity.handle({
    event: 'pwa_update_completed',
    context: { appVersion: '1.01Oct2026-090000', displayMode: 'standalone' },
    details: { fromVersion: '1.01Oct2026-080000', toVersion: '1.01Oct2026-090000', result: 'completed' }
  });
  const calls = target.clarity.q.map((args) => Array.from(args));
  assert.ok(calls.some((call) => call[0] === 'event' && call[1] === 'pwa_update_completed'));
  assert.ok(calls.some((call) => call[0] === 'set' && call[1] === 'update_from_version' && call[2] === '1.01Oct2026-080000'));
  assert.ok(calls.some((call) => call[0] === 'set' && call[1] === 'update_to_version' && call[2] === '1.01Oct2026-090000'));
});

test('Rachana events use the shared Clarity adapter without profile identifiers', () => {
  const target = {};
  const clarity = new ClarityAdapter({
    projectId: 'test123',
    target,
    documentRef: { head: { appendChild() {} }, createElement: () => ({ dataset: {} }), querySelector: () => null }
  });
  clarity.handle({
    event: 'rachana_page_viewed',
    context: { ageBand: '35-44', genderGroup: 'not_said', profileLanguage: 'en', appVersion: '1.test', displayMode: 'browser', surface: 'rachana', documentationPage: 'gita-700' },
    details: { route: 'gita-700' }, profileId: 7, anonymousProfileId: 'private-id'
  });
  const calls = target.clarity.q.map((args) => Array.from(args));
  assert.ok(calls.some((call) => call[0] === 'set' && call[1] === 'surface' && call[2] === 'rachana'));
  assert.ok(calls.some((call) => call[0] === 'set' && call[1] === 'rachana_page' && call[2] === 'gita-700'));
  assert.ok(calls.some((call) => call[0] === 'event' && call[1] === 'rachana_page_viewed'));
  assert.equal(JSON.stringify(calls).includes('private-id'), false);
});
