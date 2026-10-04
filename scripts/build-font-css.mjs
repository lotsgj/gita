import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const faces = [
  { file: 'NotoSans.ttf', range: 'U+0000-024F, U+1E00-1EFF, U+2000-206F, U+20A0-20CF' },
  { file: 'NotoSansDevanagari.ttf', range: 'U+0900-097F, U+1CD0-1CFF, U+A8E0-A8FF, U+11B00-11B5F' },
  { file: 'NotoSansKannada.ttf', range: 'U+0C80-0CFF' }
];

const blocks = [];
for (const face of faces) {
  const bytes = await readFile(path.join(root, 'assets/fonts', face.file));
  blocks.push(`@font-face {
  font-family: "Gitaverse Noto Sans";
  src: url("data:font/ttf;base64,${bytes.toString('base64')}") format("truetype");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  unicode-range: ${face.range};
}`);
}

const css = `${blocks.join('\n\n')}

:root {
  --font-sans: "Gitaverse Noto Sans";
}
`;

await writeFile(path.join(root, 'css/fonts.css'), css);
