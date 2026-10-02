import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { assertIdentitySequence, parseTable, projectRoot } from '../helpers/collection-data.mjs';

const sa = await parseTable('data/collections/verses/bhagavad-gita/master_sa.csv');
const en = await parseTable('data/collections/verses/bhagavad-gita/master_en.csv');
const kn = await parseTable('data/collections/verses/bhagavad-gita/master_kn.csv');
const audio = await parseTable('data/collections/experiences/gita-700/audio.csv');
const images = await parseTable('data/collections/experiences/gita-700/images.csv');
const audioRegistry = await parseTable('data/collections/audio/collection.csv');

test('the Sanskrit master declares raw and display shloka fields in the collection contract order', () => {
  assert.deepEqual(sa.headers, ['cid', 'snum', 'sid', 'chapter_name', 'shloka_raw', 'shloka', 'word_by_word', 'meaning', 'word_by_word_meaning']);
  for (const row of sa.rows) {
    assert.ok(Object.hasOwn(row, 'shloka_raw'), `${row.sid} raw field`);
    assert.ok(Object.hasOwn(row, 'shloka'), `${row.sid} display field`);
    assert.equal(row.shloka_raw.includes('\n'), false, `${row.sid} raw shloka must not contain display line breaks`);
  }
});

test('all language masters and Gita-700 compositions have every SID in canonical order', () => {
  for (const [label, dataset] of Object.entries({ sa, en, kn, audio, images })) {
    assert.equal(dataset.rows.length, 746, `${label} row count`);
    assertIdentitySequence(assert, sa.rows, dataset.rows, label);
    assert.equal(new Set(dataset.rows.map((row) => row.sid)).size, 746, `${label} unique SID count`);
  }
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
  assert.equal(new Set(audioRegistry.rows.map((row) => row.collection_id)).size, audioRegistry.rows.length);
  for (const collection of audioRegistry.rows) {
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
