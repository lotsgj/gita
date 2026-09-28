import test from 'node:test';
import assert from 'node:assert/strict';
import { createGita700Renderer } from '../../js/player2/renderers/gita-700.js';

function element() {
  return { dataset: {}, textContent: '', classList: { toggle() {}, remove() {} }, style: {}, clientHeight: 0, clientWidth: 0 };
}

function rootFixture() {
  const roles = new Map();
  const panels = new Map();
  return {
    set innerHTML(value) {
      for (const match of value.matchAll(/data-role="([^"]+)"/g)) roles.set(match[1], element());
      for (const match of value.matchAll(/data-panel="([^"]+)"/g)) panels.set(match[1], element());
    },
    querySelector(selector) {
      const match = selector.match(/^\[data-(role|panel)="([^"]+)"\]$/);
      return match ? (match[1] === 'role' ? roles : panels).get(match[2]) : null;
    },
    querySelectorAll() { return Array.from(roles.values()); },
    get(role) { return roles.get(role); },
    set textContent(_value) { roles.clear(); panels.clear(); }
  };
}

globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
globalThis.matchMedia = () => ({ matches: false });

test('player2 renderer reads the normalized semantic model', () => {
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
