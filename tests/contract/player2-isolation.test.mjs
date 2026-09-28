import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const player = await readFile(new URL('../../player.html', import.meta.url), 'utf8');
const player2Redirect = await readFile(new URL('../../player2.html', import.meta.url), 'utf8');
const core = await readFile(new URL('../../js/player2/player-core.js', import.meta.url), 'utf8');
const data = await readFile(new URL('../../js/player2/collection-data.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('the collection player is isolated from the legacy master and legacy media paths', () => {
  const combined = player + '\n' + core;
  assert.equal(combined.includes('data/master.csv'), false);
  assert.equal(combined.includes('data/gita-700'), false);
  assert.equal(combined.includes('/audio/sn/'), false);
  assert.match(player, /js\/player\.bundle\.js\?v=dev/);
  assert.match(data, /data\/collections/);
});

test('public and compatibility entry points resolve to the collection player', () => {
  assert.match(index, /player\.html/);
  assert.equal(index.includes('player2.html'), false);
  assert.match(player2Redirect, /location\.replace\('player\.html'/);
});
