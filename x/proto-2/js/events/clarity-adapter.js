export class ClarityAdapter {
  constructor({ projectId = '', target = globalThis, documentRef = globalThis.document } = {}) {
    this.id = 'clarity';
    this.projectId = String(projectId || '').trim();
    this.target = target;
    this.document = documentRef;
    this.enabled = /^[a-z0-9]+$/i.test(this.projectId);
    this.started = false;
    this.tags = new Map();
  }

  accepts(event) {
    return this.enabled && Boolean(event.context.ageBand);
  }

  start() {
    if (this.started) return;
    this.started = true;
    const clarity = this.target.clarity = this.target.clarity || function clarityQueue() {
      (clarity.q = clarity.q || []).push(arguments);
    };
    if (this.document?.querySelector(`script[data-clarity-project="${this.projectId}"]`)) return;
    const script = this.document.createElement('script');
    script.async = true;
    script.dataset.clarityProject = this.projectId;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(this.projectId)}`;
    this.document.head.appendChild(script);
  }

  setTag(key, value) {
    if (value == null || value === '' || this.tags.get(key) === String(value)) return;
    this.tags.set(key, String(value));
    this.target.clarity('set', key, String(value));
  }

  handle(event) {
    this.start();
    const tags = {
      age_band: event.context.ageBand,
      gender_group: event.context.genderGroup,
      profile_language: event.context.profileLanguage,
      experience: event.context.experience,
      content_language: event.context.language,
      app_version: event.context.appVersion,
      display_mode: event.context.displayMode
    };
    Object.entries(tags).forEach(([key, value]) => this.setTag(key, value));

    const eventName = this.eventName(event);
    if (eventName) this.target.clarity('event', eventName);
  }

  eventName(event) {
    if (event.event === 'location_changed') {
      const sourceEvents = { next: 'next_verse', previous: 'previous_verse', swipe: 'verse_swiped', goto: 'goto_verse', chapter: 'chapter_selected', resume: 'experience_resumed' };
      return sourceEvents[event.details.source] || null;
    }
    const allowed = new Set([
      'app_opened', 'profile_created', 'profile_selected', 'profile_updated', 'profile_switched',
      'experience_selected', 'language_changed', 'home_opened', 'data_load_failed', 'profile_storage_failed',
      'verse_viewed', 'verse_engaged_10s', 'verse_engaged_30s', 'verse_engaged_60s',
      'audio_started', 'audio_resumed', 'audio_paused', 'audio_seeked', 'audio_25', 'audio_50',
      'audio_75', 'audio_completed', 'audio_failed'
    ]);
    return allowed.has(event.event) ? event.event : null;
  }
}
