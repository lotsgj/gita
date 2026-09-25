export class ResumeAdapter {
  constructor({ store }) {
    this.id = 'resume';
    this.store = store;
  }

  accepts(event) {
    return event.event === 'location_changed' || event.event === 'home_opened';
  }

  handle(event) {
    const base = {
      pid: event.profileId,
      language: event.context.language === 'kn' ? 'kn' : 'en',
      savedAt: event.occurredAt
    };
    if (event.event === 'home_opened') {
      return this.store.saveResume({ ...base, view: 'home' });
    }
    return this.store.saveResume({
      ...base,
      view: 'experience',
      experience: event.context.experience,
      sid: event.context.sid
    });
  }
}
