import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { AUDIO_CUE_HEADERS, AUDIO_CUE_PURPOSE_HEADERS, buildAudioCueIndex, loadCollectionExperienceFromFiles, normalizeCollectionData, normalizeGoogleDeckUrl, normalizeImageUrl, openWritableCollectionWorkspace, parseCollectionTable, serializeLanguageMaster } from '../../js/player/collection-data.js';
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
const cueCatalog = await table('tests/fixtures/audio-cues/catalog.csv');
const cuePurposes = parseCollectionTable(
  await readFile(path.join(projectRoot, 'tests/fixtures/audio-cues/cue-purpose.csv'), 'utf8'),
  AUDIO_CUE_PURPOSE_HEADERS,
  'fixture cue-purpose.csv'
);
const cues = parseCollectionTable(
  await readFile(path.join(projectRoot, 'tests/fixtures/audio-cues/cue.csv'), 'utf8'),
  AUDIO_CUE_HEADERS,
  'fixture cue.csv'
);
const dataset = normalizeCollectionData({
  sa, en, kn, audioComposition, imageComposition,
  audioCatalogs: new Map([['chanting-swami-brahmananda', audioCatalog]]),
  imageCatalogs: new Map([['gita-chapter-icons', imageCatalog]]),
  experience: { id: 'gita-700' }
});

async function fakeWritableCollections() {
  const collections = path.join(projectRoot, 'data/collections');
  const entries = await readdir(collections, { recursive: true, withFileTypes: true });
  const contents = new Map();
  for (const entry of entries.filter((candidate) => candidate.isFile())) {
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(collections, absolute).split(path.sep).join('/');
    contents.set(relative, await readFile(absolute));
  }
  function directory(prefix = '') {
    return {
      kind: 'directory',
      name: prefix.split('/').filter(Boolean).at(-1) || 'collections',
      async getDirectoryHandle(name) { return directory(prefix + name + '/'); },
      async getFileHandle(name) {
        const relative = prefix + name;
        if (!contents.has(relative)) throw new Error('Not found: ' + relative);
        return {
          kind: 'file',
          name,
          async getFile() {
            const content = contents.get(relative);
            return {
              testRelativePath: relative,
              async text() { return Buffer.from(content).toString('utf8'); }
            };
          },
          async createWritable() {
            let next;
            return {
              async write(value) { next = Buffer.from(String(value)); },
              async close() { contents.set(relative, next); }
            };
          }
        };
      }
    };
  }
  return { handle: directory(), contents };
}

test('the player builds its normalized model from collection data', () => {
  assert.equal(dataset.schemaVersion, 3);
  assert.equal(dataset.rows.length, 746);
  const verse = dataset.rows.find((row) => row.sid === '6.7');
  assert.ok(verse.source.shlokaRaw);
  assert.ok(verse.source.shloka);
  assert.equal(verse.source.shlokaRaw.includes('\n'), false);
  assert.equal(verse.source.shloka.includes('\n'), true);
  assert.ok(verse.languages.en.transliteration);
  assert.ok(verse.languages.kn.meaning);
  assert.equal(verse.media.chantFullSaUrl, 'data/collections/audio/chanting-swami-brahmananda/sa/chapter-06/06-007.mp3');
  assert.deepEqual(verse.media.chantFullSaCues, []);
  const chapter = dataset.rows.find((row) => row.sid === '6.B');
  assert.equal(chapter.media.chapterIconUrl, 'data/collections/images/gita-chapter-icons/chapter-06.svg');
  assert.equal(chapter.media.chantFullSaUrl, '');
});

test('audio cues resolve purpose metadata and are indexed by SID plus asset order', () => {
  const result = buildAudioCueIndex({
    collectionId: 'fixture-learning-mode',
    catalog: cueCatalog,
    cuePurposes,
    cues
  });
  assert.equal(result.errors.length, 0);
  assert.equal(result.cuesByAsset.size, 2);
  assert.deepEqual(result.cuesByAsset.get('1.1:1').map(({ cueId }) => cueId),
    ['words', 'paada', 'ardha', 'padya', 'meaning_en', 'meaning_kn']);
  assert.deepEqual(result.cuesByAsset.get('1.1:1')[4], {
    order: 5,
    cueId: 'meaning_en',
    language: 'en',
    purpose: 'meaning',
    description: 'English meaning',
    startMs: 49000,
    endMs: 57000
  });
});

