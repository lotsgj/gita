const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const dist = path.join(root, 'dist');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mime = {
  '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function staticServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(dist, relative);
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = fs.readFileSync(file);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store'
    });
    response.end(body);
  });
}

async function run() {
  const server = staticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const launchOptions = { headless: true };
  if (fs.existsSync(chromePath)) launchOptions.executablePath = chromePath;
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  try {
    await page.goto(`${base}/docs.html`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Welcome to Rachana', level: 1 }).waitFor();
    assert.match(await page.locator('#docs-article').innerText(), /Status:\s*Current/);
    assert.match(await page.title(), /^Welcome to Rachana — Rachana$/);
    assert.equal(await page.locator('.docs-nav-link.active').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('#docs-article script').count(), 0);

    await page.getByRole('button', { name: 'Create a Gitaverse profile' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Rachana Regression');
    await page.getByLabel('Date of birth', { exact: true }).fill('1990-01-01');
    await page.getByLabel('App language', { exact: true }).selectOption('en');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.waitForFunction(() => document.getElementById('docs-profile-pill').getAttribute('aria-label')?.includes('Rachana Regression'));
    assert.match(await page.locator('#docs-profile-pill').getAttribute('aria-label'), /Rachana Regression/);
    assert.match(await page.locator('#docs-gitaverse-link').getAttribute('href'), /[?&]pid=1(?:&|$)/);

    await page.getByRole('button', { name: 'About Gitaverse' }).click();
    await page.getByRole('heading', { name: 'About Gitaverse' }).waitFor();
    assert.equal(await page.locator('#about-overlay').isVisible(), true);
    await page.getByRole('button', { name: 'Version history' }).click();
    await page.locator('.about-history-item').first().waitFor();
    await page.getByRole('button', { name: '← Back to About' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('link', { name: 'Rachana documentation design' }).click();
    await page.getByRole('heading', { name: 'Rachana — Gitaverse design details', level: 1 }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('page'), 'rachana-design');

    await page.getByLabel('Rachana navigation').getByRole('link', { name: 'Sampada' }).click();
    await page.getByRole('heading', { name: 'Sampada — Treasure trove of Gitaverse enhancements', level: 1 }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('page'), 'sampada');
    await page.goBack();
    await page.getByRole('heading', { name: 'Rachana — Gitaverse design details', level: 1 }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: 'Welcome to Rachana', level: 1 }).waitFor();

    await page.goto(`${base}/docs.html?page=not-a-document`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Document not found', level: 1 }).waitFor();
    await page.goBack({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Welcome to Rachana', level: 1 }).waitFor();

    await page.evaluate(async () => {
      await navigator.serviceWorker.register('service-worker.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Welcome to Rachana', level: 1 }).waitFor();
    const cachedDocumentation = await page.evaluate(async () => {
      const matches = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          const path = new URL(request.url).pathname.replace(/^\/+/, '');
          if (path === 'docs.html' || path === 'css/docs.css' || path === 'js/docs.bundle.js' || path.startsWith('docs/') || path.startsWith('js/vendor/')) {
            matches.push({ name, path });
          }
        }
      }
      return matches;
    });
    assert.deepEqual(cachedDocumentation, []);

    const safePage = await context.newPage();
    await safePage.route('**/docs/welcome.md', (route) => route.fulfill({
      contentType: 'text/markdown; charset=utf-8',
      body: '# Safe document\n\n**Status:** Current  \n**Last updated:** 29 September 2026\n\n<script>window.__rachanaXss = true</script>\n\n[unsafe](javascript:alert(1))'
    }));
    await safePage.goto(`${base}/docs.html?page=welcome`, { waitUntil: 'networkidle' });
    await safePage.getByRole('heading', { name: 'Safe document', level: 1 }).waitFor();
    assert.equal(await safePage.evaluate(() => window.__rachanaXss), undefined);
    assert.equal(await safePage.locator('#docs-article script').count(), 0);
    assert.equal(await safePage.locator('#docs-article a').filter({ hasText: 'unsafe' }).getAttribute('href'), null);
    await safePage.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}/docs.html`, { waitUntil: 'networkidle' });
    const menu = mobilePage.locator('#docs-menu-button');
    assert.equal(await menu.isVisible(), true);
    assert.equal(await menu.getAttribute('aria-label'), 'Open documentation navigation');
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    assert.equal(await mobilePage.locator('body').getAttribute('class'), 'docs-nav-open');
    await mobilePage.locator('.docs-nav-link').first().click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    await mobile.close();

    const fileContext = await browser.newContext();
    const filePage = await fileContext.newPage();
    const fileErrors = [];
    filePage.on('pageerror', (error) => fileErrors.push(error.message));
    filePage.on('console', (message) => { if (message.type() === 'error') fileErrors.push(message.text()); });
    const fileUrl = pathToFileURL(path.join(root, 'docs.html')).href;
    await filePage.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await filePage.getByRole('heading', { name: 'Open local Rachana', level: 1 }).waitFor();
    await filePage.locator('#docs-folder-input').setInputFiles(path.join(root, 'docs'));
    await filePage.getByRole('heading', { name: 'Welcome to Rachana', level: 1 }).waitFor();
    assert.match(await filePage.locator('#docs-article').innerText(), /Status:\s*Current/);
    assert.deepEqual(fileErrors, [], 'Rachana file mode console/page errors');
    await fileContext.close();

    assert.deepEqual(errors, [], 'Rachana browser console/page errors');
    console.log('PASS: Rachana Markdown rendering, shared profile and About, HTTP and file modes, direct routing, safe content, error state, history, and mobile navigation');
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
