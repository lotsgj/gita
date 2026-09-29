export class AboutDialog {
  constructor({ version = 'dev', onOpen = () => {}, translate = (key, fallback) => fallback } = {}) {
    this.version = version;
    this.onOpen = onOpen;
    this.translate = translate;
    this.overlay = this.ensureMarkup();
    this.overlay.querySelector('[data-about-version]').textContent = version;
    this.refresh();
    this.overlay.querySelector('[data-about-close]').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (event) => { if (event.target === this.overlay) this.close(); });
  }

  refresh() {
    this.overlay.querySelector('#about-title').textContent = this.translate('common.about', 'About Gitaverse');
    this.overlay.querySelector('.about-body > p').textContent = this.translate('about.body', 'Gitaverse is a verse and chanting experience from Gita Jyoti—a simple space to listen to, study and remain close to the Bhagavad Gita.');
    const version = this.overlay.querySelector('.about-version');
    const value = version.querySelector('[data-about-version]');
    version.replaceChildren(document.createTextNode(this.translate('about.version', 'Version') + ' '), value);
    this.overlay.querySelector('[data-about-close]').setAttribute('aria-label', this.translate('common.close', 'Close'));
  }

  ensureMarkup() {
    const existing = document.getElementById('about-overlay');
    if (existing) {
      const version = existing.querySelector('#about-version');
      if (version) version.dataset.aboutVersion = '';
      const close = existing.querySelector('.about-close');
      if (close) close.dataset.aboutClose = '';
      return existing;
    }
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'about-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="dialog about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <button class="icon-button about-close" type="button" data-about-close aria-label="Close">×</button>
        <div class="about-body">
          <div class="about-flute" aria-hidden="true"><img src="assets/images/krishna-flute.svg" alt=""><i class="about-note about-note-one">♪</i><i class="about-note about-note-two">♫</i><i class="about-note about-note-three">♩</i></div>
          <h2 id="about-title">About Gitaverse</h2>
          <p>Gitaverse is a verse and chanting experience from Gita Jyoti—a simple space to listen to, study and remain close to the Bhagavad Gita.</p>
          <div class="about-links"><a href="https://gitajyoti.org/" target="_blank" rel="noopener">Gita Jyoti</a><a href="https://lightoftheself.org/" target="_blank" rel="noopener">Light of the Self Foundation</a></div>
          <p class="about-version">Version <span data-about-version>dev</span></p>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  open(opener = document.activeElement) {
    this.refresh();
    this.opener = opener;
    this.overlay.hidden = false;
    this.onOpen();
    requestAnimationFrame(() => this.overlay.querySelector('[data-about-close]')?.focus());
  }

  close({ restoreFocus = true } = {}) {
    if (this.overlay.hidden) return false;
    this.overlay.hidden = true;
    if (restoreFocus) this.opener?.focus?.();
    return true;
  }
}
