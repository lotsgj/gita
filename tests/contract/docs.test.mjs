import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../helpers/collection-data.mjs';

const manifestPath = path.join(projectRoot, 'docs/navigation.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const pages = manifest.sections.flatMap((section) => section.pages);

function readUpdatedDate(markdown, documentPath) {
  const match = markdown.match(/^\*\*Last updated:\*\* (\d{1,2}) ([A-Z][a-z]+) (\d{4})\s*$/m);
  assert.ok(match, documentPath + ' has an invalid or missing Last updated date');
  const timestamp = Date.parse(`${match[2]} ${match[1]}, ${match[3]} UTC`);
  assert.equal(Number.isNaN(timestamp), false, documentPath + ' has an invalid date');
  return timestamp;
}

test('Rachana navigation is safe, unique, and resolves to Markdown documents', async () => {
  assert.equal(manifest.title, 'Rachana');
  assert.ok(pages.length > 0);
  assert.ok(pages.some((page) => page.route === manifest.defaultPage));
  assert.equal(new Set(pages.map((page) => page.route)).size, pages.length, 'duplicate documentation route');
  assert.equal(new Set(pages.map((page) => page.path)).size, pages.length, 'duplicate documentation path');
  for (const page of pages) {
    assert.match(page.route, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(page.path, /^(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9_/-]+\.md$/i);
    await access(path.join(projectRoot, 'docs', page.path));
  }
});

test('every listed Rachana document has current metadata and one title', async () => {
  for (const page of pages) {
    const markdown = await readFile(path.join(projectRoot, 'docs', page.path), 'utf8');
    assert.equal(markdown.match(/^# /gm)?.length, 1, page.path + ' must have one top-level title');
    const status = markdown.match(/^\*\*Status:\*\* (Current|Partial|Superseded)\s*$/m);
    assert.ok(status, page.path + ' has an invalid or missing Status');
    readUpdatedDate(markdown, page.path);
  }
});

test('the Rachana welcome date matches the newest documentation update', async () => {
  const datedPages = await Promise.all(pages.map(async (page) => {
    const markdown = await readFile(path.join(projectRoot, 'docs', page.path), 'utf8');
    return { page, timestamp: readUpdatedDate(markdown, page.path) };
  }));
  const welcome = datedPages.find(({ page }) => page.route === manifest.defaultPage);
  assert.ok(welcome, 'default Rachana page is missing');
  const newest = Math.max(...datedPages.map(({ timestamp }) => timestamp));
  assert.equal(welcome.timestamp, newest, 'docs/welcome.md Last updated must match the newest Rachana page');
});

test('every internal Markdown link resolves to a navigable Rachana document', async () => {
  const navigablePaths = new Set(pages.map((page) => path.posix.normalize(page.path)));
  for (const page of pages) {
    const markdown = await readFile(path.join(projectRoot, 'docs', page.path), 'utf8');
    const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
    for (const link of links) {
      if (/^(?:[a-z]+:|#)/i.test(link)) continue;
      const target = decodeURIComponent(link.split('#')[0].split('?')[0]);
      if (!target.toLowerCase().endsWith('.md')) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(page.path), target));
      assert.ok(navigablePaths.has(resolved), `${page.path} links to unlisted or missing document ${resolved}`);
    }
  }
});

test('the handbook exposes the approved product, experience, system, and future structure', () => {
  const expected = {
    Product: ['purpose-and-principles', 'experience-model', 'terminology'],
    Experiences: ['profiles-and-first-use', 'home-and-experience-selection', 'shared-player', 'gita-yoga', 'gita-700', 'gita-sara', 'local-content-editing', 'install-offline-and-updates'],
    System: ['architecture-overview', 'collections-and-media', 'profiles-and-local-storage', 'events-analytics-and-resume', 'pwa-cache-and-updates', 'build-test-and-deployment'],
    'Future possibilities': ['sampada']
  };
  for (const [title, routes] of Object.entries(expected)) {
    const section = manifest.sections.find((candidate) => candidate.title === title);
    assert.ok(section, `missing ${title} section`);
    assert.deepEqual(section.pages.map((page) => page.route), routes);
  }
});

test('Sampada preserves both future possibilities and completed enhancements with status and tags', async () => {
  const future = manifest.sections.find((section) => section.title === 'Future possibilities');
  const sampada = future?.pages.find((page) => page.route === 'sampada');
  assert.deepEqual(sampada, {
    title: 'Sampada',
    route: 'sampada',
    path: 'design/sampada.md'
  });
  const markdown = await readFile(path.join(projectRoot, 'docs', sampada.path), 'utf8');
  assert.match(markdown, /^## To unfold$/m);
  assert.match(markdown, /^## Done$/m);
  const items = markdown.split(/^### \d+\. /m).slice(1);
  assert.ok(items.length > 0);
  items.forEach((item, index) => {
    assert.match(item, /^.+\n\n\*\*Status:\*\* (To unfold|Done)\s*$/m, `Sampada item ${index + 1} is missing its status`);
    assert.match(item, /^\*\*Tag:\*\* (Major|Minor)\s*$/m, `Sampada item ${index + 1} is missing its tag`);
  });
  assert.match(markdown, /^### 3\. Consistent chapter names\n\n\*\*Status:\*\* Done/m);
  assert.match(markdown, /^### 9\. Global app-language preference\n\n\*\*Status:\*\* Done/m);
  assert.match(markdown, /^### 12\. Gita Yoga foundation\n\n\*\*Status:\*\* Done/m);
  assert.match(markdown, /^### 13\. Gita Yoga cue-region playback\n\n\*\*Status:\*\* To unfold/m);
  assert.match(markdown, /^### 14\. Gita Sara expanded media\n\n\*\*Status:\*\* To unfold/m);
  assert.equal(markdown.includes('Treasure Trove'), false);
});

test('the Rachana documentation design is itself documented and navigable', async () => {
  const page = pages.find((candidate) => candidate.route === 'rachana-design');
  assert.deepEqual(page, {
    title: 'Rachana documentation design',
    route: 'rachana-design',
    path: 'design/rachana.md'
  });
  const markdown = await readFile(path.join(projectRoot, 'docs', page.path), 'utf8');
  for (const section of ['Purpose', 'Documentation experience', 'HTTP and local-file behaviour', 'Markdown rendering and safety', 'Build and deployment', 'Maintenance rules', 'Automated verification']) {
    assert.match(markdown, new RegExp('^## ' + section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'm'));
  }
});

test('the Rachana viewer uses a manifest allowlist, local Markdown parser, and file fallback', async () => {
  const [html, source, builder] = await Promise.all([
    readFile(path.join(projectRoot, 'docs.html'), 'utf8'),
    readFile(path.join(projectRoot, 'js/docs/viewer.js'), 'utf8'),
    readFile(path.join(projectRoot, 'scripts/build-docs.mjs'), 'utf8')
  ]);
  assert.match(html, /Rachana/);
  assert.match(html, /js\/docs\.bundle\.js\?v=dev/);
  assert.doesNotMatch(html, /type="module"/);
  assert.match(source, /readDocumentationFile\('navigation\.json'\)/);
  assert.match(source, /entries\.find\(\(candidate\) => candidate\.route === route\)/);
  assert.match(source, /vendor\/marked\.esm\.js/);
  assert.match(source, /location\.protocol === 'file:'/);
  assert.match(source, /docs-folder-input/);
  assert.match(source, /new ProfileStore\(\)/);
  assert.match(source, /new ProfileUI\(/);
  assert.match(source, /new AboutDialog\(/);
  assert.match(source, /rachana_page_viewed/);
  assert.match(builder, /js\/docs\.bundle\.js/);
  assert.equal(source.includes('https://cdn.'), false);
});

test('Rachana is browser-loaded and excluded from the PWA cache boundary', async () => {
  const [deployment, serviceWorker] = await Promise.all([
    readFile(path.join(projectRoot, 'scripts/build-deployment.mjs'), 'utf8'),
    readFile(path.join(projectRoot, 'service-worker.js'), 'utf8')
  ]);
  assert.match(deployment, /function isDocumentationAsset\(relative\)/);
  assert.match(deployment, /if \(isDocumentationAsset\(relative\)\) return false/);
  assert.match(deployment, /precache\.some\(isDocumentationAsset\)/);
  assert.match(serviceWorker, /function isDocumentationRequest\(url\)/);
  assert.match(serviceWorker, /if \(isDocumentationRequest\(url\)\) return/);
});
