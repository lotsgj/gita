export function createMediaPlayer({ translate = (_key, fallback) => fallback } = {}) {
  let panel;
  let items = [];
  let index = 0;
  let language = 'en';

  function mount(container) {
    panel = container;
    panel.querySelector('[data-media-action="previous"]').addEventListener('click', () => select(index - 1));
    panel.querySelector('[data-media-action="next"]').addEventListener('click', () => select(index + 1));
  }

  function select(next) {
    if (items.length < 2) return;
    index = (next + items.length) % items.length;
    paint();
  }

  function paint() {
    if (!panel) return;
    const stage = panel.querySelector('[data-role="media-stage"]');
    const caption = panel.querySelector('[data-role="media-caption"]');
    const previous = panel.querySelector('[data-media-action="previous"]');
    const next = panel.querySelector('[data-media-action="next"]');
    stage.innerHTML = '';
    const item = items[index];
    previous.hidden = items.length < 2;
    next.hidden = items.length < 2;
    caption.hidden = true;
    caption.textContent = '';
    if (!item) return;
    if (item.mediaType === 'image') {
      const image = document.createElement('img');
      const localized = item.localized?.[language] || item.localized?.en || {};
      image.className = 'gita-sara-media-image';
      image.src = item.resolvedUrl || item.imageUrl;
      image.alt = localized.altText || '';
      image.addEventListener('error', () => {
        stage.innerHTML = `<p class="gita-sara-media-error">${translate('gitaSara.mediaUnavailable', 'Illustration unavailable')}</p>`;
      }, { once: true });
      stage.appendChild(image);
      if (localized.caption) {
        caption.textContent = localized.caption;
        caption.hidden = false;
      }
    } else if (item.mediaType === 'google_deck') {
      const frame = document.createElement('iframe');
      frame.className = 'gita-sara-deck-frame';
      frame.src = item.resolvedUrl || item.embedUrl;
      frame.title = item.title || translate('gitaSara.deckTitle', 'Presentation');
      frame.loading = 'eager';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      stage.appendChild(frame);
    }
  }

  return {
    mount,
    render(nextItems, nextLanguage, reset = false) {
      items = nextItems || [];
      language = nextLanguage === 'kn' ? 'kn' : 'en';
      if (reset || index >= items.length) index = 0;
      paint();
    },
    select,
    currentIndex: () => index
  };
}
