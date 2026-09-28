import test from 'node:test';
import assert from 'node:assert/strict';
import { createGita700Renderer } from '../../js/renderers/gita-700.js';

function element() {
  return {
    dataset: {},
    textContent: '',
    classList: { toggle() {}, remove() {} },
    style: {},
    clientHeight: 0,
    clientWidth: 0,
    scrollHeight: 0,
    scrollWidth: 0
  };
}

function rootFixture() {
  const roles = new Map();
  const panels = new Map();
  return {
    set innerHTML(value) {
      for (const role of value.matchAll(/data-role="([^"]+)"/g)) roles.set(role[1], element());
      for (const role of value.matchAll(/data-panel="([^"]+)"/g)) panels.set(role[1], element());
    },
    querySelector(selector) {
      const match = selector.match(/^\[data-(role|panel)="([^"]+)"\]$/);
      if (!match) return null;
      return (match[1] === 'role' ? roles : panels).get(match[2]);
    },
    querySelectorAll() { return Array.from(roles.values()); },
    get(role) { return roles.get(role); },
    set textContent(_value) { roles.clear(); panels.clear(); }
  };
}

globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
globalThis.matchMedia = () => ({ matches: false });

test('current Gita-700 renderer maps its four panels to the established fields', () => {
  const root = rootFixture();
  const renderer = createGita700Renderer();
  renderer.mount(root);
  renderer.render({
    shloka_sa: 'संस्कृतम्',
    meaning_en: 'English meaning',
    shloka_transliteration_en: 'transliteration',
    word_by_word_meaning_en: 'word — meaning',
    meaning_kn: 'ಕನ್ನಡ ಅರ್ಥ',
    shloka_transliteration_kn: 'ಕನ್ನಡ ಲಿಪ್ಯಂತರ',
    word_by_word_meaning_kn: 'ಪದ — ಅರ್ಥ'
  }, 'en');

  assert.equal(renderer.audioField, 'audio_gita_700');
  assert.equal(root.get('shloka').dataset.field, 'shloka_sa');
  assert.equal(root.get('shloka').textContent, 'संस्कृतम्');
  assert.equal(root.get('meaning').textContent, 'English meaning');
  assert.equal(root.get('transliteration').textContent, 'transliteration');
  assert.equal(root.get('word').textContent, 'word — meaning');

  renderer.render({
    shloka_sa: 'संस्कृतम्',
    meaning_kn: 'ಕನ್ನಡ ಅರ್ಥ',
    shloka_transliteration_kn: 'ಕನ್ನಡ ಲಿಪ್ಯಂತರ',
    word_by_word_meaning_kn: 'ಪದ — ಅರ್ಥ'
  }, 'kn');
  assert.equal(root.get('meaning').dataset.field, 'meaning_kn');
  assert.equal(root.get('meaning').textContent, 'ಕನ್ನಡ ಅರ್ಥ');
  assert.equal(root.get('transliteration').textContent, 'ಕನ್ನಡ ಲಿಪ್ಯಂತರ');
  assert.equal(root.get('word').textContent, 'ಪದ — ಅರ್ಥ');
});
