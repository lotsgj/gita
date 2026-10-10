export function createTextPlayer({ translate = (_key, fallback) => fallback } = {}) {
  let panel;
  let lines = [];
  let index = 0;
  let language = 'en';
  let showAll = false;

  function mount(container) {
    panel = container;
    panel.querySelector('[data-text-action="previous"]').addEventListener('click', () => select(index - 1));
    panel.querySelector('[data-text-action="next"]').addEventListener('click', () => select(index + 1));
    panel.querySelector('[data-text-action="toggle-all"]').addEventListener('click', () => {
      showAll = !showAll;
      paint();
    });
  }

  function select(next) {
    if (showAll || lines.length < 2) return;
    index = (next + lines.length) % lines.length;
    paint();
  }

  function paint() {
    if (!panel) return;
    const stage = panel.querySelector('[data-role="question-stage"]');
    const toggle = panel.querySelector('[data-text-action="toggle-all"]');
    const previous = panel.querySelector('[data-text-action="previous"]');
    const next = panel.querySelector('[data-text-action="next"]');
    if (lines.length <= 1) showAll = false;
    const visible = showAll ? lines : lines.slice(index, index + 1);
    stage.replaceChildren(...visible.map((line) => {
      const item = document.createElement('p');
      item.textContent = line.localized?.[language] || line.localized?.en || '';
      return item;
    }));
    stage.classList.toggle('show-all', showAll);
    toggle.setAttribute('aria-pressed', String(showAll));
    toggle.setAttribute('aria-label', showAll ? translate('gitaSara.showOneQuestion', 'Show one question') : translate('gitaSara.showAllQuestions', 'Show all questions'));
    toggle.hidden = lines.length < 2;
    previous.hidden = showAll || lines.length < 2;
    next.hidden = showAll || lines.length < 2;
  }

  return {
    mount,
    render(nextLines, nextLanguage, reset = false) {
      lines = nextLines || [];
      language = nextLanguage === 'kn' ? 'kn' : 'en';
      if (reset || index >= lines.length) { index = 0; showAll = false; }
      paint();
    },
    select,
    currentIndex: () => index,
    showingAll: () => showAll
  };
}
