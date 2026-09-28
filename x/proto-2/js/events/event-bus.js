import { EVENT_SCHEMA_VERSION, deepFreeze, validateEventInput } from './event-schema.js';

function randomId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class EventBus {
  constructor({ appVersion = 'dev', contextProvider = () => ({}), onAdapterError = () => {} } = {}) {
    this.appVersion = appVersion;
    this.contextProvider = contextProvider;
    this.onAdapterError = onAdapterError;
    this.sessionId = randomId();
    this.adapters = new Map();
  }

  subscribe(adapter) {
    if (!adapter?.id || typeof adapter.handle !== 'function') throw new Error('An event adapter requires an ID and handle function.');
    if (this.adapters.has(adapter.id)) throw new Error('Event adapter already registered: ' + adapter.id);
    this.adapters.set(adapter.id, adapter);
    return () => this.adapters.delete(adapter.id);
  }

  emit(name, input = {}) {
    validateEventInput(name, input);
    const event = deepFreeze({
      schemaVersion: EVENT_SCHEMA_VERSION,
      eventId: randomId(),
      event: name,
      occurredAt: new Date().toISOString(),
      sessionId: this.sessionId,
      profileId: input.profileId == null ? null : Number(input.profileId),
      anonymousProfileId: input.anonymousProfileId || null,
      context: {
        appVersion: this.appVersion,
        ...this.contextProvider(),
        ...(input.context || {})
      },
      details: { ...(input.details || {}) }
    });

    this.adapters.forEach((adapter) => {
      if (adapter.accepts && !adapter.accepts(event)) return;
      try {
        Promise.resolve(adapter.handle(event)).catch((error) => this.reportAdapterError(adapter, error, event));
      } catch (error) {
        this.reportAdapterError(adapter, error, event);
      }
    });
    return event;
  }

  reportAdapterError(adapter, error, event) {
    try { this.onAdapterError({ adapter: adapter.id, error, event }); } catch (_) {}
  }
}
