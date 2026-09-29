import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EN_MESSAGES } from '../../js/i18n/en.js';
import { KN_MESSAGES } from '../../js/i18n/kn.js';

test('English and Kannada interface dictionaries have identical keys', () => {
  assert.deepEqual(Object.keys(KN_MESSAGES).sort(), Object.keys(EN_MESSAGES).sort());
  for (const [key, value] of Object.entries(EN_MESSAGES)) assert.ok(value.trim(), `English translation ${key}`);
  for (const [key, value] of Object.entries(KN_MESSAGES)) assert.ok(value.trim(), `Kannada translation ${key}`);
});

test('every declarative player translation key exists and Rachana stays outside interface translation', async () => {
  const [player, docs, core] = await Promise.all([
    readFile(new URL('../../player.html', import.meta.url), 'utf8'),
    readFile(new URL('../../docs.html', import.meta.url), 'utf8'),
    readFile(new URL('../../js/player/player-core.js', import.meta.url), 'utf8')
  ]);
  const keys = [...player.matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g)].map((match) => match[1]);
  keys.forEach((key) => assert.ok(Object.hasOwn(EN_MESSAGES, key), `missing interface translation ${key}`));
  assert.match(core, /profile\.contentLanguage/);
  assert.match(core, /new I18n\('en'\)/);
  assert.doesNotMatch(docs, /js\/i18n|data-i18n=/);
});
