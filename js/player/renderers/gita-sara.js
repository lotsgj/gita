import { createMediaPlayer } from '../media-player.js';
import { createTextPlayer } from '../text-player.js';
import { normalizeGoogleDeckUrl, normalizeImageUrl } from '../collection-data.js';

const TEXT_FIELDS = [
  { role: 'shloka', field: () => 'source.shloka', language: () => 'sa' },
  { role: 'transliteration', field: (language) => `languages.${language}.transliteration`, language: (language) => language },
  { role: 'meaning', field: (language) => `languages.${language}.meaning`, language: (language) => language },
  { role: 'word', field: (language) => `languages.${language}.wordByWordMeaning`, language: (language) => language }
];

function fieldValue(row, field) { return field.split('.').reduce((value, part) => value && value[part], row) || ''; }

export function createGitaSaraRenderer({ translate = (_key, fallback) => fallback, gitaSaraView = 'three_panel', onGitaSaraViewChange = () => {} } = {}) {
  let root;
  let editing = false;
  let renderedSid = '';
  let renderedRow = null;
  let mediaDraft = [];
  let questionDraft = [];
  let draftBaseline = '';
  let fallbackMedia = null;
  let fallbackQuestion = null;
  let editingLanguage = 'en';
  let activeMediaIndex = 0;
  let activeQuestionIndex = 0;
  let questionsVisible = gitaSaraView !== 'two_panel';
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
          <div class="gita-sara-collection-editor" data-role="media-editor" hidden></div>
        </section>
        <section class="gita-sara-panel gita-sara-question-panel" data-sara-panel="questions" aria-label="${translate('gitaSara.questions', 'Contemplation questions')}">
          <button class="gita-sara-question-toggle" type="button" data-text-action="toggle-all" aria-label="${translate('gitaSara.showAllQuestions', 'Show all questions')}" aria-pressed="false">✦</button>
          <div class="gita-sara-question-stage" data-role="question-stage"></div>
          <button class="gita-sara-corner-nav previous" type="button" data-text-action="previous" aria-label="${translate('gitaSara.previousQuestion', 'Previous question')}">‹</button>
          <button class="gita-sara-corner-nav next" type="button" data-text-action="next" aria-label="${translate('gitaSara.nextQuestion', 'Next question')}">›</button>
          <div class="gita-sara-collection-editor" data-role="question-editor" hidden></div>
        </section>
      </div>`;
    mediaPlayer.mount(root.querySelector('[data-sara-panel="media"]'));
    textPlayer.mount(root.querySelector('[data-sara-panel="questions"]'));
    const mediaEditor = root.querySelector('[data-role="media-editor"]');
    const questionEditor = root.querySelector('[data-role="question-editor"]');
    mediaEditor.addEventListener('click', handleMediaAction);
    questionEditor.addEventListener('click', handleQuestionAction);
    mediaEditor.addEventListener('input', (event) => { updateMediaPreview(event); markDirty(mediaEditor); });
    questionEditor.addEventListener('input', () => markDirty(questionEditor));
    mediaEditor.addEventListener('change', handleMediaFile);
    applyQuestionView();
  }

  function applyQuestionView() {
    if (!root) return;
    const questionPanel = root.querySelector('[data-sara-panel="questions"]');
    root.classList.toggle('gita-sara-questions-hidden', !questionsVisible);
    questionPanel.hidden = !questionsVisible;
    if (!editing) requestAnimationFrame(fitText);
  }

  function toggleQuestions() {
    if (editing || !root) return false;
    questionsVisible = !questionsVisible;
    applyQuestionView();
    onGitaSaraViewChange(questionsVisible ? 'three_panel' : 'two_panel');
    return true;
  }

  const clean = (value) => String(value ?? '').replace(/\r/g, '');
  const html = (value) => clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  function markDirty(container) {
    const field = root.querySelector('[data-edit-field]') || container.querySelector('input, textarea, select');
    if (field) field.dispatchEvent(new Event('input'));
  }
  function readMediaDraft() {
    return Array.from(root.querySelectorAll('[data-media-edit-row]')).map((entry, index) => {
      const current = { ...(mediaDraft[index] || {}), order: index + 1 };
      const type = entry.querySelector('[data-media-field="type"]');
      if (!type) return current;
      return {
        ...current, mediaType: type.value,
        url: clean(entry.querySelector('[data-media-field="url"]').value),
        title: clean(entry.querySelector('[data-media-field="title"]').value),
        [editingLanguage === 'kn' ? 'altKn' : 'altEn']: clean(entry.querySelector('[data-media-field="alt"]').value),
        [editingLanguage === 'kn' ? 'captionKn' : 'captionEn']: clean(entry.querySelector('[data-media-field="caption"]').value)
      };
    });
  }
  function readQuestionDraft() {
    return Array.from(root.querySelectorAll('[data-question-edit-row]')).map((entry, index) => {
      const current = { ...(questionDraft[index] || {}), order: index + 1 };
      const text = entry.querySelector('[data-question-field="text"]');
      return text ? { ...current, [editingLanguage]: clean(text.value) } : current;
    });
  }
  function paintMediaEditor() {
    const editor = root.querySelector('[data-role="media-editor"]');
    editor.innerHTML = mediaDraft.map((item, index) => `<fieldset data-media-edit-row data-editor-card="${index}" class="${index === activeMediaIndex ? 'is-active' : ''}">
      <legend>${index + 1} / ${mediaDraft.length}</legend>
      <div class="gita-sara-edit-preview">${item.mediaType === 'google_deck'
        ? `<iframe src="${html(item.previewUrl || (() => { try { return normalizeGoogleDeckUrl(item.url); } catch { return ''; } })())}" title="${html(item.title)}"></iframe>`
        : `<img src="${html(item.previewUrl || item.url)}" alt="${html(editingLanguage === 'kn' ? item.altKn : item.altEn)}">`}</div>
      ${index === activeMediaIndex ? `<div class="gita-sara-card-actions"><button type="button" data-media-edit-action="up" aria-label="Move earlier">↑</button><button type="button" data-media-edit-action="down" aria-label="Move later">↓</button><button type="button" data-media-edit-action="remove">${translate('common.remove', 'Remove')}</button></div>
      <select data-media-field="type" aria-label="${translate('gitaSara.mediaType', 'Media type')}">
        <option value="image"${item.mediaType === 'image' ? ' selected' : ''}>${translate('gitaSara.image', 'Image')}</option>
        <option value="animated_image"${item.mediaType === 'animated_image' ? ' selected' : ''}>${translate('gitaSara.animatedImage', 'Animated image')}</option>
        <option value="google_deck"${item.mediaType === 'google_deck' ? ' selected' : ''}>${translate('gitaSara.googleDeck', 'Google Deck')}</option>
      </select>
      <input data-media-field="url" value="${html(item.url)}" placeholder="${translate('gitaSara.mediaUrl', 'Relative or HTTPS URL')}">
      <input data-media-field="title" value="${html(item.title)}" placeholder="${translate('gitaSara.title', 'Title')}">
      <input data-media-field="alt" lang="${editingLanguage}" value="${html(editingLanguage === 'kn' ? item.altKn : item.altEn)}" placeholder="${editingLanguage === 'kn' ? 'ಕನ್ನಡ ಪರ್ಯಾಯ ಪಠ್ಯ' : 'English alt text'}">
      <input data-media-field="caption" lang="${editingLanguage}" value="${html(editingLanguage === 'kn' ? item.captionKn : item.captionEn)}" placeholder="${editingLanguage === 'kn' ? 'ಕನ್ನಡ ಶೀರ್ಷಿಕೆ' : 'English caption'}">
      ${(item.mediaType === 'image' || item.mediaType === 'animated_image') ? `<input type="file" data-media-file accept="${item.mediaType === 'animated_image' ? 'image/gif' : 'image/webp'}" aria-label="${translate('gitaSara.chooseFile', 'Choose local media file')}">` : ''}
      ` : ''}
    </fieldset>`).join('') + `<button class="gita-sara-add-row" type="button" data-media-edit-action="add">＋ ${translate('gitaSara.addMedia', 'Add media')}</button>`;
  }
  function handleMediaFile(event) {
    const input = event.target.closest('[data-media-file]');
    if (!input?.files?.[0]) return;
    mediaDraft = readMediaDraft();
    const row = input.closest('[data-media-edit-row]');
    const index = Array.from(row.parentNode.querySelectorAll('[data-media-edit-row]')).indexOf(row);
    const file = input.files[0];
    const expected = mediaDraft[index].mediaType === 'animated_image' ? 'image/gif' : 'image/webp';
    if (file.type !== expected) { input.value = ''; window.alert(translate('gitaSara.fileType', 'Choose a WebP image or GIF matching the selected media type.')); return; }
    const extension = expected === 'image/gif' ? 'gif' : 'webp';
    if (mediaDraft[index].previewUrl?.startsWith('blob:')) URL.revokeObjectURL(mediaDraft[index].previewUrl);
    mediaDraft[index].file = file;
    mediaDraft[index].url = `data/collections/images/gita-sara-illustrations/${renderedRow.sid}-${index + 1}.${extension}`;
    mediaDraft[index].previewUrl = URL.createObjectURL(file);
    paintMediaEditor(); markDirty(root.querySelector('[data-role="media-editor"]'));
  }
  function updateMediaPreview(event) {
    const row = event.target.closest('[data-media-edit-row]');
    if (!row) return;
    const type = row.querySelector('[data-media-field="type"]').value;
    const url = row.querySelector('[data-media-field="url"]').value;
    const preview = row.querySelector('.gita-sara-edit-preview');
    if (!preview || event.target.matches('[data-media-file]')) return;
    if (event.target.matches('[data-media-field="type"]')) { mediaDraft = readMediaDraft(); paintMediaEditor(); return; }
    if (type === 'google_deck') {
      const frame = preview.querySelector('iframe');
      if (frame && event.target.matches('[data-media-field="url"]')) { try { frame.src = normalizeGoogleDeckUrl(url); } catch { frame.removeAttribute('src'); } }
    } else {
      const image = preview.querySelector('img');
      if (image && event.target.matches('[data-media-field="url"]')) image.src = url;
      if (image && event.target.matches('[data-media-field="alt"]')) image.alt = event.target.value;
    }
  }
  function paintQuestionEditor() {
    const editor = root.querySelector('[data-role="question-editor"]');
    editor.innerHTML = questionDraft.map((item, index) => `<fieldset data-question-edit-row data-editor-card="${index}" class="${index === activeQuestionIndex ? 'is-active' : ''}">
      <legend>${index + 1} / ${questionDraft.length}</legend>
      <p class="gita-sara-question-preview" lang="${editingLanguage}">${html(item[editingLanguage]) || '—'}</p>
      ${index === activeQuestionIndex ? `<div class="gita-sara-card-actions"><button type="button" data-question-edit-action="up" aria-label="Move earlier">↑</button><button type="button" data-question-edit-action="down" aria-label="Move later">↓</button><button type="button" data-question-edit-action="remove">${translate('common.remove', 'Remove')}</button></div>
      <textarea data-question-field="text" lang="${editingLanguage}" placeholder="${editingLanguage === 'kn' ? 'ಕನ್ನಡ' : 'English'}">${html(item[editingLanguage])}</textarea>` : ''}
    </fieldset>`).join('') + `<button class="gita-sara-add-row" type="button" data-question-edit-action="add">＋ ${translate('gitaSara.addQuestion', 'Add question')}</button>`;
  }
  function handleMediaAction(event) {
    const action = event.target.closest('[data-media-edit-action]')?.dataset.mediaEditAction;
    mediaDraft = readMediaDraft();
    const row = event.target.closest('[data-media-edit-row]');
    const index = row ? Array.from(row.parentNode.querySelectorAll('[data-media-edit-row]')).indexOf(row) : -1;
    if (!action && index >= 0) { if (activeMediaIndex !== index) { activeMediaIndex = index; paintMediaEditor(); } return; }
    if (!action) return;
    if (action === 'add') { mediaDraft.push({ mediaType: 'image', url: `data/collections/images/gita-sara-illustrations/${renderedRow.sid}-${mediaDraft.length + 1}.webp`, title: '', altEn: '', altKn: '', captionEn: '', captionKn: '' }); activeMediaIndex = mediaDraft.length - 1; }
    if (action === 'remove' && index >= 0) { mediaDraft.splice(index, 1); activeMediaIndex = Math.min(index, mediaDraft.length - 1); }
    if (action === 'up' && index > 0) { [mediaDraft[index - 1], mediaDraft[index]] = [mediaDraft[index], mediaDraft[index - 1]]; activeMediaIndex = index - 1; }
    if (action === 'down' && index >= 0 && index < mediaDraft.length - 1) { [mediaDraft[index + 1], mediaDraft[index]] = [mediaDraft[index], mediaDraft[index + 1]]; activeMediaIndex = index + 1; }
    paintMediaEditor(); markDirty(root.querySelector('[data-role="media-editor"]'));
  }
  function handleQuestionAction(event) {
    const action = event.target.closest('[data-question-edit-action]')?.dataset.questionEditAction;
    questionDraft = readQuestionDraft();
    const row = event.target.closest('[data-question-edit-row]');
    const index = row ? Array.from(row.parentNode.querySelectorAll('[data-question-edit-row]')).indexOf(row) : -1;
    if (!action && index >= 0) { if (activeQuestionIndex !== index) { activeQuestionIndex = index; paintQuestionEditor(); } return; }
    if (!action) return;
    if (action === 'add') { questionDraft.push({ en: '', kn: '' }); activeQuestionIndex = questionDraft.length - 1; }
    if (action === 'remove' && index >= 0) { questionDraft.splice(index, 1); activeQuestionIndex = Math.min(index, questionDraft.length - 1); }
    if (action === 'up' && index > 0) { [questionDraft[index - 1], questionDraft[index]] = [questionDraft[index], questionDraft[index - 1]]; activeQuestionIndex = index - 1; }
    if (action === 'down' && index >= 0 && index < questionDraft.length - 1) { [questionDraft[index + 1], questionDraft[index]] = [questionDraft[index], questionDraft[index + 1]]; activeQuestionIndex = index + 1; }
    paintQuestionEditor(); markDirty(root.querySelector('[data-role="question-editor"]'));
  }

  function prepareDrafts(row) {
    fallbackMedia = (row.media?.items || []).find((item) => item.isFallback) || (row.media?.items || []).find((item) => item.fallback)?.fallback || null;
    fallbackQuestion = row.contemplation?.fallback || (row.contemplation?.lines || []).find((item) => item.isFallback) || null;
    mediaDraft = (row.media?.items || []).filter((item) => !item.isFallback && !item.reserved).map((item) => ({
      original: item, mediaType: item.mediaType, url: item.sourceUrl || '', title: item.title || '',
      altEn: item.localized?.en?.altText || '', altKn: item.localized?.kn?.altText || '',
      captionEn: item.localized?.en?.caption || '', captionKn: item.localized?.kn?.caption || ''
    }));
    questionDraft = (row.contemplation?.lines || []).filter((item) => !item.isFallback).map((item) => ({ original: item, en: item.localized.en, kn: item.localized.kn }));
    activeMediaIndex = Math.max(0, Math.min(activeMediaIndex, mediaDraft.length - 1));
    activeQuestionIndex = Math.max(0, Math.min(activeQuestionIndex, questionDraft.length - 1));
    draftBaseline = JSON.stringify({ media: mediaDraft.map(({ original, ...item }) => item), questions: questionDraft.map(({ original, ...item }) => item) });
    paintMediaEditor(); paintQuestionEditor();
  }

  function makeEditable(element) {
    element.contentEditable = 'true'; element.spellcheck = false; element.dataset.editField = element.dataset.field;
    element.classList.remove('empty'); if (element.textContent === '—') element.textContent = '';
  }

  function render(row, contentLanguage) {
    const reset = renderedSid !== row.sid;
    if (reset) { activeMediaIndex = 0; activeQuestionIndex = 0; }
    renderedSid = row.sid;
    renderedRow = row;
    const language = contentLanguage === 'kn' ? 'kn' : 'en';
    editingLanguage = language;
    TEXT_FIELDS.forEach((specification) => {
      const field = specification.field(language);
      const element = root.querySelector(`[data-role="${specification.role}"]`);
      const text = fieldValue(row, field);
      element.dataset.field = field; element.lang = specification.language(language); element.textContent = text || '—';
      element.classList.toggle('empty', !text); if (editing) makeEditable(element);
    });
    mediaPlayer.render(row.media?.items || [], language, reset);
    textPlayer.render(row.contemplation?.lines || [], language, reset);
    if (reset || editing) prepareDrafts(row);
    if (!editing) requestAnimationFrame(fitText);
  }

  function setEditing(enabled) {
    editing = enabled;
    root.querySelectorAll('[data-field]').forEach((element) => {
      if (enabled) makeEditable(element); else { element.contentEditable = 'false'; delete element.dataset.editField; }
    });
    root.querySelectorAll('.gita-sara-collection-editor').forEach((element) => { element.hidden = !enabled; });
    root.querySelectorAll('.gita-sara-media-stage, .gita-sara-media-caption, [data-media-action], .gita-sara-question-stage, [data-text-action]').forEach((element) => { element.hidden = enabled; });
    if (enabled && renderedRow) prepareDrafts(renderedRow);
    if (!enabled) applyQuestionView();
  }

  function editableElements() { return Array.from(root.querySelectorAll('[data-edit-field]')); }
  function additionalEditableElements() { return Array.from(root.querySelectorAll('.gita-sara-collection-editor input, .gita-sara-collection-editor textarea, .gita-sara-collection-editor select')); }
  const nextOrder = (rows, sid) => Math.max(0, ...rows.filter((entry) => entry.sid === sid).map((entry) => Number(entry.order) || 0)) + 1;
  function replaceSidRows(table, sid, replacements, changes) {
    const previous = table.rows;
    const first = previous.findIndex((entry) => entry.sid === sid);
    const retained = previous.filter((entry) => entry.sid !== sid);
    const sequenceIndex = renderedRow?.authoring?.sequenceIndexBySid || new Map();
    const targetIndex = sequenceIndex.get(sid) ?? Number.MAX_SAFE_INTEGER;
    const later = retained.findIndex((entry) => (sequenceIndex.get(entry.sid) ?? Number.MAX_SAFE_INTEGER) > targetIndex);
    const at = first >= 0 ? first : (later >= 0 ? later : retained.length);
    const value = [...retained.slice(0, at), ...replacements, ...retained.slice(at)];
    changes.push({ target: table, property: 'rows', previous, value }); table.rows = value;
  }
  function collectAdditionalEdits() {
    if (!renderedRow) return { changes: [], files: [] };
    const authoring = renderedRow.authoring;
    const nextMedia = readMediaDraft();
    const nextQuestions = readQuestionDraft();
    if (nextMedia.some((item) => !item.url)) throw new Error(translate('gitaSara.mediaRequired', 'Every media item needs a URL.'));
    if (nextMedia.some((item) => item.mediaType !== 'google_deck' && !/^https:\/\//i.test(item.url) && !item.file && item.url !== item.original?.sourceUrl)) {
      throw new Error(translate('gitaSara.localFileRequired', 'Choose a local WebP or GIF file before saving a new local illustration.'));
    }
    const nextShape = JSON.stringify({ media: nextMedia.map(({ original, ...item }) => item), questions: nextQuestions.map(({ original, ...item }) => item) });
    if (draftBaseline === nextShape) return { changes: [], files: [] };
    const changes = []; const files = []; const assets = []; const addFile = (url, table) => { if (url && !files.some((entry) => entry.url === url)) files.push({ url, table }); };
    const imageBundle = authoring.illustrationCatalogs.get('gita-sara-illustrations');
    const deckBundle = authoring.deckCatalogs.get('gita-sara-google-decks');
    const textBundle = authoring.contemplationCatalogs.get('gita-sara-contemplations');
    const snapped = new Set();
    const snapshot = (table) => {
      if (!table || snapped.has(table)) return;
      snapped.add(table);
      changes.push({ target: table, property: 'rows', previous: table.rows.map((row) => ({ ...row })) });
    };
    snapshot(imageBundle?.catalog); snapshot(deckBundle?.table);
    snapshot(imageBundle?.localized.en); snapshot(imageBundle?.localized.kn);
    snapshot(textBundle?.catalog); snapshot(textBundle?.localized.en); snapshot(textBundle?.localized.kn);
    const mediaRows = []; const illustrationRows = []; const deckRows = [];
    const newItems = nextMedia.map((item, index) => {
      const isDeck = item.mediaType === 'google_deck';
      const bundle = isDeck ? deckBundle : imageBundle;
      if (!bundle) throw new Error('The editable media collection is unavailable.');
      const catalog = bundle.table || bundle.catalog;
      const order = item.original?.assetOrder || nextOrder(catalog.rows, renderedRow.sid);
      let catalogRow = item.original?.authoring?.catalogRow;
      if (!catalogRow || item.original.collectionId !== (isDeck ? 'gita-sara-google-decks' : 'gita-sara-illustrations')) catalogRow = isDeck
        ? { sid: renderedRow.sid, order: String(order), language: '', deck_url: '', title: '' }
        : { sid: renderedRow.sid, order: String(order), image_url: '' };
      if (!catalog.rows.includes(catalogRow)) catalog.rows.push(catalogRow);
      if (isDeck) { catalogRow.deck_url = item.url; catalogRow.title = item.title; }
      else catalogRow.image_url = item.url;
      addFile(bundle.url || bundle.catalogUrl, catalog);
      const localizedRows = {};
      if (!isDeck) {
        for (const language of ['en', 'kn']) {
          const table = imageBundle.localized[language];
          let metadata = item.original?.authoring?.localizedRows?.[language];
          if (!metadata) { metadata = { sid: renderedRow.sid, order: String(order), alt_text: '', caption: '' }; table.rows.push(metadata); }
          if (language === editingLanguage) {
            metadata.alt_text = language === 'en' ? item.altEn : item.altKn;
            metadata.caption = language === 'en' ? item.captionEn : item.captionKn;
          }
          localizedRows[language] = metadata;
          addFile(imageBundle.localizedUrls[language], table);
        }
      }
      const collectionId = isDeck ? 'gita-sara-google-decks' : 'gita-sara-illustrations';
      if (item.file) assets.push({ url: item.url, file: item.file });
      if (isDeck) {
        deckRows.push({ cid: renderedRow.cid, snum: renderedRow.snum, sid: renderedRow.sid, order: String(deckRows.length + 1), deck_collection: collectionId, deck_order: String(order) });
      } else {
        illustrationRows.push({ cid: renderedRow.cid, snum: renderedRow.snum, sid: renderedRow.sid, order: String(illustrationRows.length + 1), image_collection: collectionId, image_order: String(order) });
      }
      mediaRows.push({ cid: renderedRow.cid, snum: renderedRow.snum, sid: renderedRow.sid, order: String(index + 1), media_type: item.mediaType, collection: collectionId, asset_order: String(order) });
      let resolvedUrl = item.url;
      const unchangedSource = item.original?.sourceUrl === item.url;
      try {
        resolvedUrl = isDeck
          ? normalizeGoogleDeckUrl(item.url)
          : item.previewUrl || (unchangedSource ? (item.original.resolvedUrl || item.original.imageUrl) : '') || normalizeImageUrl(item.url).resolvedUrl;
      } catch { resolvedUrl = item.previewUrl || item.url; }
      return {
        mediaType: item.mediaType, order: index + 1, collectionId, assetSid: renderedRow.sid, assetOrder: String(order),
        sourceUrl: item.url, resolvedUrl, imageUrl: resolvedUrl, title: item.title,
        localized: { en: { altText: item.altEn, caption: item.captionEn }, kn: { altText: item.altKn, caption: item.captionKn } },
        isExternal: /^https:/i.test(item.url), isFallback: false,
        fallback: isDeck ? null : (item.original?.fallback || fallbackMedia || null),
        authoring: isDeck
          ? { catalogRow, catalog, catalogUrl: bundle.url || bundle.catalogUrl || '' }
          : { catalogRow, catalog, catalogUrl: bundle.url || bundle.catalogUrl || '', localizedRows, localizedTables: imageBundle.localized, localizedUrls: imageBundle.localizedUrls },
        compositionRow: mediaRows.at(-1)
      };
    });
    replaceSidRows(authoring.illustrationComposition.table, renderedRow.sid, illustrationRows, changes); addFile(authoring.illustrationComposition.url, authoring.illustrationComposition.table);
    replaceSidRows(authoring.deckComposition.table, renderedRow.sid, deckRows, changes); addFile(authoring.deckComposition.url, authoring.deckComposition.table);
    replaceSidRows(authoring.mediaComposition.table, renderedRow.sid, mediaRows, changes); addFile(authoring.mediaComposition.url, authoring.mediaComposition.table);
    const questionRows = []; const newLines = nextQuestions.map((item, index) => {
      const order = item.original?.assetOrder || nextOrder(textBundle.catalog.rows, renderedRow.sid);
      let catalogRow = item.original?.authoring?.catalogRow;
      if (!catalogRow) { catalogRow = { sid: renderedRow.sid, order: String(order), line_type: 'question' }; textBundle.catalog.rows.push(catalogRow); }
      addFile(textBundle.catalog.url, textBundle.catalog);
      const localizedRows = {};
      for (const language of ['en', 'kn']) {
        const table = textBundle.localized[language];
        let localized = item.original?.authoring?.localizedRows?.[language];
        if (!localized) { localized = { sid: renderedRow.sid, order: String(order), text: '' }; table.rows.push(localized); }
        if (language === editingLanguage) localized.text = item[language];
        localizedRows[language] = localized; addFile(textBundle.localizedUrls[language], table);
      }
      questionRows.push({ cid: renderedRow.cid, snum: renderedRow.snum, sid: renderedRow.sid, order: String(index + 1), text_collection: 'gita-sara-contemplations', text_order: String(order) });
      return {
        collectionId: 'gita-sara-contemplations', assetSid: renderedRow.sid, assetOrder: String(order), type: 'question',
        localized: { en: item.en, kn: item.kn },
        authoring: { catalogRow, catalog: textBundle.catalog, catalogUrl: textBundle.catalog.url || '', localizedRows, localizedTables: textBundle.localized, localizedUrls: textBundle.localizedUrls },
        isFallback: false
      };
    });
    replaceSidRows(authoring.contemplationComposition.table, renderedRow.sid, questionRows, changes); addFile(authoring.contemplationComposition.url, authoring.contemplationComposition.table);
    const displayedItems = newItems.length ? newItems : (fallbackMedia ? [fallbackMedia] : []);
    const displayedLines = newLines.length ? newLines : (fallbackQuestion ? [fallbackQuestion] : []);
    changes.push({ target: renderedRow.media, property: 'items', previous: renderedRow.media.items, value: displayedItems }); renderedRow.media.items = displayedItems;
    changes.push({ target: renderedRow.contemplation, property: 'lines', previous: renderedRow.contemplation.lines, value: displayedLines }); renderedRow.contemplation.lines = displayedLines;
    mediaDraft = nextMedia; questionDraft = nextQuestions;
    return { changes, files, assets };
  }
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
    const expanded = !questionsVisible;
    fitElement('shloka', expanded ? 36 : 26, 13); fitElement('transliteration', expanded ? 20 : 17, 10);
    fitElement('meaning', expanded ? 28 : 20, 11); fitElement('word', expanded ? 18 : 14, 9);
  }

  return {
    id: 'gita-sara', supportsQuestions: true, questionsVisible: () => questionsVisible,
    mount, render, setEditing, editableElements, fitText, toggleQuestions,
    additionalEditableElements, collectAdditionalEdits, refreshAdditionalData() { if (renderedRow) prepareDrafts(renderedRow); },
    destroy() { if (root) { root.classList.remove('gita-sara-root'); root.textContent = ''; } root = null; }
  };
}
