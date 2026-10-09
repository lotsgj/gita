const FIELDS = [
  { role: 'shloka', field: 'source.shloka', language: 'sa' },
  { role: 'sanskrit-words', field: 'source.wordByWord', language: 'sa' },
  { role: 'kn-transliteration', field: 'languages.kn.transliteration', language: 'kn' },
  { role: 'kn-meaning', field: 'languages.kn.meaning', language: 'kn' },
  { role: 'kn-words', field: 'languages.kn.wordByWordMeaning', language: 'kn' },
  { role: 'en-transliteration', field: 'languages.en.transliteration', language: 'en' },
  { role: 'en-meaning', field: 'languages.en.meaning', language: 'en' },
  { role: 'en-words', field: 'languages.en.wordByWordMeaning', language: 'en' }
];

function fieldValue(row, field) {
  return field.split('.').reduce((value, part) => value && value[part], row) || '';
}

export function createGitaYogaRenderer() {
  let root;
  let editing = false;

  function mount(container) {
    root = container;
    root.classList.add('gita-yoga-root');
    root.innerHTML = '<div class="gita-yoga-panels">' +
      '<div class="gita-yoga-panel gita-yoga-sanskrit" data-language-panel="sa" aria-hidden="true"></div>' +
      '<div class="gita-yoga-panel gita-yoga-language-panel gita-yoga-kn" data-language-panel="kn" aria-hidden="true"></div>' +
      '<div class="gita-yoga-panel gita-yoga-language-panel gita-yoga-en" data-language-panel="en" aria-hidden="true"></div>' +
      '<div class="gita-yoga-field gita-yoga-sanskrit-words" data-role="sanskrit-words"></div>' +
      '<div class="gita-yoga-field gita-yoga-shloka" data-role="shloka"></div>' +
      '<div class="gita-yoga-field gita-yoga-transliteration gita-yoga-kn-content" data-role="kn-transliteration"></div>' +
      '<div class="gita-yoga-field gita-yoga-meaning gita-yoga-lower-content gita-yoga-kn-content" data-role="kn-meaning"></div>' +
      '<div class="gita-yoga-field gita-yoga-word-meaning gita-yoga-lower-content gita-yoga-kn-content" data-role="kn-words"></div>' +
      '<div class="gita-yoga-field gita-yoga-transliteration gita-yoga-en-content" data-role="en-transliteration"></div>' +
      '<div class="gita-yoga-field gita-yoga-meaning gita-yoga-lower-content gita-yoga-en-content" data-role="en-meaning"></div>' +
      '<div class="gita-yoga-field gita-yoga-word-meaning gita-yoga-lower-content gita-yoga-en-content" data-role="en-words"></div>' +
    '</div>';
  }

  function makeEditable(element) {
    element.contentEditable = 'true';
    element.spellcheck = false;
    element.dataset.editField = element.dataset.field;
    element.classList.remove('empty');
    if (element.textContent === '—') element.textContent = '';
  }

  function render(row, contentLanguage) {
    FIELDS.forEach(({ role, field, language }) => {
      const element = root.querySelector('[data-role="' + role + '"]');
      const text = fieldValue(row, field);
      element.dataset.field = field;
      element.lang = language;
      element.textContent = text || '—';
      element.classList.toggle('empty', !text);
      if (editing) makeEditable(element);
    });
    const primary = contentLanguage === 'kn' ? 'kn' : 'en';
    root.dataset.primaryLanguage = primary;
    if (!editing) requestAnimationFrame(fitText);
  }

  function setEditing(enabled) {
    editing = enabled;
    root.querySelectorAll('[data-role]').forEach((element) => {
      if (enabled) makeEditable(element);
      else {
        element.contentEditable = 'false';
        delete element.dataset.editField;
      }
    });
    if (!enabled) requestAnimationFrame(fitText);
  }

  function editableElements() {
    return Array.from(root.querySelectorAll('[data-edit-field]'));
  }

  function fitGroup(specifications) {
    const entries = specifications.map(({ role, max, min }) => ({
      element: root.querySelector('[data-role="' + role + '"]'), max, min
    })).filter(({ element }) => element && element.clientHeight && getComputedStyle(element).display !== 'none');
    const applyScale = (scale) => entries.forEach(({ element, max, min }) => {
      element.style.fontSize = Math.max(min, Math.floor(max * scale)) + 'px';
    });
    if (!entries.length) return;
    const fits = () => entries.every(({ element }) =>
      element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1
    );
    let low = 40;
    let high = 100;
    let best = 40;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      applyScale(middle / 100);
      if (fits()) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    applyScale(best / 100);
  }

  function fitText() {
    if (editing || !root) return;
    const allText = root.querySelectorAll('[data-role]');
    allText.forEach((element) => { element.style.fontSize = ''; });
    if (matchMedia('(max-width: 760px)').matches || globalThis.document?.documentElement.classList.contains('mobile-layout')) return;
    fitGroup([
      { role: 'sanskrit-words', max: 19, min: 11 },
      { role: 'shloka', max: 27, min: 14 },
      { role: 'kn-transliteration', max: 22, min: 12 },
      { role: 'en-transliteration', max: 22, min: 12 }
    ]);
    ['kn', 'en'].forEach((language) => fitGroup([
      { role: language + '-meaning', max: 21, min: 12 },
      { role: language + '-words', max: 17, min: 10 }
    ]));
  }

  return {
    id: 'gita-yoga',
    mount,
    render,
    setEditing,
    editableElements,
    fitText,
    destroy() {
      if (root) {
        root.classList.remove('gita-yoga-root');
        root.textContent = '';
      }
      root = null;
    }
  };
}
