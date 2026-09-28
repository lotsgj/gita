import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const projectRoot = path.resolve(import.meta.dirname, '../..');

export async function parseTable(relativePath) {
  const text = (await readFile(path.join(projectRoot, relativePath), 'utf8'))
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
  const lines = text.split('\n').filter((line) => line.length);
  if (!lines.length) throw new Error(`${relativePath} is empty`);
  const headers = lines.shift().split('#');
  const rows = lines.map((line, index) => {
    const fields = line.split('#');
    if (fields.length !== headers.length) {
      throw new Error(`${relativePath}:${index + 2} has ${fields.length} fields; expected ${headers.length}`);
    }
    return Object.fromEntries(headers.map((header, fieldIndex) => [header, fields[fieldIndex].replace(/\\n/g, '\n')]));
  });
  return { headers, rows };
}

export function assertIdentitySequence(assert, expected, actual, label) {
  assert.deepEqual(
    actual.map(({ cid, snum, sid }) => [cid, snum, sid]),
    expected.map(({ cid, snum, sid }) => [cid, snum, sid]),
    `${label} must contain every SID in canonical order`
  );
}
