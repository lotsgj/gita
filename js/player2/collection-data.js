export const COLLECTION_ROOT = 'data/collections';

const MASTER_HEADERS = {
  sa: ['cid', 'snum', 'sid', 'chapter_name', 'shloka', 'word_by_word', 'meaning', 'word_by_word_meaning'],
  en: ['cid', 'snum', 'sid', 'chapter_name', 'transliteration', 'meaning', 'word_by_word_meaning'],
  kn: ['cid', 'snum', 'sid', 'chapter_name', 'transliteration', 'meaning', 'word_by_word_meaning']
};

function decode(value) {
  return String(value ?? '').replace(/\\n/g, '\n');
}

function encode(value) {
  const encoded = String(value ?? '').replace(/\r\n?/g, '\n').replace(/\n/g, '\\n');
  if (encoded.includes('#')) throw new Error('The # character is not allowed in collection data.');
  return encoded;
}

export function parseCollectionTable(text, expectedHeaders, label = 'collection data') {
  const lines = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').filter((line) => line.length);
  if (!lines.length) throw new Error(label + ' is empty.');
  const headers = lines.shift().split('#');
  if (expectedHeaders && headers.join('#') !== expectedHeaders.join('#')) {
    throw new Error(label + ' header does not match its collection contract.');
  }
  const seen = new Set();
  const rows = lines.map((line, index) => {
    const fields = line.split('#');
    if (fields.length !== headers.length) throw new Error(label + ' row ' + (index + 2) + ' has an invalid field count.');
    const row = Object.fromEntries(headers.map((header, fieldIndex) => [header, decode(fields[fieldIndex])]));
    if (row.sid) {
      if (row.sid !== row.cid + '.' + row.snum && 'cid' in row) throw new Error(label + ' contains an invalid SID: ' + row.sid);
      const key = row.order ? row.sid + ':' + row.order : row.sid;
      if (seen.has(key)) throw new Error(label + ' contains duplicate key ' + key + '.');
      seen.add(key);
    }
    return row;
  });
  return { headers, rows };
}

async function fetchText(url, version) {
  const request = new URL(url, location.href);
  if (version) request.searchParams.set('v', version);
  const response = await fetch(request.href);
  if (!response.ok) throw new Error('Could not load ' + url + ' (HTTP ' + response.status + ').');
  return response.text();
}

async function fetchTable(url, expectedHeaders, version) {
  return parseCollectionTable(await fetchText(url, version), expectedHeaders, url);
}

function registryEntry(registry, id, label) {
  const entry = registry.rows.find((row) => row.collection_id === id);
  if (!entry) throw new Error(label + ' collection was not found: ' + id + '.');
  return entry;
}

function catalogEntry(catalog, type, label) {
  const entry = catalog.rows.find((row) => row.content_type === type);
  if (!entry) throw new Error(label + ' catalog does not define ' + type + '.');
  return entry.content_url;
}

function languageFile(catalog, language) {
  const entry = catalog.rows.find((row) => row.language === language && row.content_type === 'master');
  if (!entry) throw new Error('Verse collection does not define master data for ' + language + '.');
  return entry.content_url;
}

function verifyIdentity(reference, candidate, label) {
  if (reference.rows.length !== candidate.rows.length) throw new Error(label + ' does not contain the canonical SID count.');
  reference.rows.forEach((row, index) => {
    const other = candidate.rows[index];
    if (!other || row.cid !== other.cid || row.snum !== other.snum || row.sid !== other.sid) {
      throw new Error(label + ' differs from the canonical SID sequence at row ' + (index + 2) + '.');
    }
  });
}

function mediaKey(sid, order) {
  return sid + ':' + order;
}

