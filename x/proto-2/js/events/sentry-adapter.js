export class SentryAdapter {
  constructor() {
    this.id = 'sentry';
    this.enabled = false;
  }

  accepts() {
    return this.enabled;
  }

  handle() {
    // Enabled in the dedicated Sentry integration pass.
  }
}
