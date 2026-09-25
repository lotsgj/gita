import { languageField, value } from '../master-data.js';

const PANELS = [
  { role: 'shloka', panelClass: 'shloka', max: [42, 36], min: 10 },
  { role: 'meaning', panelClass: 'meaning', max: [31, 27], min: 10 },
  { role: 'transliteration', panelClass: 'transliteration', max: [30, 27], min: 10 },
  { role: 'word', panelClass: 'word', max: [22, 19], min: 9 }
];

export function createGita700Renderer() {
  let root;
  let editing = false;

  function fieldFor(role, language) {
    if (role === 'shloka') return 'shloka_sa';
    if (role === 'word') return languageField('word_by_word_meaning', language);
    return languageField(role, language);
  }

  function mount(container) {
    root = container;
    root.innerHTML = '<div class="gita-700-panels">' + PANELS.map((panel) =>
      '<article class="gita-700-panel gita-700-panel-' + panel.panelClass + '">' +
        '<div class="gita-700-panel-content" data-panel="' + panel.role + '">' +
          '<div class="gita-700-text" data-role="' + panel.role + '"></div>' +
        '</div>' +
      '</article>'
    ).join('') + '</div>';
  }

  function render(row, language) {
    PANELS.forEach((panel) => {
      const field = fieldFor(panel.role, language);
      const element = root.querySelector('[data-role="' + panel.role + '"]');
      const text = value(row, [field]);
      element.dataset.field = field;
      element.textContent = text || '—';
      element.classList.toggle('empty', !text);
      if (editing) makeEditable(element);
    });
    if (!editing) requestAnimationFrame(fitText);
  }

  function makeEditable(element) {
    element.contentEditable = 'true';
    element.spellcheck = false;
    element.dataset.editField = element.dataset.field;
    element.classList.remove('empty');
    if (element.textContent === '—') element.textContent = '';
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

  function fitElement(panel, text, maxSize, minSize) {
    if (!panel || !text || !panel.clientHeight) return;
    let low = minSize;
    let high = maxSize;
    let best = minSize;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      text.style.fontSize = middle + 'px';
      if (text.scrollHeight <= panel.clientHeight - 4 && text.scrollWidth <= panel.clientWidth - 4) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    text.style.fontSize = best + 'px';
  }

  function fitText() {
    if (editing || !root) return;
    const mobile = matchMedia('(max-width: 760px)').matches;
    PANELS.forEach((panel) => {
      fitElement(
        root.querySelector('[data-panel="' + panel.role + '"]'),
        root.querySelector('[data-role="' + panel.role + '"]'),
        panel.max[mobile ? 1 : 0],
        panel.min
      );
    });
  }

  return {
    id: 'gita-700',
    audioField: 'audio_gita_700',
    mount,
    render,
    setEditing,
    editableElements,
    fitText,
    destroy() { if (root) root.textContent = ''; root = null; }
  };
}
