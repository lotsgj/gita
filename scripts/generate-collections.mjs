import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseMaster } from '../js/master-data.js';

const root = process.cwd();
const sourceMasterPath = path.join(root, 'data/master.csv');
const collectionsRoot = path.join(root, 'data/collections');

function encode(value) {
  const encoded = String(value ?? '').replace(/\r\n?/g, '\n').replace(/\n/g, '\\n');
  if (encoded.includes('#')) throw new Error('Collection data cannot contain #.');
  return encoded;
}

function table(headers, rows) {
  return [headers, ...rows].map((row) => row.map(encode).join('#')).join('\n') + '\n';
}

async function write(relative, headers, rows) {
  const destination = path.join(collectionsRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, table(headers, rows));
}

async function writeJson(relative, value) {
  const destination = path.join(collectionsRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(value, null, 2) + '\n');
}

async function digest(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function verifiedCopy(sourceRelative, destinationRelative) {
  const source = path.join(root, sourceRelative);
  const destination = path.join(collectionsRoot, destinationRelative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  if (await digest(source) !== await digest(destination)) {
    throw new Error(`Copied file differs from source: ${sourceRelative}`);
  }
}

const legacy = parseMaster(await readFile(sourceMasterPath, 'utf8'));
const identities = legacy.rows.map(({ cid, snum, sid }) => [cid, snum, sid]);

await write('verses/collection.csv',
  ['collection_id', 'title', 'catalog_url'],
  [['bhagavad-gita', 'Bhagavad Gita', 'data/collections/verses/bhagavad-gita/catalog.csv']]);
await write('verses/bhagavad-gita/catalog.csv',
  ['language', 'content_type', 'content_url'],
  [
    ['sa', 'master', 'data/collections/verses/bhagavad-gita/master_sa.csv'],
    ['en', 'master', 'data/collections/verses/bhagavad-gita/master_en.csv'],
    ['kn', 'master', 'data/collections/verses/bhagavad-gita/master_kn.csv']
  ]);
await write('verses/bhagavad-gita/master_sa.csv',
  ['cid', 'snum', 'sid', 'chapter_name', 'shloka', 'word_by_word', 'meaning', 'word_by_word_meaning'],
  legacy.rows.map((row) => [row.cid, row.snum, row.sid, row.cname_sa, row.shloka_sa, '', row.meaning_sa, row.word_by_word_meaning_sa]));
await write('verses/bhagavad-gita/master_en.csv',
  ['cid', 'snum', 'sid', 'chapter_name', 'transliteration', 'meaning', 'word_by_word_meaning'],
  legacy.rows.map((row) => [row.cid, row.snum, row.sid, row.cname_en, row.shloka_transliteration_en, row.meaning_en, row.word_by_word_meaning_en]));
await write('verses/bhagavad-gita/master_kn.csv',
  ['cid', 'snum', 'sid', 'chapter_name', 'transliteration', 'meaning', 'word_by_word_meaning'],
  legacy.rows.map((row) => [row.cid, row.snum, row.sid, row.cname_kn, row.shloka_transliteration_kn, row.meaning_kn, row.word_by_word_meaning_kn]));

await write('audio/collection.csv',
  ['collection_id', 'title', 'contributor', 'language', 'catalog_url', 'attribution', 'license', 'source'],
  [['chanting-swami-brahmananda', 'Bhagavad Gita Chanting', 'Swami Brahmananda', 'sa', 'data/collections/audio/chanting-swami-brahmananda/catalog.csv', '', '', '']]);

const audioCatalog = [];
const experienceAudio = [];
for (const row of legacy.rows) {
  if (!row.audio_gita_yoga) {
    // Gita-yoga media is deliberately outside this migration.
  } else {
    throw new Error(`Unexpected populated audio_gita_yoga at ${row.sid}; stop and design its migration.`);
  }
  if (!row.audio_gita_700) {
    experienceAudio.push([row.cid, row.snum, row.sid, '', '']);
    continue;
  }
  const prefix = 'data/gita-700/audio/sn/';
  if (!row.audio_gita_700.startsWith(prefix)) {
    throw new Error(`Unexpected Gita-700 audio path at ${row.sid}: ${row.audio_gita_700}`);
  }
  const contentRelative = row.audio_gita_700.slice(prefix.length);
  const newRelative = `audio/chanting-swami-brahmananda/sa/${contentRelative}`;
  await verifiedCopy(row.audio_gita_700, newRelative);
  audioCatalog.push([row.sid, '1', 'sa', `data/collections/${newRelative}`]);
  experienceAudio.push([row.cid, row.snum, row.sid, 'chanting-swami-brahmananda', '1']);
}
await write('audio/chanting-swami-brahmananda/catalog.csv',
  ['sid', 'order', 'language', 'audio_url'], audioCatalog);

await write('images/collection.csv',
  ['collection_id', 'title', 'catalog_url', 'attribution', 'license', 'source'],
  [['gita-chapter-icons', 'Gita Chapter Icons', 'data/collections/images/gita-chapter-icons/catalog.csv', '', '', '']]);
const imageCatalog = [];
const experienceImages = [];
for (const row of legacy.rows) {
  if (!row.icon_gita_700) {
    experienceImages.push([row.cid, row.snum, row.sid, '', '']);
    continue;
  }
  const filename = path.basename(row.icon_gita_700);
  const newRelative = `images/gita-chapter-icons/${filename}`;
  await verifiedCopy(row.icon_gita_700, newRelative);
  imageCatalog.push([row.sid, '1', `data/collections/${newRelative}`]);
  experienceImages.push([row.cid, row.snum, row.sid, 'gita-chapter-icons', '1']);
}
await write('images/gita-chapter-icons/catalog.csv',
  ['sid', 'order', 'image_url'], imageCatalog);

await write('video/collection.csv',
  ['collection_id', 'title', 'catalog_url', 'attribution', 'license', 'source'], []);
await write('animations/collection.csv',
  ['collection_id', 'title', 'catalog_url', 'attribution', 'license', 'source'], []);

await write('experiences/collection.csv',
  ['collection_id', 'title', 'catalog_url'],
  [['gita-700', 'Gita 700', 'data/collections/experiences/gita-700/catalog.csv']]);
await write('experiences/gita-700/catalog.csv',
  ['content_type', 'content_url'],
  [
    ['configuration', 'data/collections/experiences/gita-700/experience.json'],
    ['audio', 'data/collections/experiences/gita-700/audio.csv'],
    ['images', 'data/collections/experiences/gita-700/images.csv']
  ]);
await writeJson('experiences/gita-700/experience.json', {
  id: 'gita-700',
  schemaVersion: 1,
  title: 'Gita 700',
  verseCollection: 'bhagavad-gita',
  languages: ['sa', 'en', 'kn'],
  renderer: 'gita-700',
  resources: {
    audio: 'data/collections/experiences/gita-700/audio.csv',
    images: 'data/collections/experiences/gita-700/images.csv'
  }
});
await write('experiences/gita-700/audio.csv',
  ['cid', 'snum', 'sid', 'chant_full_sa_collection', 'chant_full_sa_order'], experienceAudio);
await write('experiences/gita-700/images.csv',
  ['cid', 'snum', 'sid', 'chapter_icon_collection', 'chapter_icon_order'], experienceImages);

console.log(`Generated collection data for ${identities.length} SIDs, ${audioCatalog.length} audio files, and ${imageCatalog.length} images.`);
