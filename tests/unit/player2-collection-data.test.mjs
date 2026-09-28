import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadCollectionExperienceFromFiles, normalizeCollectionData, parseCollectionTable, serializeLanguageMaster } from '../../js/player2/collection-data.js';
import { projectRoot } from '../helpers/collection-data.mjs';

async function table(relative) {
  return parseCollectionTable(await readFile(path.join(projectRoot, relative), 'utf8'), null, relative);
}

const sa = await table('data/collections/verses/bhagavad-gita/master_sa.csv');
const en = await table('data/collections/verses/bhagavad-gita/master_en.csv');
const kn = await table('data/collections/verses/bhagavad-gita/master_kn.csv');
const audioComposition = await table('data/collections/experiences/gita-700/audio.csv');
const imageComposition = await table('data/collections/experiences/gita-700/images.csv');
const audioCatalog = await table('data/collections/audio/chanting-swami-brahmananda/catalog.csv');
const imageCatalog = await table('data/collections/images/gita-chapter-icons/catalog.csv');
const dataset = normalizeCollectionData({
  sa, en, kn, audioComposition, imageComposition,
  audioCatalogs: new Map([['chanting-swami-brahmananda', audioCatalog]]),
  imageCatalogs: new Map([['gita-chapter-icons', imageCatalog]]),
  experience: { id: 'gita-700' }
});

test('player2 builds its normalized model from collection data', () => {
  assert.equal(dataset.schemaVersion, 2);
  assert.equal(dataset.rows.length, 746);
  const verse = dataset.rows.find((row) => row.sid === '6.7');
  assert.ok(verse.source.shloka);
  assert.ok(verse.languages.en.transliteration);
  assert.ok(verse.languages.kn.meaning);
  assert.equal(verse.media.chantFullSaUrl, 'data/collections/audio/chanting-swami-brahmananda/sa/chapter-06/06-007.mp3');
  const chapter = dataset.rows.find((row) => row.sid === '6.B');
  assert.equal(chapter.media.chapterIconUrl, 'data/collections/images/gita-chapter-icons/chapter-06.svg');
  assert.equal(chapter.media.chantFullSaUrl, '');
});

test('player2 language export exactly reproduces every split master', async () => {
  for (const language of ['sa', 'en', 'kn']) {
    const expected = await readFile(path.join(projectRoot, `data/collections/verses/bhagavad-gita/master_${language}.csv`), 'utf8');
    assert.equal(serializeLanguageMaster(dataset, language), expected, language + ' export mismatch');
  }
});

test('player2 refuses shifted collection rows instead of joining by position', () => {
  const shifted = { headers: en.headers, rows: en.rows.slice(1) };
  assert.throws(() => normalizeCollectionData({
    sa, en: shifted, kn, audioComposition, imageComposition,
    audioCatalogs: new Map([['chanting-swami-brahmananda', audioCatalog]]),
    imageCatalogs: new Map([['gita-chapter-icons', imageCatalog]]),
    experience: { id: 'gita-700' }
  }), /canonical SID count/);
});

test('player2 can load the selected collections folder for file-system use', async () => {
  const collections = path.join(projectRoot, 'data/collections');
  const entries = await readdir(collections, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => {
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(collections, absolute).split(path.sep).join('/');
    return {
      name: entry.name,
      webkitRelativePath: 'collections/' + relative,
      text: () => readFile(absolute, 'utf8'),
      testRelativePath: relative
    };
  });
  const originalCreateObjectUrl = URL.createObjectURL;
  URL.createObjectURL = (file) => 'blob:collection-test/' + file.testRelativePath;
  try {
    const localDataset = await loadCollectionExperienceFromFiles('gita-700', files);
    assert.equal(localDataset.rows.length, 746);
    assert.equal(localDataset.rows.find((row) => row.sid === '6.7').media.chantFullSaUrl,
      'blob:collection-test/audio/chanting-swami-brahmananda/sa/chapter-06/06-007.mp3');
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
  }
});
