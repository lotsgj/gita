export class PwaManager {
  constructor({ appVersion, onEvent = () => {}, onInstalled = () => {} }) {
    this.appVersion = appVersion;
    this.registration = null;
    this.installPrompt = null;
    this.reloading = false;
    this.onEvent = onEvent;
    this.onInstalled = onInstalled;
    this.waitingVersion = '';
    this.notifiedVersion = '';
    this.updateNotice = document.getElementById('pwa-update-notice');
    this.statusNotice = document.getElementById('pwa-status-notice');
    this.installButtons = Array.from(document.querySelectorAll('[data-install]'));
    this.bind();
  }

  bind() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event;
      this.installButtons.forEach((button) => { button.hidden = false; });
    });
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.installButtons.forEach((button) => { button.hidden = true; });
    });
    this.installButtons.forEach((button) => button.addEventListener('click', () => this.install()));
    document.getElementById('pwa-update-action').addEventListener('click', () => this.applyUpdate());
    document.getElementById('pwa-update-dismiss').addEventListener('click', () => {
      this.updateNotice.hidden = true;
      this.onEvent('pwa_update_dismissed', { fromVersion: this.appVersion, toVersion: this.waitingVersion || null });
    });
  }

  async start() {
    if (this.appVersion === 'dev' || !('serviceWorker' in navigator)) return;
    this.completePendingUpdate();
    try {
      this.registration = await navigator.serviceWorker.register('service-worker.js', { scope: '/', updateViaCache: 'none' });
      if (this.registration.waiting && navigator.serviceWorker.controller) this.showUpdate();
      this.registration.addEventListener('updatefound', () => {
        const worker = this.registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) this.showUpdate();
          if (worker.state === 'redundant') this.onEvent('pwa_update_failed', { fromVersion: this.appVersion, stage: 'installation' });
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.reloading) return;
        this.reloading = true;
        location.reload();
      });
      await this.registration.update();
    } catch (error) {
      this.onEvent('pwa_update_failed', { fromVersion: this.appVersion, stage: 'registration', reason: error?.name || 'error' });
      // The regular online player remains available if PWA setup is unsupported or interrupted.
    }
  }

  async resolveWaitingVersion() {
    try {
      const response = await fetch(`data/app-version.json?update=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const version = String((await response.json()).version || '');
        return version === this.appVersion ? '' : version;
      }
    } catch (_) {}
    return '';
  }

  async showUpdate() {
    this.waitingVersion = await this.resolveWaitingVersion();
    this.updateNotice.hidden = false;
    const identity = this.waitingVersion || 'waiting-worker';
    if (this.notifiedVersion !== identity) {
      this.notifiedVersion = identity;
      this.onEvent('pwa_update_available', { fromVersion: this.appVersion, toVersion: this.waitingVersion || null });
    }
  }

  applyUpdate() {
    const worker = this.registration?.waiting;
    if (!worker) return;
    const marker = { fromVersion: this.appVersion, toVersion: this.waitingVersion || null, acceptedAt: new Date().toISOString() };
    try { sessionStorage.setItem('gitaverse-pending-update', JSON.stringify(marker)); } catch (_) {}
    this.onEvent('pwa_update_accepted', marker);
    document.getElementById('pwa-update-action').disabled = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  completePendingUpdate() {
    let marker = null;
    try {
      marker = JSON.parse(sessionStorage.getItem('gitaverse-pending-update') || 'null');
      sessionStorage.removeItem('gitaverse-pending-update');
    } catch (_) {}
    if (!marker) return;
    const details = { fromVersion: marker.fromVersion || null, toVersion: this.appVersion, result: 'completed' };
    this.onEvent('pwa_update_completed', details);
    Promise.resolve(this.onInstalled(this.appVersion)).catch(() => {});
  }

  async install() {
    if (!this.installPrompt) return;
    const prompt = this.installPrompt;
    this.installPrompt = null;
    this.installButtons.forEach((button) => { button.hidden = true; });
    await prompt.prompt();
    await prompt.userChoice;
  }

  showStatus(message) {
    document.getElementById('pwa-status-message').textContent = message;
    this.statusNotice.hidden = false;
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => { this.statusNotice.hidden = true; }, 5000);
  }
}
