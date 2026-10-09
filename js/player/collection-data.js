export const COLLECTION_ROOT = 'data/collections';

export const AUDIO_REGISTRY_HEADERS = ['collection_id', 'title', 'contributor', 'language', 'catalog_url', 'cue_purpose_url', 'cue_url', 'attribution', 'license', 'source'];
export const AUDIO_CUE_PURPOSE_HEADERS = ['cue_id', 'language', 'purpose', 'description'];
export const AUDIO_CUE_HEADERS = ['sid', 'asset_order', 'cue_order', 'cue_id', 'start_ms', 'end_ms'];

const MASTER_HEADERS = {
  sa: ['cid', 'snum', 'sid', 'chapter_name', 'shloka_raw', 'shloka', 'word_by_word', 'meaning', 'word_by_word_meaning'],
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
    const legacySanskritHeaders = ['cid', 'snum', 'sid', 'chapter_name', 'shloka', 'word_by_word', 'meaning', 'word_by_word_meaning'];
    if (expectedHeaders.includes('shloka_raw') && headers.join('#') === legacySanskritHeaders.join('#')) {
      throw new Error(label + ' uses the legacy Sanskrit schema. Add shloka_raw between chapter_name and shloka.');
    }
    throw new Error(label + ' header does not match its collection contract.');
  }
  const seen = new Set();
  const rows = lines.map((line, index) => {
    const fields = line.split('#');
    if (fields.length !== headers.length) throw new Error(label + ' row ' + (index + 2) + ' has an invalid field count.');
    const row = Object.fromEntries(headers.map((header, fieldIndex) => [header, decode(fields[fieldIndex])]));
    if (row.sid) {
      if (row.sid !== row.cid + '.' + row.snum && 'cid' in row) throw new Error(label + ' contains an invalid SID: ' + row.sid);
      const key = row.asset_order && row.cue_order
        ? row.sid + ':' + row.asset_order + ':' + row.cue_order
        : row.order ? row.sid + ':' + row.order : row.sid;
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

function audioBinding(experience) {
  return {
    collectionField: experience?.audioBinding?.collectionField || 'chant_full_sa_collection',
    orderField: experience?.audioBinding?.orderField || 'chant_full_sa_order'
  };
}

function audioCompositionHeaders(experience) {
  const binding = audioBinding(experience);
  return ['cid', 'snum', 'sid', binding.collectionField, binding.orderField];
}

function positiveInteger(value) {
  return /^[1-9]\d*$/.test(String(value));
}

function nonNegativeInteger(value) {
  return /^(0|[1-9]\d*)$/.test(String(value));
}

function cueContractError(collectionId, errors) {
  return new Error('Audio cue metadata for ' + collectionId + ' is invalid: ' + errors.join(' '));
}

export function buildAudioCueIndex({ collectionId = 'audio collection', catalog, cuePurposes, cues, strict = true }) {
  const globalErrors = [];
  const purposeById = new Map();
  for (const [index, row] of cuePurposes.rows.entries()) {
    const location = 'cue-purpose row ' + (index + 2);
    if (!row.cue_id || !row.language || !row.purpose) globalErrors.push(location + ' is incomplete.');
    else if (purposeById.has(row.cue_id)) globalErrors.push(location + ' duplicates cue_id ' + row.cue_id + '.');
    else purposeById.set(row.cue_id, Object.freeze({
      cueId: row.cue_id,
      language: row.language,
      purpose: row.purpose,
      description: row.description
    }));
  }
  if (!purposeById.size) globalErrors.push('cue-purpose.csv defines no cue purposes.');
  if (globalErrors.length) {
    if (strict) throw cueContractError(collectionId, globalErrors);
    return { purposeById, cuesByAsset: new Map(), errors: globalErrors };
  }

  const assetKeys = new Set(catalog.rows.map((row) => mediaKey(row.sid, row.order)));
  const groups = new Map();
  cues.rows.forEach((row, index) => {
    const key = mediaKey(row.sid, row.asset_order);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, line: index + 2 });
  });

  const cuesByAsset = new Map();
  const errors = [];
  for (const [key, entries] of groups) {
    const groupErrors = [];
    if (!assetKeys.has(key)) groupErrors.push('does not reference an audio catalog asset.');
    const orders = new Set();
    const normalized = [];
    for (const { row, line } of entries) {
      if (!row.sid || !positiveInteger(row.asset_order) || !positiveInteger(row.cue_order)) {
        groupErrors.push('line ' + line + ' has an invalid identity or order.');
        continue;
      }
      if (orders.has(row.cue_order)) groupErrors.push('line ' + line + ' duplicates cue_order ' + row.cue_order + '.');
      orders.add(row.cue_order);
      const purpose = purposeById.get(row.cue_id);
      if (!purpose) groupErrors.push('line ' + line + ' references unknown cue_id ' + row.cue_id + '.');
      if (!nonNegativeInteger(row.start_ms) || !nonNegativeInteger(row.end_ms) || Number(row.start_ms) >= Number(row.end_ms)) {
        groupErrors.push('line ' + line + ' has an invalid time range.');
      }
      if (purpose && nonNegativeInteger(row.start_ms) && nonNegativeInteger(row.end_ms) && Number(row.start_ms) < Number(row.end_ms)) {
        normalized.push(Object.freeze({
          order: Number(row.cue_order),
          cueId: row.cue_id,
          language: purpose.language,
          purpose: purpose.purpose,
          description: purpose.description,
          startMs: Number(row.start_ms),
          endMs: Number(row.end_ms)
        }));
      }
    }
    normalized.sort((left, right) => left.order - right.order);
    normalized.forEach((cue, index) => {
      if (cue.order !== index + 1) groupErrors.push('cue_order must be sequential from 1.');
      const previous = normalized[index - 1];
      if (previous && cue.startMs < previous.endMs) groupErrors.push('cue ' + cue.order + ' overlaps cue ' + previous.order + '.');
    });
    if (groupErrors.length) errors.push(...groupErrors.map((message) => key + ' ' + message));
    else cuesByAsset.set(key, Object.freeze(normalized));
  }
  if (strict && errors.length) throw cueContractError(collectionId, errors);
  return { purposeById, cuesByAsset, errors };
}

export function normalizeCollectionData({ sa, en, kn, audioComposition, imageComposition, audioCatalogs, audioCueIndexes = new Map(), audioCueErrors = new Map(), imageCatalogs, experience, resolveMediaUrl = (url) => url }) {
  for (const [label, table] of [['English master', en], ['Kannada master', kn], ['Experience audio composition', audioComposition], ['Experience image composition', imageComposition]]) {
    verifyIdentity(sa, table, label);
  }
  const binding = audioBinding(experience);
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
    let chantFullSaCues = Object.freeze([]);
    let primaryAudioCollection = '';
    let primaryAudioOrder = '';
    let primaryAudioUrl = '';
    let primaryAudioCues = Object.freeze([]);
    const collectionId = audioRef[binding.collectionField];
    const assetOrder = audioRef[binding.orderField];
    if (collectionId || assetOrder) {
      if (!collectionId || !assetOrder) throw new Error('Incomplete audio reference at ' + sourceRow.sid + '.');
      const catalog = audioCatalogs.get(collectionId);
      const asset = catalog?.rows.find((row) => mediaKey(row.sid, row.order) === mediaKey(sourceRow.sid, assetOrder));
      if (!asset) throw new Error('Audio reference does not resolve at ' + sourceRow.sid + '.');
      primaryAudioCollection = collectionId;
      primaryAudioOrder = assetOrder;
      primaryAudioUrl = resolveMediaUrl(asset.audio_url);
      primaryAudioCues = audioCueIndexes.get(collectionId)?.get(mediaKey(sourceRow.sid, assetOrder)) || primaryAudioCues;
      if (binding.collectionField === 'chant_full_sa_collection') {
        chantFullSaUrl = primaryAudioUrl;
        chantFullSaCues = primaryAudioCues;
      }
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
        shlokaRaw: sourceRow.shloka_raw,
        shloka: sourceRow.shloka,
        wordByWord: sourceRow.word_by_word,
        meaning: sourceRow.meaning,
        wordByWordMeaning: sourceRow.word_by_word_meaning
      },
      languages: {
        en: { chapterName: enRow.chapter_name, transliteration: enRow.transliteration, meaning: enRow.meaning, wordByWordMeaning: enRow.word_by_word_meaning },
        kn: { chapterName: knRow.chapter_name, transliteration: knRow.transliteration, meaning: knRow.meaning, wordByWordMeaning: knRow.word_by_word_meaning }
      },
      media: {
        primaryAudioCollection,
        primaryAudioOrder,
        primaryAudioUrl,
        primaryAudioCues,
        chantFullSaUrl,
        chantFullSaCues,
        chapterIconUrl
      }
    };
  });
  return {
    schemaVersion: 3,
    experience,
    rows,
    diagnostics: { audioCues: Object.fromEntries(audioCueErrors) }
  };
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

