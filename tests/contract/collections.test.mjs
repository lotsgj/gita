import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assertIdentitySequence, parseTable, projectRoot } from '../helpers/collection-data.mjs';

const sa = await parseTable('data/collections/verses/bhagavad-gita/master_sa.csv');
const en = await parseTable('data/collections/verses/bhagavad-gita/master_en.csv');
const kn = await parseTable('data/collections/verses/bhagavad-gita/master_kn.csv');
const audio = await parseTable('data/collections/experiences/gita-700/audio.csv');
const images = await parseTable('data/collections/experiences/gita-700/images.csv');
const yogaAudio = await parseTable('data/collections/experiences/gita-yoga/audio.csv');
const audioRegistry = await parseTable('data/collections/audio/collection.csv');
const saraSequence = await parseTable('data/collections/experiences/gita-sara/sequence.csv');
const saraAudio = await parseTable('data/collections/experiences/gita-sara/audio.csv');
const saraDecks = await parseTable('data/collections/experiences/gita-sara/decks.csv');
const saraIllustrations = await parseTable('data/collections/experiences/gita-sara/illustrations.csv');
const saraContemplations = await parseTable('data/collections/experiences/gita-sara/contemplations.csv');
const saraMedia = await parseTable('data/collections/experiences/gita-sara/media.csv');
const deckRegistry = await parseTable('data/collections/deck/collection.csv');
const saraDeckCatalog = await parseTable('data/collections/deck/gita-sara-google-decks/catalog.csv');
const imageRegistry = await parseTable('data/collections/images/collection.csv');
const textRegistry = await parseTable('data/collections/text/collection.csv');

test('the Sanskrit master declares raw and display shloka fields in the collection contract order', () => {
  assert.deepEqual(sa.headers, ['cid', 'snum', 'sid', 'chapter_name', 'shloka_raw', 'shloka', 'word_by_word', 'meaning', 'word_by_word_meaning']);
  for (const row of sa.rows) {
    assert.ok(Object.hasOwn(row, 'shloka_raw'), `${row.sid} raw field`);
    assert.ok(Object.hasOwn(row, 'shloka'), `${row.sid} display field`);
    assert.equal(row.shloka_raw.includes('\n'), false, `${row.sid} raw shloka must not contain display line breaks`);
  }
});

test('all language masters and experience compositions have every SID in canonical order', () => {
  for (const [label, dataset] of Object.entries({ sa, en, kn, audio, yogaAudio, images })) {
    assert.equal(dataset.rows.length, 746, `${label} row count`);
    assertIdentitySequence(assert, sa.rows, dataset.rows, label);
    assert.equal(new Set(dataset.rows.map((row) => row.sid)).size, 746, `${label} unique SID count`);
  }
});

test('Gita-Yoga references every available learning-mode audio exactly once', async () => {
  assert.deepEqual(yogaAudio.headers, ['cid', 'snum', 'sid', 'audio_collection', 'audio_order']);
  const learningModeCatalog = await parseTable('data/collections/audio/chanting-aj-padma-aj-vijay-learn-mode/catalog.csv');
  const expected = new Set(learningModeCatalog.rows.map((row) => `${row.sid}:${row.order}`));
  const actual = new Set();
  for (const row of yogaAudio.rows) {
    assert.equal(Boolean(row.audio_collection), Boolean(row.audio_order), `${row.sid} audio reference completeness`);
    if (!row.audio_order) continue;
    assert.equal(row.audio_collection, 'chanting-aj-padma-aj-vijay-learn-mode');
    actual.add(`${row.sid}:${row.audio_order}`);
  }
  assert.deepEqual(actual, expected);
});

test('English and Kannada masters provide one consistent chapter name for every chapter', () => {
  for (const [language, master] of Object.entries({ en, kn })) {
    for (const cid of [...new Set(master.rows.map((row) => row.cid))]) {
      const names = new Set(master.rows.filter((row) => row.cid === cid).map((row) => row.chapter_name));
      assert.equal(names.size, 1, `master_${language}.csv chapter ${cid} must have one consistent chapter name`);
      assert.ok([...names][0], `master_${language}.csv chapter ${cid} must have a chapter name`);
    }
  }
});

