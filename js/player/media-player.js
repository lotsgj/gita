export function createMediaPlayer({ translate = (_key, fallback) => fallback } = {}) {
  let panel;
  let items = [];
  let index = 0;
  let language = 'en';
  let paintVersion = 0;

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
    const version = ++paintVersion;
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
    if (item.mediaType === 'image' || item.mediaType === 'animated_image') {
      const image = document.createElement('img');
      image.className = 'gita-sara-media-image';
      let activeItem = item;
      const paintMetadata = () => {
        const localized = activeItem.localized?.[language] || activeItem.localized?.en || {};
        image.alt = localized.altText || '';
        caption.textContent = localized.caption || '';
        caption.hidden = !localized.caption;
      };
      const sourceFor = (candidate) => candidate?.resolvedUrl || candidate?.imageUrl || '';
      const showFallback = () => {
        if (version !== paintVersion) return;
        if (activeItem === item && item.fallback) {
          activeItem = item.fallback;
          paintMetadata();
          const fallbackSource = sourceFor(activeItem);
          image.src = fallbackSource;
          return;
        }
        stage.innerHTML = `<p class="gita-sara-media-error">${translate('gitaSara.mediaUnavailable', 'Illustration unavailable')}</p>`;
      };
      image.addEventListener('error', () => {
        showFallback();
      });
      stage.appendChild(image);
      if (!item.resolvedUrl && item.fallback) activeItem = item.fallback;
      paintMetadata();
      const source = sourceFor(activeItem);
      const requiresAvailabilityCheck = activeItem === item && !item.isExternal && source && !/^(blob:|data:)/i.test(source);
      if (requiresAvailabilityCheck) {
        fetch(source, { method: 'HEAD' })
          .then((response) => {
            if (version !== paintVersion) return;
            if (response.ok) image.src = source;
            else showFallback();
          })
          .catch(showFallback);
      } else if (source) image.src = source;
      else showFallback();
    } else if (item.mediaType === 'google_deck') {
      const frame = document.createElement('iframe');
      frame.className = 'gita-sara-deck-frame';
      frame.src = item.resolvedUrl || item.embedUrl;
      frame.title = item.title || translate('gitaSara.deckTitle', 'Presentation');
      frame.loading = 'eager';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      stage.appendChild(frame);
    } else if (item.mediaType === 'video') {
      stage.innerHTML = `<p class="gita-sara-media-error">${translate('gitaSara.videoComing', 'Video support is coming')}</p>`;
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
