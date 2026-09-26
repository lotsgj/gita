import assert from 'node:assert/strict';
import { EventBus } from '../js/events/event-bus.js';
import { ResumeAdapter } from '../js/events/resume-adapter.js';
import { ClarityAdapter } from '../js/events/clarity-adapter.js';
import { SentryAdapter } from '../js/events/sentry-adapter.js';
import { ageBand, profileAnalyticsContext } from '../js/events/profile-analytics.js';

const resumes = new Map();
const store = {
  async saveResume(record) {
    resumes.set(record.pid, structuredClone(record));
    return record;
  }
};
const adapterErrors = [];
const observed = [];
const bus = new EventBus({
  appVersion: 'test-version',
  contextProvider: () => ({ online: true, displayMode: 'browser' }),
  onAdapterError: (failure) => adapterErrors.push(failure)
});

bus.subscribe(new ResumeAdapter({ store }));
bus.subscribe(new ClarityAdapter());
bus.subscribe(new SentryAdapter());
bus.subscribe({ id: 'observer', handle: (event) => observed.push(event) });
bus.subscribe({ id: 'broken', handle: () => { throw new Error('adapter failure'); } });

const locationEvent = bus.emit('location_changed', {
  profileId: 7,
  anonymousProfileId: 'anonymous-only',
  context: { experience: 'gita-700', sid: '6.7', chapter: '6', language: 'kn' },
  details: { source: 'next' }
});
await new Promise((resolve) => setTimeout(resolve, 0));

assert.equal(locationEvent.schemaVersion, 1);
assert.equal(locationEvent.context.appVersion, 'test-version');
assert.equal(Object.isFrozen(locationEvent), true);
assert.equal(Object.isFrozen(locationEvent.context), true);
assert.equal(observed.length, 1, 'one broken adapter must not stop another adapter');
assert.equal(adapterErrors.length, 1, 'adapter failures must be isolated and reported');
assert.deepEqual(resumes.get(7), {
  pid: 7,
  view: 'experience',
  experience: 'gita-700',
  sid: '6.7',
  language: 'kn',
  savedAt: locationEvent.occurredAt
});
assert.equal('anonymousProfileId' in resumes.get(7), false, 'resume records must use an allowlist');

const homeEvent = bus.emit('home_opened', {
  profileId: 7,
  context: { language: 'en' },
  details: { source: 'home' }
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(resumes.get(7), {
  pid: 7,
  view: 'home',
  language: 'en',
  savedAt: homeEvent.occurredAt
});
assert.throws(() => bus.emit('unknown_event'), /Unknown Gitaverse event/);
assert.throws(() => bus.emit('location_changed', { profileId: 7, context: { experience: 'gita-700' } }), /requires experience and sid/);

assert.equal(ageBand('', new Date('2026-09-26T00:00:00Z')), 'missing');
assert.equal(ageBand('not-a-date', new Date('2026-09-26T00:00:00Z')), 'missing');
assert.equal(ageBand('2020-01-01', new Date('2026-09-26T00:00:00Z')), 'unknown');
assert.equal(ageBand('2010-10-01', new Date('2026-09-26T00:00:00Z')), '13-17');
assert.equal(ageBand('2001-09-26', new Date('2026-09-26T00:00:00Z')), '25-34');
assert.deepEqual(profileAnalyticsContext({ dob: '1980-01-01', gender: 'self-described', language: 'kn' }, new Date('2026-09-26T00:00:00Z')), {
  ageBand: '45-54', genderGroup: 'self_described', profileLanguage: 'kn'
});

const clarityCalls = [];
const clarityScripts = [];
const clarityTarget = {};
const clarityDocument = {
  head: { appendChild: (script) => clarityScripts.push(script) },
  createElement: () => ({ dataset: {} }),
  querySelector: () => null
};
const clarity = new ClarityAdapter({ projectId: 'test123', target: clarityTarget, documentRef: clarityDocument });
clarity.handle({
  event: 'verse_viewed',
  context: { ageBand: '25-34', genderGroup: 'female', profileLanguage: 'kn', experience: 'gita-700', language: 'kn', appVersion: '1.test', displayMode: 'browser' },
  details: {},
  profileId: 99,
  anonymousProfileId: 'must-not-be-sent'
});
clarityTarget.clarity.q.forEach((args) => clarityCalls.push(Array.from(args)));
assert.equal(clarityScripts.length, 1);
assert.equal(clarityScripts[0].src, 'https://www.clarity.ms/tag/test123');
assert.deepEqual(clarityCalls.find((call) => call[1] === 'age_band'), ['set', 'age_band', '25-34']);
assert.ok(clarityCalls.some((call) => call[0] === 'event' && call[1] === 'verse_viewed'));
assert.equal(JSON.stringify(clarityCalls).includes('must-not-be-sent'), false);
assert.equal(JSON.stringify(clarityCalls).includes('99'), false);

console.log('PASS: event schema, adapter isolation, demographics, Clarity privacy allowlist, and bounded resume records are valid');