test('all media catalog keys are unique and resolve to files', async () => {
  const audioCatalog = await parseTable('data/collections/audio/chanting-swami-brahmananda/catalog.csv');
  const learningModeCatalog = await parseTable('data/collections/audio/chanting-aj-padma-aj-vijay-learn-mode/catalog.csv');
  const imageCatalog = await parseTable('data/collections/images/gita-chapter-icons/catalog.csv');
  assert.equal(audioCatalog.rows.length, 700);
  assert.equal(learningModeCatalog.rows.length, 314);
  assert.equal(imageCatalog.rows.length, 19);
  for (const [label, catalog, urlField] of [
    ['audio', audioCatalog, 'audio_url'],
    ['learning-mode audio', learningModeCatalog, 'audio_url'],
    ['images', imageCatalog, 'image_url']
  ]) {
    const keys = catalog.rows.map((row) => `${row.sid}:${row.order}`);
    assert.equal(new Set(keys).size, keys.length, `${label} sid+order keys must be unique`);
    for (const row of catalog.rows) {
      assert.match(row.order, /^[1-9]\d*$/);
      await access(path.join(projectRoot, row[urlField]));
    }
  }
});

test('every registered audio collection has a readable catalog', async () => {
  assert.deepEqual(audioRegistry.headers, ['collection_id', 'title', 'contributor', 'language', 'catalog_url', 'cue_purpose_url', 'cue_url', 'attribution', 'license', 'source']);
  assert.equal(new Set(audioRegistry.rows.map((row) => row.collection_id)).size, audioRegistry.rows.length);
  for (const collection of audioRegistry.rows) {
    assert.equal(Boolean(collection.cue_purpose_url), Boolean(collection.cue_url), `${collection.collection_id} cue files must be declared as a pair`);
    const catalog = await parseTable(collection.catalog_url);
    assert.deepEqual(catalog.headers, ['sid', 'order', 'language', 'audio_url']);
    assert.ok(catalog.rows.length > 0, `${collection.collection_id} catalog must not be empty`);
  }
});

test('every populated experience media reference resolves exactly once', async () => {
  const audioCatalog = await parseTable('data/collections/audio/chanting-swami-brahmananda/catalog.csv');
  const imageCatalog = await parseTable('data/collections/images/gita-chapter-icons/catalog.csv');
  const audioKeys = new Set(audioCatalog.rows.map((row) => `${row.sid}:${row.order}`));
  const imageKeys = new Set(imageCatalog.rows.map((row) => `${row.sid}:${row.order}`));
  for (const row of audio.rows) {
    assert.equal(Boolean(row.chant_full_sa_collection), Boolean(row.chant_full_sa_order));
    if (row.chant_full_sa_order) {
      assert.equal(row.chant_full_sa_collection, 'chanting-swami-brahmananda');
      assert.ok(audioKeys.has(`${row.sid}:${row.chant_full_sa_order}`));
    }
  }
  for (const row of images.rows) {
    assert.equal(Boolean(row.chapter_icon_collection), Boolean(row.chapter_icon_order));
    if (row.chapter_icon_order) {
      assert.equal(row.chapter_icon_collection, 'gita-chapter-icons');
      assert.ok(imageKeys.has(`${row.sid}:${row.chapter_icon_order}`));
    }
  }
});

test('Gita-Sara preserves the approved 135-SID sequence and master identities', () => {
  assert.deepEqual(saraSequence.headers, ['position', 'cid', 'snum', 'sid']);
  assert.equal(saraSequence.rows.length, 135);
  assert.equal(new Set(saraSequence.rows.map((row) => row.sid)).size, 135);
  assert.deepEqual(saraSequence.rows.map((row) => Number(row.position)), Array.from({ length: 135 }, (_, index) => index + 1));

  const masterBySid = new Map(sa.rows.map((row) => [row.sid, row]));
  for (const row of saraSequence.rows) {
    const master = masterBySid.get(row.sid);
    assert.ok(master, `${row.sid} must exist in the Sanskrit master`);
    assert.deepEqual([row.cid, row.snum], [master.cid, master.snum], `${row.sid} identity`);
  }

  const sidDigest = createHash('sha256').update(saraSequence.rows.map((row) => row.sid).join(',')).digest('hex');
  assert.equal(sidDigest, 'ef26e43bb8aa24b539aa7cbcbea1c806533e5c103c82cecd42876e263d77fbdf');
});

test('Gita-Sara audio and deck compositions retain every selected SID in sequence order', () => {
  assert.deepEqual(saraAudio.headers, ['cid', 'snum', 'sid', 'audio_collection', 'audio_order']);
  assert.deepEqual(saraDecks.headers, ['cid', 'snum', 'sid', 'order', 'deck_collection', 'deck_order']);
  assertIdentitySequence(assert, saraSequence.rows, saraAudio.rows, 'Gita-Sara audio');
  assertIdentitySequence(assert, saraSequence.rows, saraDecks.rows, 'Gita-Sara decks');
});

