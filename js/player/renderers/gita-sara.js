import { createMediaPlayer } from '../media-player.js';
import { createTextPlayer } from '../text-player.js';

const TEXT_FIELDS = [
  { role: 'shloka', field: () => 'source.shloka', language: () => 'sa' },
  { role: 'transliteration', field: (language) => `languages.${language}.transliteration`, language: (language) => language },
  { role: 'meaning', field: (language) => `languages.${language}.meaning`, language: (language) => language },
  { role: 'word', field: (language) => `languages.${language}.wordByWordMeaning`, language: (language) => language }
];

function fieldValue(row, field) { return field.split('.').reduce((value, part) => value && value[part], row) || ''; }

export function createGitaSaraRenderer({ translate = (_key, fallback) => fallback } = {}) {
  let root;
  let editing = false;
  let renderedSid = '';
  const mediaPlayer = createMediaPlayer({ translate });
  const textPlayer = createTextPlayer({ translate });

  function mount(container) {
    root = container;
    root.classList.add('gita-sara-root');
    root.innerHTML = `
      <div class="gita-sara-layout">
        <article class="gita-sara-panel gita-sara-text-panel" data-sara-panel="text">
          <div class="gita-sara-text gita-sara-shloka" data-role="shloka"></div>
          <div class="gita-sara-text gita-sara-transliteration" data-role="transliteration"></div>
          <div class="gita-sara-text gita-sara-meaning" data-role="meaning"></div>
          <div class="gita-sara-text gita-sara-word" data-role="word"></div>
        </article>
        <section class="gita-sara-panel gita-sara-media-panel" data-sara-panel="media" aria-label="${translate('gitaSara.media', 'Illustration')}">
          <div class="gita-sara-media-stage" data-role="media-stage"></div>
          <p class="gita-sara-media-caption" data-role="media-caption" hidden></p>
          <button class="gita-sara-corner-nav previous" type="button" data-media-action="previous" aria-label="${translate('gitaSara.previousMedia', 'Previous illustration')}">‹</button>
          <button class="gita-sara-corner-nav next" type="button" data-media-action="next" aria-label="${translate('gitaSara.nextMedia', 'Next illustration')}">›</button>
        </section>
        <section class="gita-sara-panel gita-sara-question-panel" data-sara-panel="questions" aria-label="${translate('gitaSara.questions', 'Contemplation questions')}">
          <button class="gita-sara-question-toggle" type="button" data-text-action="toggle-all" aria-label="${translate('gitaSara.showAllQuestions', 'Show all questions')}" aria-pressed="false">✦</button>
          <div class="gita-sara-question-stage" data-role="question-stage"></div>
          <button class="gita-sara-corner-nav previous" type="button" data-text-action="previous" aria-label="${translate('gitaSara.previousQuestion', 'Previous question')}">‹</button>
          <button class="gita-sara-corner-nav next" type="button" data-text-action="next" aria-label="${translate('gitaSara.nextQuestion', 'Next question')}">›</button>
        </section>
      </div>`;
    mediaPlayer.mount(root.querySelector('[data-sara-panel="media"]'));
    textPlayer.mount(root.querySelector('[data-sara-panel="questions"]'));
  }

  function makeEditable(element) {
    element.contentEditable = 'true'; element.spellcheck = false; element.dataset.editField = element.dataset.field;
    element.classList.remove('empty'); if (element.textContent === '—') element.textContent = '';
  }

  function render(row, contentLanguage) {
    const reset = renderedSid !== row.sid;
    renderedSid = row.sid;
    const language = contentLanguage === 'kn' ? 'kn' : 'en';
    TEXT_FIELDS.forEach((specification) => {
      const field = specification.field(language);
      const element = root.querySelector(`[data-role="${specification.role}"]`);
      const text = fieldValue(row, field);
      element.dataset.field = field; element.lang = specification.language(language); element.textContent = text || '—';
      element.classList.toggle('empty', !text); if (editing) makeEditable(element);
    });
    mediaPlayer.render(row.media?.items || [], language, reset);
    textPlayer.render(row.contemplation?.lines || [], language, reset);
    if (!editing) requestAnimationFrame(fitText);
  }

  function setEditing(enabled) {
    editing = enabled;
    root.querySelectorAll('[data-field]').forEach((element) => {
      if (enabled) makeEditable(element); else { element.contentEditable = 'false'; delete element.dataset.editField; }
    });
    if (!enabled) requestAnimationFrame(fitText);
  }

  function editableElements() { return Array.from(root.querySelectorAll('[data-edit-field]')); }
  function fitElement(role, maximum, minimum) {
    const element = root.querySelector(`[data-role="${role}"]`);
    if (!element?.clientHeight || getComputedStyle(element).display === 'none') return;
    let low = minimum; let high = maximum; let best = minimum;
    while (low <= high) {
      const size = Math.floor((low + high) / 2); element.style.fontSize = `${size}px`;
      if (element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1) { best = size; low = size + 1; } else high = size - 1;
    }
    element.style.fontSize = `${best}px`;
  }
  function fitText() {
    if (editing || !root) return;
    root.querySelectorAll('[data-field]').forEach((element) => { element.style.fontSize = ''; });
    if (matchMedia('(max-width: 760px)').matches || globalThis.document?.documentElement?.classList.contains('mobile-layout')) return;
    fitElement('shloka', 26, 13); fitElement('transliteration', 17, 10); fitElement('meaning', 20, 11); fitElement('word', 14, 9);
  }

  return {
    id: 'gita-sara', mount, render, setEditing, editableElements, fitText,
    additionalEditableElements: () => [], collectAdditionalEdits: () => ({ changes: [], files: [] }), refreshAdditionalData() {},
    destroy() { if (root) { root.classList.remove('gita-sara-root'); root.textContent = ''; } root = null; }
  };
}