test('normalized verse media receives only the cue set for its selected audio asset', () => {
  const cue = Object.freeze({ order: 1, cueId: 'padya', language: 'sa', purpose: 'padya', description: 'Full verse', startMs: 0, endMs: 12000 });
  const withCues = normalizeCollectionData({
    sa, en, kn, audioComposition, imageComposition,
    audioCatalogs: new Map([['chanting-swami-brahmananda', audioCatalog]]),
    audioCueIndexes: new Map([['chanting-swami-brahmananda', new Map([['6.7:1', Object.freeze([cue])]])]]),
    imageCatalogs: new Map([['gita-chapter-icons', imageCatalog]]),
    experience: { id: 'gita-700' }
  });
  assert.deepEqual(withCues.rows.find((row) => row.sid === '6.7').media.chantFullSaCues, [cue]);
  assert.deepEqual(withCues.rows.find((row) => row.sid === '6.8').media.chantFullSaCues, []);
});

test('an invalid asset cue set falls back without removing valid asset cues', () => {
  const invalidRows = cues.rows.map((row) => ({ ...row }));
  invalidRows.find((row) => row.sid === '1.2' && row.cue_order === '3').start_ms = '22000';
  const result = buildAudioCueIndex({
    collectionId: 'fixture-learning-mode',
    catalog: cueCatalog,
    cuePurposes,
    cues: { headers: cues.headers, rows: invalidRows },
    strict: false
  });
  assert.ok(result.cuesByAsset.has('1.1:1'));
  assert.equal(result.cuesByAsset.has('1.2:1'), false);
  assert.match(result.errors.join(' '), /1\.2:1 cue 3 overlaps cue 2/);
  assert.throws(() => buildAudioCueIndex({
    collectionId: 'fixture-learning-mode',
    catalog: cueCatalog,
    cuePurposes,
    cues: { headers: cues.headers, rows: invalidRows }
  }), /cue 3 overlaps cue 2/);
});

test('a 4,500-row cue catalog indexes once without touching audio URLs', () => {
  const catalogRows = [];
  const cueRows = [];
  const purposeIds = ['words', 'paada', 'ardha', 'padya', 'meaning_en', 'meaning_kn'];
  for (let asset = 1; asset <= 750; asset += 1) {
    const sid = 'T.' + asset;
    catalogRows.push({ sid, order: '1', language: 'sa-kn-en', audio_url: 'unrequested/' + asset + '.mp3' });
    purposeIds.forEach((cueId, index) => cueRows.push({
      sid,
      asset_order: '1',
      cue_order: String(index + 1),
      cue_id: cueId,
      start_ms: String(index * 10000),
      end_ms: String((index + 1) * 10000)
    }));
  }
  const started = performance.now();
  const result = buildAudioCueIndex({
    collectionId: 'scale-fixture',
    catalog: { headers: cueCatalog.headers, rows: catalogRows },
    cuePurposes,
    cues: { headers: AUDIO_CUE_HEADERS, rows: cueRows }
  });
  const elapsed = performance.now() - started;
  assert.equal(result.cuesByAsset.size, 750);
  assert.equal(cueRows.length, 4500);
  assert.ok(elapsed < 1000, `4,500 cues should index in under one second; took ${elapsed.toFixed(1)} ms`);
  assert.equal(catalogRows[0].audio_url, 'unrequested/1.mp3');
});

test('the player identifies the legacy Sanskrit master schema clearly', () => {
  const legacy = 'cid#snum#sid#chapter_name#shloka#word_by_word#meaning#word_by_word_meaning\n1#1#1.1##श्लोकम्###\n';
  assert.throws(
    () => parseCollectionTable(legacy, ['cid', 'snum', 'sid', 'chapter_name', 'shloka_raw', 'shloka', 'word_by_word', 'meaning', 'word_by_word_meaning'], 'master_sa.csv'),
    /legacy Sanskrit schema.*shloka_raw between chapter_name and shloka/
  );
});

test('the player language export exactly reproduces every split master', async () => {
  for (const language of ['sa', 'en', 'kn']) {
    const expected = await readFile(path.join(projectRoot, `data/collections/verses/bhagavad-gita/master_${language}.csv`), 'utf8');
    assert.equal(serializeLanguageMaster(dataset, language), expected, language + ' export mismatch');
  }
});

test('the player refuses shifted collection rows instead of joining by position', () => {
  const shifted = { headers: en.headers, rows: en.rows.slice(1) };
  assert.throws(() => normalizeCollectionData({
    sa, en: shifted, kn, audioComposition, imageComposition,
    audioCatalogs: new Map([['chanting-swami-brahmananda', audioCatalog]]),
    imageCatalogs: new Map([['gita-chapter-icons', imageCatalog]]),
    experience: { id: 'gita-700' }
  }), /canonical SID count/);
});

