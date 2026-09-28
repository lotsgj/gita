import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseMaster } from '../../js/master-data.js';
import { parseTable, projectRoot } from '../helpers/collection-data.mjs';

const legacy = parseMaster(await readFile(path.join(projectRoot, 'data/master.csv'), 'utf8'));
const bySid = new Map(legacy.rows.map((row) => [row.sid, row]));
const sa = await parseTable('data/collections/verses/bhagavad-gita/master_sa.csv');
const en = await parseTable('data/collections/verses/bhagavad-gita/master_en.csv');
const kn = await parseTable('data/collections/verses/bhagavad-gita/master_kn.csv');

test('split language masters preserve every legacy text field exactly', () => {
  for (const row of sa.rows) {
    const old = bySid.get(row.sid);
    assert.deepEqual(row, {
      cid: old.cid, snum: old.snum, sid: old.sid, chapter_name: old.cname_sa,
      shloka: old.shloka_sa, word_by_word: '', meaning: old.meaning_sa,
      word_by_word_meaning: old.word_by_word_meaning_sa
    }, `Sanskrit mismatch at ${row.sid}`);
  }
  for (const [language, dataset] of [['en', en], ['kn', kn]]) {
    for (const row of dataset.rows) {
      const old = bySid.get(row.sid);
      assert.deepEqual(row, {
        cid: old.cid, snum: old.snum, sid: old.sid, chapter_name: old[`cname_${language}`],
        transliteration: old[`shloka_transliteration_${language}`], meaning: old[`meaning_${language}`],
        word_by_word_meaning: old[`word_by_word_meaning_${language}`]
      }, `${language} mismatch at ${row.sid}`);
    }
  }
});

async function hash(relative) {
  return createHash('sha256').update(await readFile(path.join(projectRoot, relative))).digest('hex');
}

test('copied audio and icons are byte-identical to legacy assets', async () => {
  const audioComposition = await parseTable('data/collections/experiences/gita-700/audio.csv');
  const audioCatalog = await parseTable('data/collections/audio/chanting-swami-brahmananda/catalog.csv');
  const audioByKey = new Map(audioCatalog.rows.map((row) => [`${row.sid}:${row.order}`, row]));
  const imageComposition = await parseTable('data/collections/experiences/gita-700/images.csv');
  const imageCatalog = await parseTable('data/collections/images/gita-chapter-icons/catalog.csv');
  const imageByKey = new Map(imageCatalog.rows.map((row) => [`${row.sid}:${row.order}`, row]));

  for (const ref of audioComposition.rows) {
    const old = bySid.get(ref.sid);
    if (!old.audio_gita_700) {
      assert.equal(ref.chant_full_sa_order, '');
      continue;
    }
    const asset = audioByKey.get(`${ref.sid}:${ref.chant_full_sa_order}`);
    assert.ok(asset, `missing migrated audio ${ref.sid}`);
    assert.equal(await hash(old.audio_gita_700), await hash(asset.audio_url), `audio bytes differ at ${ref.sid}`);
  }
  for (const ref of imageComposition.rows) {
    const old = bySid.get(ref.sid);
    if (!old.icon_gita_700) {
      assert.equal(ref.chapter_icon_order, '');
      continue;
    }
    const asset = imageByKey.get(`${ref.sid}:${ref.chapter_icon_order}`);
    assert.ok(asset, `missing migrated image ${ref.sid}`);
    assert.equal(await hash(old.icon_gita_700), await hash(asset.image_url), `image bytes differ at ${ref.sid}`);
  }
});