test('Gita-Sara illustration and contemplation compositions cover all selected SIDs in order', () => {
  assert.deepEqual(saraIllustrations.headers, ['cid', 'snum', 'sid', 'order', 'image_collection', 'image_order']);
  assert.deepEqual(saraContemplations.headers, ['cid', 'snum', 'sid', 'order', 'text_collection', 'text_order']);
  for (const [label, composition] of [['illustrations', saraIllustrations], ['contemplations', saraContemplations]]) {
    const groups = new Map();
    composition.rows.forEach((row) => {
      if (!groups.has(row.sid)) groups.set(row.sid, []);
      groups.get(row.sid).push(row);
    });
    assert.equal(groups.size, 135, `${label} selected SID coverage`);
    assert.deepEqual([...groups.keys()], saraSequence.rows.map((row) => row.sid), `${label} SID order`);
    for (const selected of saraSequence.rows) {
      const rows = groups.get(selected.sid);
      assert.ok(rows?.length, `${label} ${selected.sid} placeholder`);
      rows.forEach((row, index) => {
        assert.deepEqual([row.cid, row.snum], [selected.cid, selected.snum], `${label} ${selected.sid} identity`);
        assert.equal(row.order, String(index + 1), `${label} ${selected.sid} order`);
      });
    }
  }
  assert.equal(saraIllustrations.rows.filter((row) => row.sid === '2.47').length, 2);
  assert.equal(saraContemplations.rows.filter((row) => row.sid === '2.47').length, 4);
});

test('Gita-Sara unified media composition covers every SID and orders mixed media explicitly', () => {
  assert.deepEqual(saraMedia.headers, ['cid', 'snum', 'sid', 'order', 'media_type', 'collection', 'asset_order']);
  const groups = new Map();
  saraMedia.rows.forEach((row) => {
    if (!groups.has(row.sid)) groups.set(row.sid, []);
    groups.get(row.sid).push(row);
  });
  assert.deepEqual([...groups.keys()], saraSequence.rows.map((row) => row.sid));
  saraSequence.rows.forEach((selected) => {
    const rows = groups.get(selected.sid);
    assert.ok(rows?.length, `${selected.sid} media placeholder`);
    rows.forEach((row, index) => {
      assert.deepEqual([row.cid, row.snum, row.order], [selected.cid, selected.snum, String(index + 1)]);
      assert.equal(Boolean(row.media_type), Boolean(row.collection));
      assert.equal(Boolean(row.collection), Boolean(row.asset_order));
      if (row.media_type) assert.ok(['image', 'google_deck'].includes(row.media_type));
    });
  });
  assert.deepEqual(groups.get('2.47').map(({ media_type, collection, asset_order }) => [media_type, collection, asset_order]), [
    ['image', 'gita-sara-illustrations', '1'],
    ['google_deck', 'gita-sara-google-decks', '1'],
    ['image', 'gita-sara-illustrations', '2']
  ]);
});

