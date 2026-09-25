export class PwaManager {
  constructor({ appVersion }) {
    this.appVersion = appVersion;
    this.registration = null;
    this.installPrompt = null;
    this.reloading = false;
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
    document.getElementById('pwa-update-dismiss').addEventListener('click', () => { this.updateNotice.hidden = true; });
  }

  async start() {
    if (this.appVersion === 'dev' || !('serviceWorker' in navigator)) return;
    try {
      this.registration = await navigator.serviceWorker.register('service-worker.js', { scope: '/', updateViaCache: 'none' });
      if (this.registration.waiting && navigator.serviceWorker.controller) this.showUpdate();
      this.registration.addEventListener('updatefound', () => {
        const worker = this.registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) this.showUpdate();
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.reloading) return;
        this.reloading = true;
        location.reload();
      });
      await this.registration.update();
    } catch (_) {
      // The regular online player remains available if PWA setup is unsupported or interrupted.
    }
  }

  showUpdate() {
    this.updateNotice.hidden = false;
  }

  applyUpdate() {
    const worker = this.registration?.waiting;
    if (!worker) return;
    document.getElementById('pwa-update-action').disabled = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
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
