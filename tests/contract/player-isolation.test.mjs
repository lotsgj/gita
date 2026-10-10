import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const player = await readFile(new URL('../../player.html', import.meta.url), 'utf8');
const core = await readFile(new URL('../../js/player/player-core.js', import.meta.url), 'utf8');
const data = await readFile(new URL('../../js/player/collection-data.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const deployment = await readFile(new URL('../../scripts/build-deployment.mjs', import.meta.url), 'utf8');
const fonts = await readFile(new URL('../../css/fonts.css', import.meta.url), 'utf8');
const playerStyles = await readFile(new URL('../../css/player.css', import.meta.url), 'utf8');
const editorStyles = await readFile(new URL('../../css/editor.css', import.meta.url), 'utf8');
const rendererStyles = await readFile(new URL('../../css/renderers/gita-700.css', import.meta.url), 'utf8');
const yogaRendererStyles = await readFile(new URL('../../css/renderers/gita-yoga.css', import.meta.url), 'utf8');
const saraRendererStyles = await readFile(new URL('../../css/renderers/gita-sara.css', import.meta.url), 'utf8');
const fontBuilder = await readFile(new URL('../../scripts/build-font-css.mjs', import.meta.url), 'utf8');

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

test('the player uses the bundled Noto Sans family for every supported script', async () => {
  assert.match(player, /css\/fonts\.css\?v=dev/);
  for (const file of ['NotoSans.ttf', 'NotoSansDevanagari.ttf', 'NotoSansKannada.ttf']) {
    assert.match(fontBuilder, new RegExp(file.replace('.', '\\.')));
    await access(new URL(`../../assets/fonts/${file}`, import.meta.url));
  }
  for (const license of ['OFL-NotoSans.txt', 'OFL-NotoSansDevanagari.txt', 'OFL-NotoSansKannada.txt']) {
    await access(new URL(`../../assets/fonts/${license}`, import.meta.url));
  }
  const namedLegacyFonts = /Inter|Georgia|Times New Roman|Avenir Next|Segoe UI|Kohinoor|Noto Serif|SFMono|Menlo/;
  assert.doesNotMatch(playerStyles + editorStyles + rendererStyles + yogaRendererStyles + saraRendererStyles, namedLegacyFonts);
  assert.equal((fonts.match(/data:font\/ttf;base64,/g) || []).length, 3);
  assert.match(playerStyles, /var\(--font-sans, sans-serif\)/);
  assert.match(rendererStyles, /var\(--font-sans, sans-serif\)/);
  assert.match(yogaRendererStyles, /gita-yoga/);
  assert.match(saraRendererStyles, /gita-sara/);
  assert.match(deployment, /scripts\/build-font-css\.mjs/);
});
