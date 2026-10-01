import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateVersionHistory } from '../js/version-history.js';

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

async function assertAbsent(target, label) {
  try {
    await stat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(label + ' must not be included in the deployment output.');
}

function isDocumentationAsset(relative) {
  return relative === 'docs.html'
    || relative === 'css/docs.css'
    || relative === 'js/docs.bundle.js'
    || relative.startsWith('docs/')
    || relative.startsWith('js/vendor/');
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
const clarityProjectId = String(process.env.CLARITY_PROJECT_ID || '').trim();
if (clarityProjectId && !/^[a-z0-9]+$/i.test(clarityProjectId)) throw new Error('CLARITY_PROJECT_ID must be alphanumeric.');
const historySource = process.env.VERSION_HISTORY_FILE || path.join(root, 'version-history.json');
let versionHistory = validateVersionHistory(JSON.parse(await readFile(historySource, 'utf8')));
if (versionHistory.some((record) => record.version === version)) throw new Error(`Version history already contains ${version}.`);
const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
const changeMessage = String(process.env.GITAVERSE_CHANGE_MESSAGE || execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' })).trim().split(/\r?\n/)[0];
versionHistory = [...versionHistory, { version, date: `${dateParts.year}-${dateParts.month}-${dateParts.day}`, message: changeMessage || 'Gitaverse update' }];
validateVersionHistory(versionHistory);

run(process.execPath, ['scripts/build-player.mjs']);
run(process.execPath, ['--check', 'js/player.bundle.js']);
run(process.execPath, ['scripts/build-docs.mjs']);
run(process.execPath, ['--check', 'js/docs.bundle.js']);
run(process.execPath, ['--test',
  'tests/unit/i18n.test.mjs',
  'tests/unit/version-history.test.mjs',
  'tests/unit/pwa.test.mjs',
  'tests/unit/event-bus.test.mjs',
  'tests/unit/player-collection-data.test.mjs',
  'tests/unit/player-renderer.test.mjs',
  'tests/contract/collections.test.mjs',
  'tests/contract/docs.test.mjs',
  'tests/contract/player-isolation.test.mjs'
]);

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'js'), { recursive: true });

const sourceHtml = await readFile(path.join(root, 'player.html'), 'utf8');
const deployedHtml = sourceHtml
  .replace('<meta name="app-version" content="dev">', `<meta name="app-version" content="${version}">`)
  .replace('<meta name="clarity-project-id" content="">', `<meta name="clarity-project-id" content="${clarityProjectId}">`)
  .replaceAll('?v=dev', `?v=${encodeURIComponent(version)}`);
if (deployedHtml === sourceHtml || deployedHtml.includes('?v=dev') || deployedHtml.includes('content="dev"')) {
  throw new Error('player.html does not contain the expected development version markers.');
}
if (!deployedHtml.includes(`<meta name="clarity-project-id" content="${clarityProjectId}">`)) {
  throw new Error('player.html does not contain the expected Clarity project marker.');
}

await writeFile(path.join(output, 'player.html'), deployedHtml);
const docsSourceHtml = await readFile(path.join(root, 'docs.html'), 'utf8');
const deployedDocsHtml = docsSourceHtml
  .replace('<meta name="app-version" content="dev">', `<meta name="app-version" content="${version}">`)
  .replace('<meta name="clarity-project-id" content="">', `<meta name="clarity-project-id" content="${clarityProjectId}">`)
  .replaceAll('?v=dev', `?v=${encodeURIComponent(version)}`);
if (deployedDocsHtml === docsSourceHtml || deployedDocsHtml.includes('?v=dev') || deployedDocsHtml.includes('content="dev"')) {
  throw new Error('docs.html does not contain the expected development version markers.');
}
if (!deployedDocsHtml.includes(`<meta name="clarity-project-id" content="${clarityProjectId}">`)) throw new Error('docs.html does not contain the expected Clarity project marker.');
await writeFile(path.join(output, 'docs.html'), deployedDocsHtml);
await cp(path.join(root, 'index.html'), path.join(output, 'index.html'));
await cp(path.join(root, 'CNAME'), path.join(output, 'CNAME'));
await cp(path.join(root, 'manifest.webmanifest'), path.join(output, 'manifest.webmanifest'));
await cp(path.join(root, 'offline.html'), path.join(output, 'offline.html'));
const serviceWorkerSource = await readFile(path.join(root, 'service-worker.js'), 'utf8');
if (!serviceWorkerSource.includes('__GITAVERSE_VERSION__')) throw new Error('service-worker.js is missing its build version marker.');
await writeFile(path.join(output, 'service-worker.js'), serviceWorkerSource.replaceAll('__GITAVERSE_VERSION__', version));
await copyDirectory(path.join(root, 'css'), path.join(output, 'css'), (relative) => !relative.endsWith('.DS_Store'));
await copyDirectory(path.join(root, 'assets'), path.join(output, 'assets'), (relative) => !relative.endsWith('.DS_Store'));
await cp(path.join(root, 'js/player.bundle.js'), path.join(output, 'js/player.bundle.js'));
await cp(path.join(root, 'js/docs.bundle.js'), path.join(output, 'js/docs.bundle.js'));
await mkdir(path.join(output, 'js/vendor'), { recursive: true });
await cp(path.join(root, 'js/vendor/MARKED-LICENSE.md'), path.join(output, 'js/vendor/MARKED-LICENSE.md'));
await copyDirectory(path.join(root, 'docs'), path.join(output, 'docs'), (relative) => !relative.endsWith('.DS_Store'));
await copyDirectory(path.join(root, 'data'), path.join(output, 'data'), (relative) => {
  return !relative.endsWith('.DS_Store') && relative !== 'app-version.json';
});

const versionMetadata = { version, major, build, commit, runId, builtAt, timeZone };
await writeFile(path.join(output, 'data/app-version.json'), JSON.stringify(versionMetadata, null, 2) + '\n');
await writeFile(path.join(output, 'data/version-history.json'), JSON.stringify(versionHistory, null, 2) + '\n');

await assertAbsent(path.join(output, 'x'), 'The archived x/ prototypes');

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

const precache = Object.keys(assets).filter((relative) => {
  if (isDocumentationAsset(relative)) return false;
  return relative === 'player.html'
    || relative === 'index.html'
    || relative === 'offline.html'
    || relative === 'manifest.webmanifest'
    || relative === 'data/app-version.json'
    || relative === 'data/version-history.json'
    || relative === 'js/player.bundle.js'
    || (relative.startsWith('css/') && relative !== 'css/docs.css')
    || relative.startsWith('assets/icons/')
    || relative.startsWith('data/collections/');
});
const assetManifest = { version, generatedAt: builtAt, assets, precache };
await writeFile(path.join(output, 'asset-manifest.json'), JSON.stringify(assetManifest, null, 2) + '\n');

if (Object.keys(assets).some((relative) => relative === 'x' || relative.startsWith('x/'))) {
  throw new Error('The archived x/ prototypes must not appear in the deployment asset manifest.');
}
if (precache.some(isDocumentationAsset)) {
  throw new Error('Rachana documentation must not increase the PWA precache.');
}

for (const required of ['docs.html', 'css/docs.css', 'js/docs.bundle.js', 'js/vendor/MARKED-LICENSE.md', 'docs/navigation.json', 'docs/welcome.md']) {
  if (!assets[required]) throw new Error('Rachana deployment is missing ' + required + '.');
  if (precache.includes(required)) throw new Error('Rachana documentation must not be part of the initial PWA precache: ' + required + '.');
}

console.log(`Built Gitaverse ${version} in dist/ (${Object.keys(assets).length} managed assets; ${precache.length} precached; audio cached on demand).`);
