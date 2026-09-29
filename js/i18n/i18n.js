import { EN_MESSAGES } from './en.js';
import { KN_MESSAGES } from './kn.js';

export const SUPPORTED_INTERFACE_LANGUAGES = new Set(['en', 'kn']);
export const MESSAGE_CATALOGS = { en: EN_MESSAGES, kn: KN_MESSAGES };

export class I18n {
  constructor(language = 'en') { this.language = SUPPORTED_INTERFACE_LANGUAGES.has(language) ? language : 'en'; }
  setLanguage(language) {
    this.language = SUPPORTED_INTERFACE_LANGUAGES.has(language) ? language : 'en';
    document.documentElement.lang = this.language;
    this.apply();
  }
  t(key, values = {}) {
    const template = MESSAGE_CATALOGS[this.language][key] ?? EN_MESSAGES[key] ?? key;
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll('{' + name + '}', value), template);
  }
  apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = this.t(element.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria]').forEach((element) => element.setAttribute('aria-label', this.t(element.dataset.i18nAria)));
    root.querySelectorAll('[data-i18n-title]').forEach((element) => element.setAttribute('title', this.t(element.dataset.i18nTitle)));
  }
}
