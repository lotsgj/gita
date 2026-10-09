import test from 'node:test';
import assert from 'node:assert/strict';
import { createGita700Renderer } from '../../js/player/renderers/gita-700.js';
import { createGitaYogaRenderer } from '../../js/player/renderers/gita-yoga.js';

function element() {
  return { dataset: {}, textContent: '', classList: { toggle() {}, remove() {} }, style: {}, clientHeight: 0, clientWidth: 0 };
}

function rootFixture() {
  const roles = new Map();
  const panels = new Map();
  const languagePanels = new Map();
  const rootClasses = new Set();
  return {
    dataset: {},
    classList: { add: (...values) => values.forEach((value) => rootClasses.add(value)), remove: (...values) => values.forEach((value) => rootClasses.delete(value)) },
    set innerHTML(value) {
      for (const match of value.matchAll(/data-role="([^"]+)"/g)) roles.set(match[1], element());
      for (const match of value.matchAll(/data-panel="([^"]+)"/g)) panels.set(match[1], element());
      for (const match of value.matchAll(/data-language-panel="([^"]+)"/g)) languagePanels.set(match[1], element());
    },
    querySelector(selector) {
      const match = selector.match(/^\[data-(role|panel|language-panel)="([^"]+)"\]$/);
      if (!match) return null;
      return (match[1] === 'role' ? roles : match[1] === 'panel' ? panels : languagePanels).get(match[2]);
    },
    querySelectorAll(selector) {
      const values = Array.from(roles.values());
      if (selector === '[data-edit-field]') return values.filter((value) => value.dataset.editField);
      return values;
    },
    get(role) { return roles.get(role); },
    getLanguagePanel(language) { return languagePanels.get(language); },
    hasClass(value) { return rootClasses.has(value); },
    set textContent(_value) { roles.clear(); panels.clear(); languagePanels.clear(); }
  };
}

globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
globalThis.matchMedia = () => ({ matches: false });

test('the player renderer reads the normalized semantic model', () => {
  const root = rootFixture();
  const renderer = createGita700Renderer();
  renderer.mount(root);
  renderer.render({
    source: { shloka: 'संस्कृतम्' },
    languages: {
      en: { meaning: 'English meaning', transliteration: 'transliteration', wordByWordMeaning: 'word — meaning' },
      kn: { meaning: 'ಕನ್ನಡ ಅರ್ಥ', transliteration: 'ಕನ್ನಡ ಲಿಪ್ಯಂತರ', wordByWordMeaning: 'ಪದ — ಅರ್ಥ' }
    }
  }, 'kn');
  assert.equal(root.get('shloka').dataset.field, 'source.shloka');
  assert.equal(root.get('shloka').textContent, 'संस्कृतम्');
  assert.equal(root.get('meaning').dataset.field, 'languages.kn.meaning');
  assert.equal(root.get('meaning').textContent, 'ಕನ್ನಡ ಅರ್ಥ');
  assert.equal(root.get('transliteration').textContent, 'ಕನ್ನಡ ಲಿಪ್ಯಂತರ');
  assert.equal(root.get('word').textContent, 'ಪದ — ಅರ್ಥ');
});

test('the Gita-Yoga renderer shows all languages and orders them by content preference', () => {
  const root = rootFixture();
  const renderer = createGitaYogaRenderer();
  renderer.mount(root);
  renderer.render({
    source: { shloka: 'संस्कृतम्', wordByWord: 'संस्कृत · पदानि' },
    languages: {
      en: { meaning: 'English meaning', transliteration: 'English transliteration', wordByWordMeaning: 'word — meaning' },
      kn: { meaning: 'ಕನ್ನಡ ಅರ್ಥ', transliteration: 'ಕನ್ನಡ ಲಿಪ್ಯಂತರ', wordByWordMeaning: 'ಪದ — ಅರ್ಥ' }
    }
  }, 'kn');
  assert.equal(root.hasClass('gita-yoga-root'), true);
  assert.equal(root.get('shloka').dataset.field, 'source.shloka');
  assert.equal(root.get('sanskrit-words').textContent, 'संस्कृत · पदानि');
  assert.equal(root.get('kn-transliteration').textContent, 'ಕನ್ನಡ ಲಿಪ್ಯಂತರ');
  assert.equal(root.get('en-meaning').textContent, 'English meaning');
  assert.equal(root.dataset.primaryLanguage, 'kn');
  renderer.render({
    source: { shloka: 'संस्कृतम्', wordByWord: '' },
    languages: {
      en: { meaning: 'English meaning', transliteration: 'English transliteration', wordByWordMeaning: 'word — meaning' },
      kn: { meaning: 'ಕನ್ನಡ ಅರ್ಥ', transliteration: 'ಕನ್ನಡ ಲಿಪ್ಯಂತರ', wordByWordMeaning: 'ಪದ — ಅರ್ಥ' }
    }
  }, 'en');
  assert.equal(root.dataset.primaryLanguage, 'en');
  assert.equal(root.get('sanskrit-words').textContent, '—');
  renderer.setEditing(true);
  assert.equal(renderer.editableElements().length, 8);
  assert.deepEqual(new Set(renderer.editableElements().map((element) => element.dataset.editField)), new Set([
    'source.shloka',
    'source.wordByWord',
    'languages.kn.transliteration',
    'languages.kn.meaning',
    'languages.kn.wordByWordMeaning',
    'languages.en.transliteration',
    'languages.en.meaning',
    'languages.en.wordByWordMeaning'
  ]));
  assert.equal(root.get('sanskrit-words').textContent, '');
});
