import assert from 'node:assert/strict';
import { EventBus } from '../js/events/event-bus.js';
import { ResumeAdapter } from '../js/events/resume-adapter.js';
import { ClarityAdapter } from '../js/events/clarity-adapter.js';
import { SentryAdapter } from '../js/events/sentry-adapter.js';

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

console.log('PASS: event schema, adapter isolation, disabled telemetry adapters, and bounded resume records are valid');