export function normalizeCollectionData({ sa, en, kn, audioComposition, imageComposition, audioCatalogs, imageCatalogs, experience, resolveMediaUrl = (url) => url }) {
  for (const [label, table] of [['English master', en], ['Kannada master', kn], ['Gita-700 audio composition', audioComposition], ['Gita-700 image composition', imageComposition]]) {
    verifyIdentity(sa, table, label);
  }
  const bySid = (table) => new Map(table.rows.map((row) => [row.sid, row]));
  const enBySid = bySid(en);
  const knBySid = bySid(kn);
  const audioBySid = bySid(audioComposition);
  const imageBySid = bySid(imageComposition);
  const rows = sa.rows.map((sourceRow) => {
    const enRow = enBySid.get(sourceRow.sid);
    const knRow = knBySid.get(sourceRow.sid);
    const audioRef = audioBySid.get(sourceRow.sid);
    const imageRef = imageBySid.get(sourceRow.sid);
    let chantFullSaUrl = '';
    if (audioRef.chant_full_sa_collection || audioRef.chant_full_sa_order) {
      if (!audioRef.chant_full_sa_collection || !audioRef.chant_full_sa_order) throw new Error('Incomplete audio reference at ' + sourceRow.sid + '.');
      const catalog = audioCatalogs.get(audioRef.chant_full_sa_collection);
      const asset = catalog?.rows.find((row) => mediaKey(row.sid, row.order) === mediaKey(sourceRow.sid, audioRef.chant_full_sa_order));
      if (!asset) throw new Error('Audio reference does not resolve at ' + sourceRow.sid + '.');
      chantFullSaUrl = resolveMediaUrl(asset.audio_url);
    }
    let chapterIconUrl = '';
    if (imageRef.chapter_icon_collection || imageRef.chapter_icon_order) {
      if (!imageRef.chapter_icon_collection || !imageRef.chapter_icon_order) throw new Error('Incomplete image reference at ' + sourceRow.sid + '.');
      const catalog = imageCatalogs.get(imageRef.chapter_icon_collection);
      const asset = catalog?.rows.find((row) => mediaKey(row.sid, row.order) === mediaKey(sourceRow.sid, imageRef.chapter_icon_order));
      if (!asset) throw new Error('Image reference does not resolve at ' + sourceRow.sid + '.');
      chapterIconUrl = resolveMediaUrl(asset.image_url);
    }
    return {
      cid: sourceRow.cid,
      snum: sourceRow.snum,
      sid: sourceRow.sid,
      source: {
        chapterName: sourceRow.chapter_name,
        shloka: sourceRow.shloka,
        wordByWord: sourceRow.word_by_word,
        meaning: sourceRow.meaning,
        wordByWordMeaning: sourceRow.word_by_word_meaning
      },
      languages: {
        en: { chapterName: enRow.chapter_name, transliteration: enRow.transliteration, meaning: enRow.meaning, wordByWordMeaning: enRow.word_by_word_meaning },
        kn: { chapterName: knRow.chapter_name, transliteration: knRow.transliteration, meaning: knRow.meaning, wordByWordMeaning: knRow.word_by_word_meaning }
      },
      media: { chantFullSaUrl, chapterIconUrl }
    };
  });
  return { schemaVersion: 2, experience, rows };
}

async function loadMediaCatalogs(type, composition, collectionField, headers, version) {
  const collectionIds = new Set(composition.rows.map((row) => row[collectionField]).filter(Boolean));
  const registry = await fetchTable(COLLECTION_ROOT + '/' + type + '/collection.csv', null, version);
  const catalogs = new Map();
  for (const id of collectionIds) {
    const entry = registryEntry(registry, id, type);
    catalogs.set(id, await fetchTable(entry.catalog_url, headers, version));
  }
  return catalogs;
}

export async function loadCollectionExperience(experienceId, { version = '' } = {}) {
  const experienceRegistry = await fetchTable(COLLECTION_ROOT + '/experiences/collection.csv', null, version);
  const experienceEntry = registryEntry(experienceRegistry, experienceId, 'Experience');
  const experienceCatalog = await fetchTable(experienceEntry.catalog_url, ['content_type', 'content_url'], version);
  const configurationUrl = catalogEntry(experienceCatalog, 'configuration', experienceId);
  const configurationResponse = await fetchText(configurationUrl, version);
  const experience = JSON.parse(configurationResponse);
  if (experience.id !== experienceId || experience.schemaVersion !== 1) throw new Error('Unsupported experience configuration for ' + experienceId + '.');

  const verseRegistry = await fetchTable(COLLECTION_ROOT + '/verses/collection.csv', null, version);
  const verseEntry = registryEntry(verseRegistry, experience.verseCollection, 'Verse');
  const verseCatalog = await fetchTable(verseEntry.catalog_url, ['language', 'content_type', 'content_url'], version);
  const [sa, en, kn, audioComposition, imageComposition] = await Promise.all([
    fetchTable(languageFile(verseCatalog, 'sa'), MASTER_HEADERS.sa, version),
    fetchTable(languageFile(verseCatalog, 'en'), MASTER_HEADERS.en, version),
    fetchTable(languageFile(verseCatalog, 'kn'), MASTER_HEADERS.kn, version),
    fetchTable(catalogEntry(experienceCatalog, 'audio', experienceId), ['cid', 'snum', 'sid', 'chant_full_sa_collection', 'chant_full_sa_order'], version),
    fetchTable(catalogEntry(experienceCatalog, 'images', experienceId), ['cid', 'snum', 'sid', 'chapter_icon_collection', 'chapter_icon_order'], version)
  ]);
  const [audioCatalogs, imageCatalogs] = await Promise.all([
    loadMediaCatalogs('audio', audioComposition, 'chant_full_sa_collection', ['sid', 'order', 'language', 'audio_url'], version),
    loadMediaCatalogs('images', imageComposition, 'chapter_icon_collection', ['sid', 'order', 'image_url'], version)
  ]);
  return normalizeCollectionData({ sa, en, kn, audioComposition, imageComposition, audioCatalogs, imageCatalogs, experience });
}

