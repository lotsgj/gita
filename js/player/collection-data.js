export const COLLECTION_ROOT = 'data/collections';

export const AUDIO_REGISTRY_HEADERS = ['collection_id', 'title', 'contributor', 'language', 'catalog_url', 'cue_purpose_url', 'cue_url', 'attribution', 'license', 'source'];
export const AUDIO_CUE_PURPOSE_HEADERS = ['cue_id', 'language', 'purpose', 'description'];
export const AUDIO_CUE_HEADERS = ['sid', 'asset_order', 'cue_order', 'cue_id', 'start_ms', 'end_ms'];
export const DECK_REGISTRY_HEADERS = ['collection_id', 'title', 'provider', 'language', 'catalog_url', 'attribution', 'license', 'source'];
export const DECK_CATALOG_HEADERS = ['sid', 'order', 'language', 'deck_url', 'title'];
export const DECK_COMPOSITION_HEADERS = ['cid', 'snum', 'sid', 'order', 'deck_collection', 'deck_order'];
export const IMAGE_REGISTRY_HEADERS = ['collection_id', 'title', 'catalog_url', 'metadata_en_url', 'metadata_kn_url', 'attribution', 'license', 'source'];
export const ILLUSTRATION_CATALOG_HEADERS = ['sid', 'order', 'image_url'];
export const ILLUSTRATION_METADATA_HEADERS = ['sid', 'order', 'alt_text', 'caption'];
export const ILLUSTRATION_COMPOSITION_HEADERS = ['cid', 'snum', 'sid', 'order', 'image_collection', 'image_order'];
export const TEXT_REGISTRY_HEADERS = ['collection_id', 'title', 'catalog_url', 'master_en_url', 'master_kn_url', 'attribution', 'license', 'source'];
export const CONTEMPLATION_CATALOG_HEADERS = ['sid', 'order', 'line_type'];
export const CONTEMPLATION_MASTER_HEADERS = ['sid', 'order', 'text'];
export const CONTEMPLATION_COMPOSITION_HEADERS = ['cid', 'snum', 'sid', 'order', 'text_collection', 'text_order'];
export const MEDIA_COMPOSITION_HEADERS = ['cid', 'snum', 'sid', 'order', 'media_type', 'collection', 'asset_order'];
export const SEQUENCE_HEADERS = ['position', 'cid', 'snum', 'sid'];

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