async function loadAudioCatalogs(composition, collectionField, version) {
  const collectionIds = new Set(composition.rows.map((row) => row[collectionField]).filter(Boolean));
  const registry = await fetchTable(COLLECTION_ROOT + '/audio/collection.csv', AUDIO_REGISTRY_HEADERS, version);
  const catalogs = new Map();
  const cueIndexes = new Map();
  const cueErrors = new Map();
  for (const id of collectionIds) {
    const entry = registryEntry(registry, id, 'audio');
    const catalog = await fetchTable(entry.catalog_url, ['sid', 'order', 'language', 'audio_url'], version);
    catalogs.set(id, catalog);
    if (!entry.cue_purpose_url && !entry.cue_url) continue;
    if (!entry.cue_purpose_url || !entry.cue_url) {
      cueErrors.set(id, ['Audio collection must define both cue_purpose_url and cue_url.']);
      continue;
    }
    try {
      const [cuePurposes, cues] = await Promise.all([
        fetchTable(entry.cue_purpose_url, AUDIO_CUE_PURPOSE_HEADERS, version),
        fetchTable(entry.cue_url, AUDIO_CUE_HEADERS, version)
      ]);
      const result = buildAudioCueIndex({ collectionId: id, catalog, cuePurposes, cues, strict: false });
      cueIndexes.set(id, result.cuesByAsset);
      if (result.errors.length) cueErrors.set(id, result.errors);
    } catch (error) {
      cueErrors.set(id, [error.message]);
    }
  }
  return { catalogs, cueIndexes, cueErrors };
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
    fetchTable(catalogEntry(experienceCatalog, 'audio', experienceId), audioCompositionHeaders(experience), version),
    fetchTable(catalogEntry(experienceCatalog, 'images', experienceId), ['cid', 'snum', 'sid', 'chapter_icon_collection', 'chapter_icon_order'], version)
  ]);
  const [audioCollections, imageCatalogs] = await Promise.all([
    loadAudioCatalogs(audioComposition, audioBinding(experience).collectionField, version),
    loadMediaCatalogs('images', imageComposition, 'chapter_icon_collection', ['sid', 'order', 'image_url'], version)
  ]);
  return normalizeCollectionData({
    sa, en, kn, audioComposition, imageComposition,
    audioCatalogs: audioCollections.catalogs,
    audioCueIndexes: audioCollections.cueIndexes,
    audioCueErrors: audioCollections.cueErrors,
    imageCatalogs, experience
  });
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

