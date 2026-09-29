import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const player = await readFile(new URL('../../player.html', import.meta.url), 'utf8');
const core = await readFile(new URL('../../js/player/player-core.js', import.meta.url), 'utf8');
const data = await readFile(new URL('../../js/player/collection-data.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const deployment = await readFile(new URL('../../scripts/build-deployment.mjs', import.meta.url), 'utf8');

test('the collection player is isolated from the legacy master and legacy media paths', () => {
  const combined = player + '\n' + core;
  assert.equal(combined.includes('data/master.csv'), false);
  assert.equal(combined.includes('data/gita-700'), false);
  assert.equal(combined.includes('/audio/sn/'), false);
  assert.match(player, /js\/player\.bundle\.js\?v=dev/);
  assert.match(data, /data\/collections/);
});

test('chapter labels are rendered from collection data without Dhyana exceptions', () => {
  assert.doesNotMatch(core, /chapter\.cid === 'D'/);
  assert.doesNotMatch(core, /row\.cid === 'D'/);
  assert.doesNotMatch(core, /D — Dhyana/);
  assert.doesNotMatch(core, /'ॐ'\s*:\s*chapter\.cid/);
});

test('the public entry point resolves to the collection player', () => {
  assert.match(index, /player\.html/);
});

test('archived prototypes are guarded from deployment output and its asset manifest', () => {
  assert.match(deployment, /assertAbsent\(path\.join\(output, 'x'\)/);
  assert.match(deployment, /relative\.startsWith\('x\/'\)/);
});