function optionalCatalogEntry(catalog, type) {
  return catalog.rows.find((row) => row.content_type === type)?.content_url || '';
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

function verifyOrderedAssetIdentity(reference, candidate, label) {
  if (reference.rows.length !== candidate.rows.length) throw new Error(label + ' does not contain the canonical asset count.');
  reference.rows.forEach((row, index) => {
    const other = candidate.rows[index];
    if (!other || row.sid !== other.sid || row.order !== other.order) {
      throw new Error(label + ' differs from its catalog SID and order at row ' + (index + 2) + '.');
    }
  });
}

function mediaKey(sid, order) {
  return sid + ':' + order;
}

export function normalizeGoogleDeckUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let url;
  try { url = new URL(raw); } catch { throw new Error('Google deck URL is invalid.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
    throw new Error('Only https://docs.google.com presentation URLs are supported.');
  }
  const match = url.pathname.match(/^\/presentation\/d\/(e\/)?([^/]+)(?:\/[^/]*)?/);
  if (!match) throw new Error('Google deck URL must identify a presentation.');
  url.pathname = '/presentation/d/' + (match[1] || '') + match[2] + '/embed';
  url.search = '';
  url.searchParams.set('start', 'false');
  url.searchParams.set('loop', 'false');
  url.searchParams.set('delayms', '3000');
  url.searchParams.set('rm', 'minimal');
  url.hash = '';
  return url.href;
}

export function normalizeImageUrl(value, resolveRelative = (url) => url) {
  const sourceUrl = String(value || '').trim();
  if (!sourceUrl) throw new Error('Image URL is empty.');
  if (/^https:\/\//i.test(sourceUrl)) return { sourceUrl, resolvedUrl: sourceUrl, isExternal: true };
  if (/^[a-z][a-z\d+.-]*:/i.test(sourceUrl) || sourceUrl.startsWith('//') || sourceUrl.startsWith('/')) {
    throw new Error('Image URL must be an app-relative path or an absolute HTTPS URL.');
  }
  return { sourceUrl, resolvedUrl: resolveRelative(sourceUrl), isExternal: false };
}

function selectedSourceRows(sa, sequence) {
  if (!sequence) return sa.rows;
  const bySid = new Map(sa.rows.map((row) => [row.sid, row]));
  return sequence.rows.map((entry, index) => {
    if (entry.position !== String(index + 1)) throw new Error('Experience sequence positions must start at 1 and remain contiguous.');
    const row = bySid.get(entry.sid);
    if (!row || row.cid !== entry.cid || row.snum !== entry.snum) throw new Error('Experience sequence contains an invalid identity at position ' + entry.position + '.');
    return row;
  });
}

function verifyOrderedComposition(referenceRows, composition, label, { multiple = false } = {}) {
  if (!multiple) return verifyIdentity({ rows: referenceRows }, composition, label);
  const groups = new Map();
  composition.rows.forEach((row) => {
    if (!groups.has(row.sid)) groups.set(row.sid, []);
    groups.get(row.sid).push(row);
  });
  if (groups.size !== referenceRows.length) throw new Error(label + ' does not contain every selected SID.');
  referenceRows.forEach((row) => {
    const entries = groups.get(row.sid) || [];
    entries.sort((left, right) => Number(left.order) - Number(right.order));
    entries.forEach((entry, index) => {
      if (entry.cid !== row.cid || entry.snum !== row.snum || entry.order !== String(index + 1)) {
        throw new Error(label + ' has an invalid identity or order at ' + row.sid + '.');
      }
    });
  });
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

export function normalizeCollectionData({ sa, en, kn, sequence = null, audioComposition, imageComposition, deckComposition = null, illustrationComposition = null, contemplationComposition = null, mediaComposition = null, audioCatalogs, audioCueIndexes = new Map(), audioCueErrors = new Map(), imageCatalogs, deckCatalogs = new Map(), illustrationCatalogs = new Map(), contemplationCatalogs = new Map(), experience, resolveMediaUrl = (url) => url, resourceUrls = {} }) {
  verifyIdentity(sa, en, 'English master');
  verifyIdentity(sa, kn, 'Kannada master');
  verifyIdentity(sa, imageComposition, 'Experience image composition');
  const sourceRows = selectedSourceRows(sa, sequence);
  verifyOrderedComposition(sourceRows, audioComposition, 'Experience audio composition');
  if (deckComposition) verifyOrderedComposition(sourceRows, deckComposition, 'Experience deck composition', { multiple: true });
  if (illustrationComposition) verifyOrderedComposition(sourceRows, illustrationComposition, 'Experience illustration composition', { multiple: true });
  if (contemplationComposition) verifyOrderedComposition(sourceRows, contemplationComposition, 'Experience contemplation composition', { multiple: true });
  if (mediaComposition) verifyOrderedComposition(sourceRows, mediaComposition, 'Experience media composition', { multiple: true });
  const binding = audioBinding(experience);
  const bySid = (table) => new Map(table.rows.map((row) => [row.sid, row]));
  const enBySid = bySid(en);
  const knBySid = bySid(kn);
  const audioBySid = bySid(audioComposition);
  const imageBySid = bySid(imageComposition);
  const deckRefsBySid = new Map();
  for (const row of deckComposition?.rows || []) {
    if (!deckRefsBySid.has(row.sid)) deckRefsBySid.set(row.sid, []);
    deckRefsBySid.get(row.sid).push(row);
  }
  const groupedReferences = (composition) => {
    const groups = new Map();
    for (const reference of composition?.rows || []) {
      if (!groups.has(reference.sid)) groups.set(reference.sid, []);
      groups.get(reference.sid).push(reference);
    }
    groups.forEach((references) => references.sort((left, right) => Number(left.order) - Number(right.order)));
    return groups;
  };
  const illustrationRefsBySid = groupedReferences(illustrationComposition);
  const contemplationRefsBySid = groupedReferences(contemplationComposition);
  const mediaRefsBySid = groupedReferences(mediaComposition);

  function localizedRow(bundle, sid, order, language, label) {
    const row = bundle?.localized?.[language]?.rows.find((candidate) => mediaKey(candidate.sid, candidate.order) === mediaKey(sid, order));
    if (!row) throw new Error(label + ' does not define ' + language + ' content for ' + sid + ':' + order + '.');
    return row;
  }

  function illustrationFromReference(reference, sourceSid, isFallback = false) {
    const collectionId = reference.image_collection || reference.collection;
    const assetSid = reference.sid || sourceSid;
    const assetOrder = reference.image_order || reference.order;
    if (!collectionId || !assetOrder) throw new Error('Incomplete illustration reference at ' + sourceSid + '.');
    const bundle = illustrationCatalogs.get(collectionId);
    const asset = bundle?.catalog.rows.find((candidate) => mediaKey(candidate.sid, candidate.order) === mediaKey(assetSid, assetOrder));
    if (!asset?.image_url) throw new Error('Illustration reference does not resolve at ' + sourceSid + '.');
    const enMetadata = localizedRow(bundle, assetSid, assetOrder, 'en', 'Illustration collection ' + collectionId);
    const knMetadata = localizedRow(bundle, assetSid, assetOrder, 'kn', 'Illustration collection ' + collectionId);
    if (!enMetadata.alt_text || !knMetadata.alt_text) throw new Error('Illustration alternative text is required at ' + sourceSid + '.');
    const imageLocation = normalizeImageUrl(asset.image_url, resolveMediaUrl);
    return {
      mediaType: 'image',
      collectionId,
      assetSid,
      assetOrder,
      sourceUrl: imageLocation.sourceUrl,
      resolvedUrl: imageLocation.resolvedUrl,
      imageUrl: imageLocation.resolvedUrl,
      isExternal: imageLocation.isExternal,
      localized: Object.freeze({
        en: Object.freeze({ altText: enMetadata.alt_text, caption: enMetadata.caption }),
        kn: Object.freeze({ altText: knMetadata.alt_text, caption: knMetadata.caption })
      }),
      isFallback
    };
  }

  function contemplationFromReference(reference, sourceSid, isFallback = false) {
    const collectionId = reference.text_collection || reference.collection;
    const assetSid = reference.sid || sourceSid;
    const assetOrder = reference.text_order || reference.order;
    if (!collectionId || !assetOrder) throw new Error('Incomplete contemplation reference at ' + sourceSid + '.');
    const bundle = contemplationCatalogs.get(collectionId);
    const asset = bundle?.catalog.rows.find((candidate) => mediaKey(candidate.sid, candidate.order) === mediaKey(assetSid, assetOrder));
    if (!asset) throw new Error('Contemplation reference does not resolve at ' + sourceSid + '.');
    const enText = localizedRow(bundle, assetSid, assetOrder, 'en', 'Contemplation collection ' + collectionId).text;
    const knText = localizedRow(bundle, assetSid, assetOrder, 'kn', 'Contemplation collection ' + collectionId).text;
    if (!enText || !knText) throw new Error('Contemplation text is required at ' + sourceSid + '.');
    return Object.freeze({
      collectionId,
      assetSid,
      assetOrder,
      type: asset.line_type,
      localized: Object.freeze({ en: enText, kn: knText }),
      isFallback
    });
  }
  const rows = sourceRows.map((sourceRow) => {
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
    const compositionRows = (deckRefsBySid.get(sourceRow.sid) || []).sort((left, right) => Number(left.order) - Number(right.order));
    const deckSlots = [];
    for (const [deckCollection, catalog] of deckCatalogs) {
      const assets = catalog.rows.filter((asset) => asset.sid === sourceRow.sid).sort((left, right) => Number(left.order) - Number(right.order));
      assets.forEach((asset, index) => {
        const compositionRow = compositionRows.find((entry) => entry.deck_collection === deckCollection && entry.deck_order === asset.order) || compositionRows[index];
        let embedUrl = '';
        if (asset.deck_url) embedUrl = normalizeGoogleDeckUrl(asset.deck_url);
        deckSlots.push({
          order: Number(compositionRow?.order || index + 1),
          collectionId: deckCollection,
          catalogOrder: asset.order,
          sourceUrl: asset.deck_url,
          embedUrl,
          title: asset.title,
          language: asset.language,
          compositionRow,
          compositionTable: deckComposition,
          compositionUrl: resourceUrls.decks,
          catalogRow: asset,
          catalog,
          catalogUrl: catalog.url || ''
        });
      });
    }
    deckSlots.sort((left, right) => left.order - right.order);
    const illustrationReferences = (illustrationRefsBySid.get(sourceRow.sid) || []).filter((reference) => reference.image_collection || reference.image_order);
    const illustrations = illustrationReferences.map((reference) => illustrationFromReference(reference, sourceRow.sid));
    if (!illustrations.length && experience?.fallbacks?.illustration) {
      illustrations.push(illustrationFromReference(experience.fallbacks.illustration, sourceRow.sid, true));
    }
    const contemplationReferences = (contemplationRefsBySid.get(sourceRow.sid) || []).filter((reference) => reference.text_collection || reference.text_order);
    const contemplationLines = contemplationReferences.map((reference) => contemplationFromReference(reference, sourceRow.sid));
    if (!contemplationLines.length && experience?.fallbacks?.contemplation) {
      contemplationLines.push(contemplationFromReference(experience.fallbacks.contemplation, sourceRow.sid, true));
    }
    const mediaItems = [];
    for (const reference of (mediaRefsBySid.get(sourceRow.sid) || []).filter((entry) => entry.media_type || entry.collection || entry.asset_order)) {
      if (!reference.media_type || !reference.collection || !reference.asset_order) throw new Error('Incomplete media reference at ' + sourceRow.sid + '.');
      if (reference.media_type === 'image') {
        const item = illustrationFromReference({ image_collection: reference.collection, image_order: reference.asset_order, sid: sourceRow.sid }, sourceRow.sid);
        mediaItems.push({ ...item, order: Number(reference.order) });
      } else if (reference.media_type === 'google_deck') {
        const deck = deckSlots.find((item) => item.collectionId === reference.collection && item.catalogOrder === reference.asset_order);
        if (!deck?.sourceUrl) throw new Error('Google deck media reference does not resolve at ' + sourceRow.sid + '.');
        mediaItems.push({
          mediaType: 'google_deck', order: Number(reference.order), collectionId: deck.collectionId,
          assetSid: sourceRow.sid, assetOrder: deck.catalogOrder, sourceUrl: deck.sourceUrl,
          resolvedUrl: deck.embedUrl, embedUrl: deck.embedUrl, title: deck.title,
          localized: Object.freeze({ en: Object.freeze({ altText: deck.title || '', caption: '' }), kn: Object.freeze({ altText: deck.title || '', caption: '' }) }),
          isExternal: true, isFallback: false
        });
      } else throw new Error('Unsupported media type at ' + sourceRow.sid + ': ' + reference.media_type + '.');
    }
    if (!mediaItems.length && experience?.fallbacks?.illustration) {
      mediaItems.push({ ...illustrationFromReference(experience.fallbacks.illustration, sourceRow.sid, true), order: 1 });
    }
    mediaItems.sort((left, right) => left.order - right.order);
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
        chapterIconUrl,
        illustrations: Object.freeze(illustrations),
        items: Object.freeze(mediaItems),
        decks: deckSlots.filter((deck) => deck.sourceUrl),
        deckSlots
      },
      contemplation: { lines: Object.freeze(contemplationLines) }
    };
  });
  return {
    schemaVersion: 3,
    experience,
    rows,
    authoring: {
      deckComposition: deckComposition && { url: resourceUrls.decks, table: deckComposition },
      illustrationComposition: illustrationComposition && { url: resourceUrls.illustrations, table: illustrationComposition },
      contemplationComposition: contemplationComposition && { url: resourceUrls.contemplations, table: contemplationComposition },
      mediaComposition: mediaComposition && { url: resourceUrls.media, table: mediaComposition },
      deckCatalogs: new Map([...deckCatalogs].map(([id, table]) => [id, { url: table.url || '', table }]))
    },
    diagnostics: { audioCues: Object.fromEntries(audioCueErrors) }
  };
}

async function loadMediaCatalogs(type, composition, collectionField, headers, version, declaredIds = []) {
  const collectionIds = new Set([...declaredIds, ...composition.rows.map((row) => row[collectionField]).filter(Boolean)]);
  const registry = await fetchTable(COLLECTION_ROOT + '/' + type + '/collection.csv', null, version);
  const catalogs = new Map();
  for (const id of collectionIds) {
    const entry = registryEntry(registry, id, type);
    const catalog = await fetchTable(entry.catalog_url, headers, version);
    catalog.url = entry.catalog_url;
    catalogs.set(id, catalog);
  }
  return catalogs;
}

async function loadLocalizedCatalogs({ type, composition, collectionField, catalogHeaders, localizedHeaders, localizedFields, registryHeaders, version, declaredIds = [] }) {
  const collectionIds = new Set([...declaredIds, ...composition.rows.map((row) => row[collectionField]).filter(Boolean)]);
  const registry = await fetchTable(COLLECTION_ROOT + '/' + type + '/collection.csv', registryHeaders, version);
  const catalogs = new Map();
  for (const id of collectionIds) {
    const entry = registryEntry(registry, id, type);
    const catalog = await fetchTable(entry.catalog_url, catalogHeaders, version);
    const localized = {};
    for (const language of ['en', 'kn']) {
      const url = entry[localizedFields[language]];
      if (!url) throw new Error(type + ' collection ' + id + ' does not define ' + language + ' content.');
      localized[language] = await fetchTable(url, localizedHeaders, version);
      verifyOrderedAssetIdentity(catalog, localized[language], type + ' collection ' + id + ' ' + language);
    }
    catalogs.set(id, { catalog, localized });
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
  const sequenceUrl = optionalCatalogEntry(experienceCatalog, 'sequence');
  const deckCompositionUrl = optionalCatalogEntry(experienceCatalog, 'decks');
  const illustrationCompositionUrl = optionalCatalogEntry(experienceCatalog, 'illustrations');
  const contemplationCompositionUrl = optionalCatalogEntry(experienceCatalog, 'contemplations');
  const mediaCompositionUrl = optionalCatalogEntry(experienceCatalog, 'media');
  const audioCompositionUrl = catalogEntry(experienceCatalog, 'audio', experienceId);
  const imageCompositionUrl = catalogEntry(experienceCatalog, 'images', experienceId);
  const [sa, en, kn, sequence, audioComposition, imageComposition, deckComposition, illustrationComposition, contemplationComposition, mediaComposition] = await Promise.all([
    fetchTable(languageFile(verseCatalog, 'sa'), MASTER_HEADERS.sa, version),
    fetchTable(languageFile(verseCatalog, 'en'), MASTER_HEADERS.en, version),
    fetchTable(languageFile(verseCatalog, 'kn'), MASTER_HEADERS.kn, version),
    sequenceUrl ? fetchTable(sequenceUrl, SEQUENCE_HEADERS, version) : null,
    fetchTable(audioCompositionUrl, audioCompositionHeaders(experience), version),
    fetchTable(imageCompositionUrl, ['cid', 'snum', 'sid', 'chapter_icon_collection', 'chapter_icon_order'], version),
    deckCompositionUrl ? fetchTable(deckCompositionUrl, DECK_COMPOSITION_HEADERS, version) : null,
    illustrationCompositionUrl ? fetchTable(illustrationCompositionUrl, ILLUSTRATION_COMPOSITION_HEADERS, version) : null,
    contemplationCompositionUrl ? fetchTable(contemplationCompositionUrl, CONTEMPLATION_COMPOSITION_HEADERS, version) : null,
    mediaCompositionUrl ? fetchTable(mediaCompositionUrl, MEDIA_COMPOSITION_HEADERS, version) : null
  ]);
  const [audioCollections, imageCatalogs, deckCatalogs, illustrationCatalogs, contemplationCatalogs] = await Promise.all([
    loadAudioCatalogs(audioComposition, audioBinding(experience).collectionField, version),
    loadMediaCatalogs('images', imageComposition, 'chapter_icon_collection', ['sid', 'order', 'image_url'], version),
    deckComposition ? loadMediaCatalogs('deck', deckComposition, 'deck_collection', DECK_CATALOG_HEADERS, version, experience.deckCollections || []) : new Map(),
    illustrationComposition ? loadLocalizedCatalogs({
      type: 'images', composition: illustrationComposition, collectionField: 'image_collection',
      catalogHeaders: ILLUSTRATION_CATALOG_HEADERS, localizedHeaders: ILLUSTRATION_METADATA_HEADERS,
      localizedFields: { en: 'metadata_en_url', kn: 'metadata_kn_url' }, registryHeaders: IMAGE_REGISTRY_HEADERS,
      version, declaredIds: experience.illustrationCollections || []
    }) : new Map(),
    contemplationComposition ? loadLocalizedCatalogs({
      type: 'text', composition: contemplationComposition, collectionField: 'text_collection',
      catalogHeaders: CONTEMPLATION_CATALOG_HEADERS, localizedHeaders: CONTEMPLATION_MASTER_HEADERS,
      localizedFields: { en: 'master_en_url', kn: 'master_kn_url' }, registryHeaders: TEXT_REGISTRY_HEADERS,
      version, declaredIds: experience.contemplationCollections || []
    }) : new Map()
  ]);
  return normalizeCollectionData({
    sa, en, kn, sequence, audioComposition, imageComposition, deckComposition, illustrationComposition, contemplationComposition, mediaComposition,
    audioCatalogs: audioCollections.catalogs,
    audioCueIndexes: audioCollections.cueIndexes,
    audioCueErrors: audioCollections.cueErrors,
    imageCatalogs, deckCatalogs, illustrationCatalogs, contemplationCatalogs, experience,
    resourceUrls: { sequence: sequenceUrl, audio: audioCompositionUrl, images: imageCompositionUrl, decks: deckCompositionUrl, illustrations: illustrationCompositionUrl, contemplations: contemplationCompositionUrl, media: mediaCompositionUrl }
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
  const sequenceUrl = optionalCatalogEntry(experienceCatalog, 'sequence');
  const deckCompositionUrl = optionalCatalogEntry(experienceCatalog, 'decks');
  const illustrationCompositionUrl = optionalCatalogEntry(experienceCatalog, 'illustrations');
  const contemplationCompositionUrl = optionalCatalogEntry(experienceCatalog, 'contemplations');
  const mediaCompositionUrl = optionalCatalogEntry(experienceCatalog, 'media');
  const audioCompositionUrl = catalogEntry(experienceCatalog, 'audio', experienceId);
  const imageCompositionUrl = catalogEntry(experienceCatalog, 'images', experienceId);
  const [sa, en, kn, sequence, audioComposition, imageComposition, deckComposition, illustrationComposition, contemplationComposition, mediaComposition] = await Promise.all([
    table(languageUrls.sa, MASTER_HEADERS.sa),
    table(languageUrls.en, MASTER_HEADERS.en),
    table(languageUrls.kn, MASTER_HEADERS.kn),
    sequenceUrl ? table(sequenceUrl, SEQUENCE_HEADERS) : null,
    table(audioCompositionUrl, audioCompositionHeaders(experience)),
    table(imageCompositionUrl, ['cid', 'snum', 'sid', 'chapter_icon_collection', 'chapter_icon_order']),
    deckCompositionUrl ? table(deckCompositionUrl, DECK_COMPOSITION_HEADERS) : null,
    illustrationCompositionUrl ? table(illustrationCompositionUrl, ILLUSTRATION_COMPOSITION_HEADERS) : null,
    contemplationCompositionUrl ? table(contemplationCompositionUrl, CONTEMPLATION_COMPOSITION_HEADERS) : null,
    mediaCompositionUrl ? table(mediaCompositionUrl, MEDIA_COMPOSITION_HEADERS) : null
  ]);
  async function localCatalogs(type, composition, collectionField, headers, declaredIds = []) {
    const registry = await table(COLLECTION_ROOT + '/' + type + '/collection.csv');
    const catalogs = new Map();
    for (const id of new Set([...declaredIds, ...composition.rows.map((row) => row[collectionField]).filter(Boolean)])) {
      const entry = registryEntry(registry, id, type);
      const catalog = await table(entry.catalog_url, headers);
      catalog.url = entry.catalog_url;
      catalogs.set(id, catalog);
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
  async function localLocalizedCatalogs({ type, composition, collectionField, catalogHeaders, localizedHeaders, localizedFields, registryHeaders, declaredIds = [] }) {
    const registry = await table(COLLECTION_ROOT + '/' + type + '/collection.csv', registryHeaders);
    const catalogs = new Map();
    for (const id of new Set([...declaredIds, ...composition.rows.map((row) => row[collectionField]).filter(Boolean)])) {
      const entry = registryEntry(registry, id, type);
      const catalog = await table(entry.catalog_url, catalogHeaders);
      const localized = {};
      for (const language of ['en', 'kn']) {
        const url = entry[localizedFields[language]];
        if (!url) throw new Error(type + ' collection ' + id + ' does not define ' + language + ' content.');
        localized[language] = await table(url, localizedHeaders);
        verifyOrderedAssetIdentity(catalog, localized[language], type + ' collection ' + id + ' ' + language);
      }
      catalogs.set(id, { catalog, localized });
    }
    return catalogs;
  }
  const [audioCollections, imageCatalogs, deckCatalogs, illustrationCatalogs, contemplationCatalogs] = await Promise.all([
    localAudioCatalogs(),
    localCatalogs('images', imageComposition, 'chapter_icon_collection', ['sid', 'order', 'image_url']),
    deckComposition ? localCatalogs('deck', deckComposition, 'deck_collection', DECK_CATALOG_HEADERS, experience.deckCollections || []) : new Map(),
    illustrationComposition ? localLocalizedCatalogs({
      type: 'images', composition: illustrationComposition, collectionField: 'image_collection',
      catalogHeaders: ILLUSTRATION_CATALOG_HEADERS, localizedHeaders: ILLUSTRATION_METADATA_HEADERS,
      localizedFields: { en: 'metadata_en_url', kn: 'metadata_kn_url' }, registryHeaders: IMAGE_REGISTRY_HEADERS,
      declaredIds: experience.illustrationCollections || []
    }) : new Map(),
    contemplationComposition ? localLocalizedCatalogs({
      type: 'text', composition: contemplationComposition, collectionField: 'text_collection',
      catalogHeaders: CONTEMPLATION_CATALOG_HEADERS, localizedHeaders: CONTEMPLATION_MASTER_HEADERS,
      localizedFields: { en: 'master_en_url', kn: 'master_kn_url' }, registryHeaders: TEXT_REGISTRY_HEADERS,
      declaredIds: experience.contemplationCollections || []
    }) : new Map()
  ]);
  return normalizeCollectionData({
    sa, en, kn, sequence, audioComposition, imageComposition, deckComposition, illustrationComposition, contemplationComposition, mediaComposition,
    audioCatalogs: audioCollections.catalogs,
    audioCueIndexes: audioCollections.cueIndexes,
    audioCueErrors: audioCollections.cueErrors,
    imageCatalogs, deckCatalogs, illustrationCatalogs, contemplationCatalogs, experience, resolveMediaUrl,
    resourceUrls: { sequence: sequenceUrl, audio: audioCompositionUrl, images: imageCompositionUrl, decks: deckCompositionUrl, illustrations: illustrationCompositionUrl, contemplations: contemplationCompositionUrl, media: mediaCompositionUrl }
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
        this.baselines.set(url, value);
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
      for (const illustration of row.media.illustrations || []) {
        if (illustration.imageUrl instanceof Promise) illustration.imageUrl = await illustration.imageUrl;
      }
      for (const item of row.media.items || []) {
        if (item.resolvedUrl instanceof Promise) item.resolvedUrl = await item.resolvedUrl;
        if (item.imageUrl instanceof Promise) item.imageUrl = await item.imageUrl;
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

  async saveCollectionTables(entries) {
    const pending = [];
    for (const entry of entries) {
      if (!entry?.url || !entry.table) throw new Error('Collection table save target is incomplete.');
      const handle = await fileHandleAt(this.rootHandle, entry.url);
      const current = await (await handle.getFile()).text();
      if (current !== this.baselines.get(entry.url)) {
        const error = new Error('The local ' + entry.url.split('/').pop() + ' changed outside Gitaverse. Reload the collections folder before saving.');
        error.code = 'WORKSPACE_CONFLICT';
        throw error;
      }
      pending.push({ ...entry, handle, content: serializeCollectionTable(entry.table) });
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

export function serializeCollectionTable(table) {
  if (!table?.headers?.length || !Array.isArray(table.rows)) throw new Error('Collection table cannot be serialized.');
  return [
    table.headers,
    ...table.rows.map((row) => table.headers.map((header) => row[header] ?? ''))
  ].map((row) => row.map(encode).join('#')).join('\n') + '\n';
}
