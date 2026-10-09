import { readFile, writeFile } from 'node:fs/promises';

function rows(text) {
  const lines = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').filter(Boolean);
  const headers = lines.shift().split('#');
  return lines.map((line) => {
    const fields = line.split('#');
    return Object.fromEntries(headers.map((header, index) => [header, fields[index]]));
  });
}

const master = rows(await readFile('data/collections/verses/bhagavad-gita/master_sa.csv', 'utf8'));
const catalog = rows(await readFile('data/collections/audio/chanting-aj-padma-aj-vijay-learn-mode/catalog.csv', 'utf8'));
const assets = new Map(catalog.map((row) => [`${row.sid}:${row.order}`, row]));
const output = ['cid#snum#sid#audio_collection#audio_order'];
let references = 0;

for (const verse of master) {
  const asset = assets.get(`${verse.sid}:1`);
  if (asset) {
    output.push(`${verse.cid}#${verse.snum}#${verse.sid}#chanting-aj-padma-aj-vijay-learn-mode#1`);
    references += 1;
  } else {
    output.push(`${verse.cid}#${verse.snum}#${verse.sid}##`);
  }
}

if (references !== catalog.length) {
  throw new Error(`Expected every learning-mode catalog asset to resolve once; resolved ${references} of ${catalog.length}.`);
}

await writeFile('data/collections/experiences/gita-yoga/audio.csv', output.join('\n') + '\n');
console.log(`Generated Gita-Yoga audio composition with ${master.length} SIDs and ${references} audio references.`);