test('Gita-Sara localized illustration and contemplation collections resolve by SID plus order', async () => {
  assert.deepEqual(imageRegistry.headers, ['collection_id', 'title', 'catalog_url', 'metadata_en_url', 'metadata_kn_url', 'attribution', 'license', 'source']);
  assert.deepEqual(textRegistry.headers, ['collection_id', 'title', 'catalog_url', 'master_en_url', 'master_kn_url', 'attribution', 'license', 'source']);

  const checkCollection = async ({ registry, id, catalogHeaders, localizedFields, localizedHeaders, requireField, mediaField }) => {
    const entry = registry.rows.find((row) => row.collection_id === id);
    assert.ok(entry, `${id} registry entry`);
    const catalog = await parseTable(entry.catalog_url);
    assert.deepEqual(catalog.headers, catalogHeaders);
    const catalogKeys = catalog.rows.map((row) => `${row.sid}:${row.order}`);
    assert.equal(new Set(catalogKeys).size, catalogKeys.length, `${id} catalog keys`);
    if (mediaField) for (const row of catalog.rows) await access(path.join(projectRoot, row[mediaField]));
    for (const field of localizedFields) {
      const localized = await parseTable(entry[field]);
      assert.deepEqual(localized.headers, localizedHeaders);
      assert.deepEqual(localized.rows.map((row) => `${row.sid}:${row.order}`), catalogKeys, `${id} ${field} alignment`);
      assert.ok(localized.rows.every((row) => row[requireField]), `${id} ${field} ${requireField}`);
    }
    return catalog;
  };

  const illustrations = await checkCollection({
    registry: imageRegistry, id: 'gita-sara-illustrations',
    catalogHeaders: ['sid', 'order', 'image_url'], localizedFields: ['metadata_en_url', 'metadata_kn_url'],
    localizedHeaders: ['sid', 'order', 'alt_text', 'caption'], requireField: 'alt_text', mediaField: 'image_url'
  });
  const defaultIllustration = await checkCollection({
    registry: imageRegistry, id: 'gita-sara-default-illustration',
    catalogHeaders: ['sid', 'order', 'image_url'], localizedFields: ['metadata_en_url', 'metadata_kn_url'],
    localizedHeaders: ['sid', 'order', 'alt_text', 'caption'], requireField: 'alt_text', mediaField: 'image_url'
  });
  const contemplations = await checkCollection({
    registry: textRegistry, id: 'gita-sara-contemplations',
    catalogHeaders: ['sid', 'order', 'line_type'], localizedFields: ['master_en_url', 'master_kn_url'],
    localizedHeaders: ['sid', 'order', 'text'], requireField: 'text'
  });
  const defaultContemplation = await checkCollection({
    registry: textRegistry, id: 'gita-sara-default-contemplation',
    catalogHeaders: ['sid', 'order', 'line_type'], localizedFields: ['master_en_url', 'master_kn_url'],
    localizedHeaders: ['sid', 'order', 'text'], requireField: 'text'
  });
  assert.deepEqual(illustrations.rows.map((row) => `${row.sid}:${row.order}`), ['2.47:1', '2.47:2']);
  assert.deepEqual(contemplations.rows.map((row) => `${row.sid}:${row.order}`), ['2.47:1', '2.47:2', '2.47:3', '2.47:4']);
  assert.deepEqual(defaultIllustration.rows.map((row) => `${row.sid}:${row.order}`), ['DEFAULT:1']);
  assert.deepEqual(defaultContemplation.rows.map((row) => `${row.sid}:${row.order}`), ['DEFAULT:1']);
});

test('Gita-Sara resolves Swami Brahmananda audio and preserves explicit Dhyana gaps', async () => {
  const swamiCatalog = await parseTable('data/collections/audio/chanting-swami-brahmananda/catalog.csv');
  const audioKeys = new Set(swamiCatalog.rows.map((row) => `${row.sid}:${row.order}`));
  let resolved = 0;
  let missing = 0;
  for (const row of saraAudio.rows) {
    assert.equal(Boolean(row.audio_collection), Boolean(row.audio_order), `${row.sid} audio reference completeness`);
    if (!row.audio_order) {
      assert.match(row.sid, /^D\.[1-9]$/, `${row.sid} is an unexpected audio gap`);
      missing += 1;
      continue;
    }
    assert.equal(row.audio_collection, 'chanting-swami-brahmananda');
    assert.ok(audioKeys.has(`${row.sid}:${row.audio_order}`), `${row.sid} audio reference`);
    resolved += 1;
  }
  assert.equal(resolved, 126);
  assert.equal(missing, 9);
});

test('Gita-Sara Google-deck collection is complete with explicit optional slots', () => {
  assert.deepEqual(deckRegistry.headers, ['collection_id', 'title', 'provider', 'language', 'catalog_url', 'attribution', 'license', 'source']);
  assert.deepEqual(deckRegistry.rows.map((row) => row.collection_id), ['gita-sara-google-decks']);
  assert.deepEqual(saraDeckCatalog.headers, ['sid', 'order', 'language', 'deck_url', 'title']);
  assert.equal(saraDeckCatalog.rows.length, 135);
  assert.deepEqual(saraDeckCatalog.rows.map((row) => row.sid), saraSequence.rows.map((row) => row.sid));
  assert.ok(saraDeckCatalog.rows.every((row) => row.order === '1'));
  const populated = saraDeckCatalog.rows.filter((row) => row.deck_url);
  assert.deepEqual(populated.map((row) => row.sid), ['1.1', '2.47']);
  assert.ok(populated.every((row) => /^https:\/\/docs\.google\.com\/presentation\/d\//.test(row.deck_url)));
  assert.deepEqual(
    saraDecks.rows.filter((row) => row.deck_collection).map(({ sid, deck_collection, deck_order }) => [sid, deck_collection, deck_order]),
    [['1.1', 'gita-sara-google-decks', '1'], ['2.47', 'gita-sara-google-decks', '1']]
  );
});
