export class ClarityAdapter {
  constructor() {
    this.id = 'clarity';
    this.enabled = false;
  }

  accepts() {
    return this.enabled;
  }

  handle() {
    // Enabled in the dedicated Clarity integration pass.
  }
}
