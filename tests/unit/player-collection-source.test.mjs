import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { CollectionSource } from '../../js/player/collection-source.js';
import { projectRoot } from '../helpers/collection-data.mjs';

async function localCollectionsHandle() {
  const root = path.join(projectRoot, 'data/collections');
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = new Map();
  for (const entry of entries.filter((candidate) => candidate.isFile())) {
    const absolute = path.join(entry.parentPath, entry.name);
    files.set(path.relative(root, absolute).split(path.sep).join('/'), await readFile(absolute));
  }
  function directory(prefix = '') {
    return {
      kind: 'directory', name: prefix.split('/').filter(Boolean).at(-1) || 'collections',
      async getDirectoryHandle(name) { return directory(prefix + name + '/'); },
      async getFileHandle(name) {
        const relative = prefix + name;
        if (!files.has(relative)) throw new Error('Not found: ' + relative);
        return {
          kind: 'file', name,
          async getFile() {
            const content = files.get(relative);
            return { testRelativePath: relative, size: content.length, async text() { return content.toString('utf8'); } };
          }
        };
      }
    };
  }
  return directory();
}

test('file mode reuses its Home directory handle as the editing workspace', async () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  URL.createObjectURL = (file) => 'blob:collection-source/' + file.testRelativePath;
  const source = new CollectionSource({ protocol: 'file:' });
  try {
    source.selectDirectory(await localCollectionsHandle());
    const dataset = await source.loadExperience('gita-700');
    assert.equal(source.requiresSelection, false);
    assert.equal(dataset.rows.length, 746);
    assert.ok(source.workspaceFor('gita-700'), 'the loaded experience must retain its writable workspace');
    assert.equal(await source.loadExperience('gita-700'), dataset, 'the same dataset and workspace are reused');
  } finally {
    source.clear();
    URL.createObjectURL = originalCreateObjectUrl;
  }
});
