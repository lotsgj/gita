import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseMaster, serializeMaster } from '../../js/master-data.js';

const source = await readFile(new URL('../../data/master.csv', import.meta.url), 'utf8');
const dataset = parseMaster(source);

test('current master is a stable 746-record characterization baseline', () => {
  assert.equal(dataset.rows.length, 746);
  assert.equal(dataset.rows[0].sid, 'D.1');
  assert.equal(dataset.rows.at(-1).sid, '18.E');
  assert.equal(new Set(dataset.rows.map((row) => row.sid)).size, 746);
});

test('current master round-trips without changing decoded content', () => {
  assert.deepEqual(parseMaster(serializeMaster(dataset)), dataset);
});

test('current Gita-700 coverage is characterized', () => {
  assert.equal(dataset.rows.filter((row) => row.audio_gita_700).length, 700);
  assert.equal(dataset.rows.filter((row) => row.audio_gita_yoga).length, 0);
  assert.equal(dataset.rows.filter((row) => row.icon_gita_700).length, 19);
});

test('representative beginning, verse, and ending rows remain available', () => {
  const bySid = new Map(dataset.rows.map((row) => [row.sid, row]));
  assert.ok(bySid.get('6.B').shloka_sa.includes('षष्ठो'));
  assert.ok(bySid.get('6.7').shloka_transliteration_en);
  assert.ok(bySid.get('18.E').meaning_en);
});