test('the player can load the selected collections folder for file-system use', async () => {
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

test('Google presentation URLs become minimal embed URLs without retaining share parameters', () => {
  const normalized = new URL(normalizeGoogleDeckUrl('https://docs.google.com/presentation/d/abc123/edit?usp=sharing'));
  assert.equal(normalized.pathname, '/presentation/d/abc123/embed');
  assert.equal(normalized.searchParams.get('start'), 'false');
  assert.equal(normalized.searchParams.get('loop'), 'false');
  assert.equal(normalized.searchParams.get('delayms'), '3000');
  assert.equal(normalized.searchParams.get('rm'), 'minimal');
  assert.equal(normalized.searchParams.has('usp'), false);
  assert.throws(() => normalizeGoogleDeckUrl('https://example.com/deck'), /Only https:\/\/docs\.google\.com/);
});

test('image URLs support app-relative and external HTTPS sources only', () => {
  assert.deepEqual(normalizeImageUrl('data/collections/images/sample.webp', (url) => 'blob:' + url), {
    sourceUrl: 'data/collections/images/sample.webp', resolvedUrl: 'blob:data/collections/images/sample.webp', isExternal: false
  });
  assert.deepEqual(normalizeImageUrl('https://media.example.org/sample.webp'), {
    sourceUrl: 'https://media.example.org/sample.webp', resolvedUrl: 'https://media.example.org/sample.webp', isExternal: true
  });
  for (const unsafe of ['http://example.org/a.png', 'javascript:alert(1)', 'data:image/png;base64,x', '/root/image.png', '//example.org/a.png']) {
    assert.throws(() => normalizeImageUrl(unsafe), /app-relative path or an absolute HTTPS URL/);
  }
});

test('the Gita-Sara collection loads its ordered subset, audio, and minimal Google deck', async () => {
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
  URL.createObjectURL = (file) => 'blob:gita-sara-test/' + file.testRelativePath;
  try {
    const sara = await loadCollectionExperienceFromFiles('gita-sara', files);
    assert.equal(sara.rows.length, 135);
    assert.deepEqual(sara.rows.slice(0, 3).map((row) => row.sid), ['D.1', 'D.2', 'D.3']);
    assert.equal(sara.rows.at(-1).sid, '18.78');
    assert.match(sara.rows.find((row) => row.sid === '2.47').media.primaryAudioUrl, /02-047\.mp3$/);
    const deck = sara.rows.find((row) => row.sid === '2.47').media.decks[0];
    assert.equal(deck.collectionId, 'gita-sara-google-decks');
    assert.equal(new URL(deck.embedUrl).searchParams.get('rm'), 'minimal');
    const authored = sara.rows.find((row) => row.sid === '2.47');
    assert.equal(authored.media.illustrations.length, 2);
    assert.ok(authored.media.illustrations.every((item) => item.isFallback === false));
    assert.match(authored.media.illustrations[0].imageUrl, /^blob:gita-sara-test\/images\/gita-sara-illustrations\//);
    assert.equal(authored.media.illustrations[0].localized.en.caption, '');
    assert.match(authored.media.illustrations[1].localized.en.caption, /Care for the action/);
    assert.equal(authored.contemplation.lines.length, 4);
    assert.ok(authored.contemplation.lines.every((item) => item.isFallback === false && item.type === 'question'));
    assert.match(authored.contemplation.lines[0].localized.en, /complete attention/);
    assert.match(authored.contemplation.lines[0].localized.kn, /ಸಂಪೂರ್ಣ ಗಮನ/);
    assert.deepEqual(authored.media.items.map((item) => item.mediaType), ['image', 'google_deck', 'image']);
    assert.deepEqual(authored.media.items.map((item) => item.order), [1, 2, 3]);
    assert.equal(authored.media.items[0].localized.en.caption, '');
    assert.match(authored.media.items[1].resolvedUrl, /docs\.google\.com\/presentation/);

    const fallback = sara.rows.find((row) => row.sid === 'D.1');
    assert.equal(fallback.media.illustrations.length, 1);
    assert.equal(fallback.media.illustrations[0].isFallback, true);
    assert.match(fallback.media.illustrations[0].imageUrl, /gita-sara-default-illustration\/transformation-cycle-clean\.png$/);
    assert.equal(fallback.media.items[0].localized.en.altText, 'TRUTH. REALISE. USE.');
    assert.equal(fallback.media.items[0].localized.en.caption, 'TRUTH. REALISE. USE.');
    assert.equal(fallback.media.items[0].localized.kn.altText, 'ಸತ್ಯ. ಅರಿವು. ಉಪಯೋಗ.');
    assert.equal(fallback.media.items[0].localized.kn.caption, 'ಸತ್ಯ. ಅರಿವು. ಉಪಯೋಗ.');
    assert.equal(fallback.contemplation.lines.length, 1);
    assert.equal(fallback.contemplation.lines[0].isFallback, true);
    assert.ok(fallback.contemplation.lines[0].localized.en);
    assert.ok(fallback.contemplation.lines[0].localized.kn);
    assert.equal(fallback.media.items.length, 1);
    assert.equal(fallback.media.items[0].mediaType, 'image');
    assert.equal(fallback.media.items[0].isFallback, true);
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

test('a writable collections workspace updates only the affected language master', async () => {
  const local = await fakeWritableCollections();
  const originalCreateObjectUrl = URL.createObjectURL;
  URL.createObjectURL = (file) => 'blob:writable-test/' + file.testRelativePath;
  try {
    const { dataset: writableDataset, workspace } = await openWritableCollectionWorkspace('gita-700', local.handle);
    const saBefore = Buffer.from(local.contents.get('verses/bhagavad-gita/master_sa.csv'));
    const verse = writableDataset.rows.find((row) => row.sid === '6.7');
    verse.languages.en.meaning = 'Direct workspace regression meaning';
    assert.deepEqual(await workspace.saveLanguageMasters(writableDataset, ['en']), ['master_en.csv']);
    assert.match(local.contents.get('verses/bhagavad-gita/master_en.csv').toString('utf8'), /Direct workspace regression meaning/);
    assert.deepEqual(local.contents.get('verses/bhagavad-gita/master_sa.csv'), saBefore);
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

test('a writable Gita Sara workspace saves deck catalog and composition without touching verse masters', async () => {
  const local = await fakeWritableCollections();
  const originalCreateObjectUrl = URL.createObjectURL;
  URL.createObjectURL = (file) => 'blob:deck-write-test/' + file.testRelativePath;
  try {
    const { dataset: writableDataset, workspace } = await openWritableCollectionWorkspace('gita-sara', local.handle);
    const verseMasterBefore = Buffer.from(local.contents.get('verses/bhagavad-gita/master_sa.csv'));
    const slot = writableDataset.rows.find((row) => row.sid === '2.47').media.deckSlots[0];
    slot.catalogRow.deck_url = 'https://docs.google.com/presentation/d/updatedDeckId/edit';
    slot.compositionRow.order = '1';
    const saved = await workspace.saveCollectionTables([
      { url: slot.compositionUrl, table: slot.compositionTable },
      { url: slot.catalogUrl, table: slot.catalog }
    ]);
    assert.deepEqual(saved, ['decks.csv', 'catalog.csv']);
    assert.match(local.contents.get('deck/gita-sara-google-decks/catalog.csv').toString('utf8'), /updatedDeckId/);
    assert.deepEqual(local.contents.get('verses/bhagavad-gita/master_sa.csv'), verseMasterBefore);
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

test('a Sanskrit workspace save preserves raw text while updating display text', async () => {
  const local = await fakeWritableCollections();
  const originalCreateObjectUrl = URL.createObjectURL;
  URL.createObjectURL = (file) => 'blob:raw-preservation-test/' + file.testRelativePath;
  try {
    const { dataset: writableDataset, workspace } = await openWritableCollectionWorkspace('gita-700', local.handle);
    const verse = writableDataset.rows.find((row) => row.sid === '6.7');
    const rawBefore = verse.source.shlokaRaw;
    verse.source.shloka = verse.source.shloka + '\n';
    await workspace.saveLanguageMasters(writableDataset, ['sa']);
    const saved = parseCollectionTable(local.contents.get('verses/bhagavad-gita/master_sa.csv').toString('utf8'));
    const savedVerse = saved.rows.find((row) => row.sid === '6.7');
    assert.equal(savedVerse.shloka_raw, rawBefore);
    assert.equal(savedVerse.shloka, verse.source.shloka);
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

test('a writable collections workspace refuses to overwrite an externally changed master', async () => {
  const local = await fakeWritableCollections();
  const originalCreateObjectUrl = URL.createObjectURL;
  URL.createObjectURL = (file) => 'blob:conflict-test/' + file.testRelativePath;
  try {
    const { dataset: writableDataset, workspace } = await openWritableCollectionWorkspace('gita-700', local.handle);
    const masterPath = 'verses/bhagavad-gita/master_en.csv';
    local.contents.set(masterPath, Buffer.concat([local.contents.get(masterPath), Buffer.from('\n')]))
    writableDataset.rows.find((row) => row.sid === '6.7').languages.en.meaning = 'Must not overwrite';
    await assert.rejects(
      workspace.saveLanguageMasters(writableDataset, ['en']),
      (error) => error.code === 'WORKSPACE_CONFLICT' && /changed outside Gitaverse/.test(error.message)
    );
    assert.equal(local.contents.get(masterPath).toString('utf8').includes('Must not overwrite'), false);
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

test('a writable collections workspace validates the selected folder structure', async () => {
  const empty = {
    kind: 'directory', name: 'not-collections',
    async getDirectoryHandle() { return this; },
    async getFileHandle() { throw new Error('missing'); }
  };
  await assert.rejects(openWritableCollectionWorkspace('gita-700', empty), /missing experiences\/collection\.csv/);
});