async function loadCollectionExperienceWithReader(experienceId, { text, resolveMediaUrl, onLanguageFile = () => {} }) {
  const table = async (url, headers = null) => parseCollectionTable(await text(url), headers, url);
  const experienceRegistry = await table(COLLECTION_ROOT + '/experiences/collection.csv');
  const experienceEntry = registryEntry(experienceRegistry, experienceId, 'Experience');
  const experienceCatalog = await table(experienceEntry.catalog_url, ['content_type', 'content_url']);
  const experience = JSON.parse(await text(catalogEntry(experienceCatalog, 'configuration', experienceId)));
  if (experience.id !== experienceId || experience.schemaVersion !== 1) throw new Error('Unsupported experience configuration for ' + experienceId + '.');
  const verseRegistry = await table(COLLECTION_ROOT + '/verses/collection.csv');
  const verseEntry = registryEntry(verseRegistry, experience.verseCollection, 'Verse');
  const verseCatalog = await table(verseEntry.catalog_url, ['language', 'content_type', 'content_url']);
  const languageUrls = Object.fromEntries(['sa', 'en', 'kn'].map((language) => [language, languageFile(verseCatalog, language)]));
  Object.entries(languageUrls).forEach(([language, url]) => onLanguageFile(language, url));
  const [sa, en, kn, audioComposition, imageComposition] = await Promise.all([
    table(languageUrls.sa, MASTER_HEADERS.sa),
    table(languageUrls.en, MASTER_HEADERS.en),
    table(languageUrls.kn, MASTER_HEADERS.kn),
    table(catalogEntry(experienceCatalog, 'audio', experienceId), audioCompositionHeaders(experience)),
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
  async function localAudioCatalogs() {
    const registry = await table(COLLECTION_ROOT + '/audio/collection.csv', AUDIO_REGISTRY_HEADERS);
    const catalogs = new Map();
    const cueIndexes = new Map();
    const cueErrors = new Map();
    const binding = audioBinding(experience);
    for (const id of new Set(audioComposition.rows.map((row) => row[binding.collectionField]).filter(Boolean))) {
      const entry = registryEntry(registry, id, 'audio');
      const catalog = await table(entry.catalog_url, ['sid', 'order', 'language', 'audio_url']);
      catalogs.set(id, catalog);
      if (!entry.cue_purpose_url && !entry.cue_url) continue;
      if (!entry.cue_purpose_url || !entry.cue_url) {
        cueErrors.set(id, ['Audio collection must define both cue_purpose_url and cue_url.']);
        continue;
      }
      try {
        const [cuePurposes, cues] = await Promise.all([
          table(entry.cue_purpose_url, AUDIO_CUE_PURPOSE_HEADERS),
          table(entry.cue_url, AUDIO_CUE_HEADERS)
        ]);
        const result = buildAudioCueIndex({ collectionId: id, catalog, cuePurposes, cues, strict: false });
        cueIndexes.set(id, result.cuesByAsset);
        if (result.errors.length) cueErrors.set(id, result.errors);
      } catch (error) {
        cueErrors.set(id, [error.message]);
      }
    }
    return { catalogs, cueIndexes, cueErrors };
  }
  const [audioCollections, imageCatalogs] = await Promise.all([
    localAudioCatalogs(),
    localCatalogs('images', imageComposition, 'chapter_icon_collection', ['sid', 'order', 'image_url'])
  ]);
  return normalizeCollectionData({
    sa, en, kn, audioComposition, imageComposition,
    audioCatalogs: audioCollections.catalogs,
    audioCueIndexes: audioCollections.cueIndexes,
    audioCueErrors: audioCollections.cueErrors,
    imageCatalogs, experience, resolveMediaUrl
  });
}

export async function loadCollectionExperienceFromFiles(experienceId, fileList) {
  const files = selectedCollectionFiles(fileList);
  if (!files.size) throw new Error('Choose the data/collections folder.');
  const text = async (url) => {
    const file = files.get(url);
    if (!file) throw new Error('The selected folder is missing ' + url + '.');
    return file.text();
  };
  const objectUrls = new Map();
  const resolveMediaUrl = (url) => {
    const file = files.get(url);
    if (!file) throw new Error('The selected folder is missing media file ' + url + '.');
    if (!objectUrls.has(url)) objectUrls.set(url, URL.createObjectURL(file));
    return objectUrls.get(url);
  };
  try {
    const dataset = await loadCollectionExperienceWithReader(experienceId, { text, resolveMediaUrl });
    dataset.release = () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
    return dataset;
  } catch (error) {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }
}

function relativeCollectionPath(url) {
  const prefix = COLLECTION_ROOT + '/';
  if (!String(url).startsWith(prefix)) throw new Error('Collection path is outside data/collections: ' + url + '.');
  return String(url).slice(prefix.length);
}

async function fileHandleAt(rootHandle, url) {
  const parts = relativeCollectionPath(url).split('/').filter(Boolean);
  const filename = parts.pop();
  let directory = rootHandle;
  for (const part of parts) directory = await directory.getDirectoryHandle(part);
  return directory.getFileHandle(filename);
}

export class WritableCollectionWorkspace {
  constructor(rootHandle) {
    this.rootHandle = rootHandle;
    this.languageFiles = new Map();
    this.baselines = new Map();
    this.objectUrls = new Map();
  }

  async readFile(url) {
    try {
      return await (await fileHandleAt(this.rootHandle, url)).getFile();
    } catch (error) {
      throw new Error('The selected collections folder is missing ' + relativeCollectionPath(url) + '.');
    }
  }

  async readText(url) {
    return (await this.readFile(url)).text();
  }

  async load(experienceId) {
    this.languageFiles.clear();
    this.baselines.clear();
    const dataset = await loadCollectionExperienceWithReader(experienceId, {
      text: async (url) => {
        const value = await this.readText(url);
        if ([...this.languageFiles.values()].includes(url)) this.baselines.set(url, value);
        return value;
      },
      onLanguageFile: (language, url) => this.languageFiles.set(language, url),
      resolveMediaUrl: (url) => {
        if (!this.objectUrls.has(url)) {
          const promise = this.readFile(url).then((file) => URL.createObjectURL(file));
          this.objectUrls.set(url, promise);
        }
        return this.objectUrls.get(url);
      }
    });
    for (const row of dataset.rows) {
      for (const field of ['primaryAudioUrl', 'chantFullSaUrl', 'chapterIconUrl']) {
        if (row.media[field] instanceof Promise) row.media[field] = await row.media[field];
      }
    }
    return dataset;
  }

  async saveLanguageMasters(dataset, languages) {
    const pending = [];
    for (const language of [...new Set(languages)].sort()) {
      const url = this.languageFiles.get(language);
      if (!url) throw new Error('The workspace does not define master data for ' + language + '.');
      const handle = await fileHandleAt(this.rootHandle, url);
      const current = await (await handle.getFile()).text();
      if (current !== this.baselines.get(url)) {
        const error = new Error('The local ' + url.split('/').pop() + ' changed outside Gitaverse. Reload the collections folder before saving.');
        error.code = 'WORKSPACE_CONFLICT';
        throw error;
      }
      pending.push({ language, url, handle, content: serializeLanguageMaster(dataset, language) });
    }
    for (const entry of pending) {
      const writable = await entry.handle.createWritable();
      await writable.write(entry.content);
      await writable.close();
      const verified = await (await entry.handle.getFile()).text();
      if (verified !== entry.content) throw new Error('Could not verify the saved ' + entry.url.split('/').pop() + '.');
      this.baselines.set(entry.url, verified);
    }
    return pending.map((entry) => entry.url.split('/').pop());
  }
}

export async function openWritableCollectionWorkspace(experienceId, directoryHandle) {
  if (!directoryHandle || directoryHandle.kind !== 'directory') throw new Error('Choose the data/collections folder.');
  const workspace = new WritableCollectionWorkspace(directoryHandle);
  const dataset = await workspace.load(experienceId);
  return { dataset, workspace };
}

export function serializeLanguageMaster(dataset, language) {
  const headers = MASTER_HEADERS[language];
  if (!headers) throw new Error('Unsupported language master: ' + language + '.');
  const rows = dataset.rows.map((row) => {
    if (language === 'sa') {
      return [row.cid, row.snum, row.sid, row.source.chapterName, row.source.shlokaRaw, row.source.shloka, row.source.wordByWord, row.source.meaning, row.source.wordByWordMeaning];
    }
    const content = row.languages[language];
    return [row.cid, row.snum, row.sid, content.chapterName, content.transliteration, content.meaning, content.wordByWordMeaning];
  });
  return [headers, ...rows].map((row) => row.map(encode).join('#')).join('\n') + '\n';
}