function selectedCollectionFiles(fileList) {
  const files = new Map();
  for (const file of Array.from(fileList || [])) {
    const original = String(file.webkitRelativePath || file.name).replace(/\\/g, '/');
    const marker = original.indexOf('collections/');
    const relative = marker >= 0 ? original.slice(marker + 'collections/'.length) : original.replace(/^\/+/, '');
    files.set(COLLECTION_ROOT + '/' + relative, file);
  }
  return files;
}

export async function loadCollectionExperienceFromFiles(experienceId, fileList) {
  const files = selectedCollectionFiles(fileList);
  if (!files.size) throw new Error('Choose the data/collections folder.');
  const text = async (url) => {
    const file = files.get(url);
    if (!file) throw new Error('The selected folder is missing ' + url + '.');
    return file.text();
  };
  const table = async (url, headers = null) => parseCollectionTable(await text(url), headers, url);
  const experienceRegistry = await table(COLLECTION_ROOT + '/experiences/collection.csv');
  const experienceEntry = registryEntry(experienceRegistry, experienceId, 'Experience');
  const experienceCatalog = await table(experienceEntry.catalog_url, ['content_type', 'content_url']);
  const experience = JSON.parse(await text(catalogEntry(experienceCatalog, 'configuration', experienceId)));
  if (experience.id !== experienceId || experience.schemaVersion !== 1) throw new Error('Unsupported experience configuration for ' + experienceId + '.');
  const verseRegistry = await table(COLLECTION_ROOT + '/verses/collection.csv');
  const verseEntry = registryEntry(verseRegistry, experience.verseCollection, 'Verse');
  const verseCatalog = await table(verseEntry.catalog_url, ['language', 'content_type', 'content_url']);
  const [sa, en, kn, audioComposition, imageComposition] = await Promise.all([
    table(languageFile(verseCatalog, 'sa'), MASTER_HEADERS.sa),
    table(languageFile(verseCatalog, 'en'), MASTER_HEADERS.en),
    table(languageFile(verseCatalog, 'kn'), MASTER_HEADERS.kn),
    table(catalogEntry(experienceCatalog, 'audio', experienceId), ['cid', 'snum', 'sid', 'chant_full_sa_collection', 'chant_full_sa_order']),
    table(catalogEntry(experienceCatalog, 'images', experienceId), ['cid', 'snum', 'sid', 'chapter_icon_collection', 'chapter_icon_order'])
  ]);
  async function localCatalogs(type, composition, collectionField, headers) {
    const registry = await table(COLLECTION_ROOT + '/' + type + '/collection.csv');
    const catalogs = new Map();
    for (const id of new Set(composition.rows.map((row) => row[collectionField]).filter(Boolean))) {
      catalogs.set(id, await table(registryEntry(registry, id, type).catalog_url, headers));
    }
    return catalogs;
  }
  const [audioCatalogs, imageCatalogs] = await Promise.all([
    localCatalogs('audio', audioComposition, 'chant_full_sa_collection', ['sid', 'order', 'language', 'audio_url']),
    localCatalogs('images', imageComposition, 'chapter_icon_collection', ['sid', 'order', 'image_url'])
  ]);
  const objectUrls = new Map();
  const resolveMediaUrl = (url) => {
    const file = files.get(url);
    if (!file) throw new Error('The selected folder is missing media file ' + url + '.');
    if (!objectUrls.has(url)) objectUrls.set(url, URL.createObjectURL(file));
    return objectUrls.get(url);
  };
  return normalizeCollectionData({ sa, en, kn, audioComposition, imageComposition, audioCatalogs, imageCatalogs, experience, resolveMediaUrl });
}

export function serializeLanguageMaster(dataset, language) {
  const headers = MASTER_HEADERS[language];
  if (!headers) throw new Error('Unsupported language master: ' + language + '.');
  const rows = dataset.rows.map((row) => {
    if (language === 'sa') {
      return [row.cid, row.snum, row.sid, row.source.chapterName, row.source.shloka, row.source.wordByWord, row.source.meaning, row.source.wordByWordMeaning];
    }
    const content = row.languages[language];
    return [row.cid, row.snum, row.sid, content.chapterName, content.transliteration, content.meaning, content.wordByWordMeaning];
  });
  return [headers, ...rows].map((row) => row.map(encode).join('#')).join('\n') + '\n';
}
