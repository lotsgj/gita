export class DiksoochiAdapter {
  constructor({ store }) {
    this.id = 'diksoochi';
    this.store = store;
  }

  accepts(event) {
    return /^verse_engaged_(10|30|60)s$/.test(event.event);
  }

  handle(event) {
    const seconds = Number(event.event.match(/(10|30|60)/)?.[1]);
    return this.store.recordDiksoochiEngagement({
      pid: event.profileId,
      experience: event.context.experience,
      sid: event.context.sid,
      chapter: event.context.chapter,
      seconds,
      occurredAt: event.occurredAt
    });
  }
}
