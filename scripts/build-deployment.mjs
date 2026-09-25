import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const output = path.join(root, 'dist');
const timeZone = 'Asia/Kolkata';

function indiaTimestamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.day}${parts.month.slice(0, 3)}${parts.year}-${parts.hour}${parts.minute}${parts.second}`;
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

async function copyDirectory(source, destination, filter = () => true) {
  await cp(source, destination, {
    recursive: true,
    filter: (entry) => filter(path.relative(source, entry).split(path.sep).join('/'))
  });
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const major = (await readFile(path.join(root, 'APP_MAJOR_VERSION'), 'utf8')).trim();
if (!/^[1-9]\d*$/.test(major)) throw new Error('APP_MAJOR_VERSION must contain one positive whole number.');

const build = process.env.GITAVERSE_BUILD_ID || indiaTimestamp();
if (!/^\d{2}[A-Z][a-z]{2}\d{4}-\d{6}$/.test(build)) {
  throw new Error('GITAVERSE_BUILD_ID must use ddMMMccyy-HHmmss, for example 25Sep2026-143042.');
}

const version = `${major}.${build}`;
const commit = process.env.GITHUB_SHA || 'local';
const runId = process.env.GITHUB_RUN_ID || 'local';
const builtAt = new Date().toISOString();

run(process.execPath, ['scripts/build-verse-player.mjs']);
run(process.execPath, ['--check', 'js/player.bundle.js']);
run('python3', ['scripts/validate_master.py', 'data/master.csv']);

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'js'), { recursive: true });

const sourceHtml = await readFile(path.join(root, 'player.html'), 'utf8');
const deployedHtml = sourceHtml
  .replace('<meta name="app-version" content="dev">', `<meta name="app-version" content="${version}">`)
  .replaceAll('?v=dev', `?v=${encodeURIComponent(version)}`);
if (deployedHtml === sourceHtml || deployedHtml.includes('?v=dev') || deployedHtml.includes('content="dev"')) {
  throw new Error('player.html does not contain the expected development version markers.');
}

await writeFile(path.join(output, 'player.html'), deployedHtml);
await cp(path.join(root, 'CNAME'), path.join(output, 'CNAME'));
await copyDirectory(path.join(root, 'css'), path.join(output, 'css'), (relative) => !relative.endsWith('.DS_Store'));
await cp(path.join(root, 'js/player.bundle.js'), path.join(output, 'js/player.bundle.js'));
await copyDirectory(path.join(root, 'data'), path.join(output, 'data'), (relative) => {
  return !relative.endsWith('.DS_Store') && relative !== 'app-version.json';
});

const versionMetadata = { version, major, build, commit, runId, builtAt, timeZone };
await writeFile(path.join(output, 'data/app-version.json'), JSON.stringify(versionMetadata, null, 2) + '\n');

const assets = {};
for (const absolute of await walk(output)) {
  const relative = path.relative(output, absolute).split(path.sep).join('/');
  if (relative === 'asset-manifest.json' || relative === 'CNAME' || /\.(mp3|m4a|ogg|wav)$/i.test(relative)) continue;
  const contents = await readFile(absolute);
  assets[relative] = {
    sha256: createHash('sha256').update(contents).digest('hex'),
    bytes: (await stat(absolute)).size
  };
}

const assetManifest = { version, generatedAt: builtAt, assets };
await writeFile(path.join(output, 'asset-manifest.json'), JSON.stringify(assetManifest, null, 2) + '\n');

console.log(`Built Gitaverse ${version} in dist/ (${Object.keys(assets).length} managed assets; audio excluded from the cache manifest).`);
