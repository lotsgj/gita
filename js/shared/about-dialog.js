import { mergeVersionHistory, validateVersionHistory } from '../version-history.js';

export class AboutDialog {
  constructor({ version = 'dev', onOpen = () => {}, translate = (key, fallback) => fallback, historyStore = null } = {}) {
    this.version = version;
    this.onOpen = onOpen;
    this.translate = translate;
    this.historyStore = historyStore;
    this.overlay = this.ensureMarkup();
    this.ensureHistoryMarkup();
    this.overlay.querySelector('[data-about-version]').textContent = version;
    this.refresh();
    this.overlay.querySelector('[data-about-close]').addEventListener('click', () => this.close());
    this.overlay.querySelector('[data-version-history-open]').addEventListener('click', () => this.showHistory());
    this.overlay.querySelector('[data-version-history-back]').addEventListener('click', () => this.showAbout());
    this.overlay.addEventListener('click', (event) => { if (event.target === this.overlay) this.close(); });
  }

  refresh() {
    this.overlay.querySelector('#about-title').textContent = this.translate('common.about', 'About Gitaverse');
    this.overlay.querySelector('.about-main > p').textContent = this.translate('about.body', 'Gitaverse is a verse and chanting experience from Gita Jyoti—a simple space to listen to, study and remain close to the Bhagavad Gita.');
    const version = this.overlay.querySelector('.about-version');
    const value = version.querySelector('[data-about-version]');
    version.replaceChildren(document.createTextNode(this.translate('about.version', 'Version') + ' '), value);
    this.overlay.querySelector('[data-about-close]').setAttribute('aria-label', this.translate('common.close', 'Close'));
    this.overlay.querySelector('[data-version-history-open]').textContent = this.translate('about.history', 'Version history');
    this.overlay.querySelector('[data-version-history-back]').textContent = this.translate('about.back', '← Back to About');
    this.overlay.querySelector('[data-version-history-title]').textContent = this.translate('about.history', 'Version history');
  }

  ensureHistoryMarkup() {
    const body = this.overlay.querySelector('.about-body');
    let main = body.querySelector('.about-main');
    if (!main) {
      main = document.createElement('div');
      main.className = 'about-main';
      Array.from(body.children).forEach((child) => main.appendChild(child));
      body.appendChild(main);
    }
    if (!main.querySelector('[data-version-history-open]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'about-history-link';
      button.dataset.versionHistoryOpen = '';
      main.appendChild(button);
    }
    if (!body.querySelector('.about-history')) {
      const history = document.createElement('section');
      history.className = 'about-history';
      history.hidden = true;
      history.innerHTML = '<button type="button" class="about-history-back" data-version-history-back></button><h2 data-version-history-title></h2><div class="about-history-list" data-version-history-list></div>';
      body.appendChild(history);
    }
  }

  async showHistory() {
    const list = this.overlay.querySelector('[data-version-history-list]');
    this.overlay.querySelector('.about-main').hidden = true;
    this.overlay.querySelector('.about-history').hidden = false;
    list.textContent = this.translate('about.historyLoading', 'Loading version history…');
    let deployed = [];
    try {
      const response = await fetch(`data/version-history.json?v=${encodeURIComponent(this.version)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('History unavailable.');
      deployed = validateVersionHistory(await response.json());
    } catch (_) {}
    let local = [];
    try { local = this.historyStore ? await this.historyStore.list() : []; } catch (_) {}
    this.renderHistory(mergeVersionHistory(deployed, local, this.version));
    requestAnimationFrame(() => this.overlay.querySelector('[data-version-history-back]')?.focus());
  }

  renderHistory(records) {
    const list = this.overlay.querySelector('[data-version-history-list]');
    list.textContent = '';
    records.forEach((record) => {
      const item = document.createElement('article');
      item.className = 'about-history-item';
      const title = document.createElement('h3');
      title.textContent = record.version;
      const date = document.createElement('time');
      date.dateTime = record.date || '';
      date.textContent = record.date ? new Intl.DateTimeFormat(document.documentElement.lang === 'kn' ? 'kn-IN' : 'en-IN', { dateStyle: 'long' }).format(new Date(`${record.date}T00:00:00`)) : '';
      const message = document.createElement('p');
      message.textContent = record.message || this.translate('about.currentBuild', 'Current Gitaverse build');
      item.append(title, date, message);
      if (record.dateSeen) {
        const seen = document.createElement('small');
        seen.textContent = `${this.translate('about.seen', 'Seen on this device')}: ${new Date(record.dateSeen).toLocaleString()}`;
        item.appendChild(seen);
      }
      if (record.dateInstalled) {
        const installed = document.createElement('small');
        installed.textContent = `${this.translate('about.installed', 'Installed on this device')}: ${new Date(record.dateInstalled).toLocaleString()}`;
        item.appendChild(installed);
      }
      list.appendChild(item);
    });
  }

  showAbout() {
    this.overlay.querySelector('.about-history').hidden = true;
    this.overlay.querySelector('.about-main').hidden = false;
    requestAnimationFrame(() => this.overlay.querySelector('[data-version-history-open]')?.focus());
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
        <div class="about-body"><div class="about-main">
          <div class="about-flute" aria-hidden="true"><img src="assets/images/krishna-flute.svg" alt=""><i class="about-note about-note-one">♪</i><i class="about-note about-note-two">♫</i><i class="about-note about-note-three">♩</i></div>
          <h2 id="about-title">About Gitaverse</h2>
          <p>Gitaverse is a verse and chanting experience from Gita Jyoti—a simple space to listen to, study and remain close to the Bhagavad Gita.</p>
          <div class="about-links"><a href="https://gitajyoti.org/" target="_blank" rel="noopener">Gita Jyoti</a><a href="https://lightoftheself.org/" target="_blank" rel="noopener">Light of the Self Foundation</a></div>
          <p class="about-version">Version <span data-about-version>dev</span></p></div>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  open(opener = document.activeElement) {
    this.showAbout();
    this.refresh();
    this.opener = opener;
    this.overlay.hidden = false;
    this.onOpen();
    requestAnimationFrame(() => this.overlay.querySelector('[data-about-close]')?.focus());
  }

  close({ restoreFocus = true } = {}) {
    if (this.overlay.hidden) return false;
    this.overlay.hidden = true;
    this.showAbout();
    if (restoreFocus) this.opener?.focus?.();
    return true;
  }
}
