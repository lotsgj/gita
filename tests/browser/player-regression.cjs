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
  '.css': 'text/css', '.csv': 'text/csv; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.mp3': 'audio/mpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'
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

async function createProfile(page, name = 'Regression Profile') {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Date of birth', { exact: true }).fill('1990-01-01');
  await page.getByLabel('App language', { exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByRole('heading', { name: 'Choose an experience' }).waitFor();
}

async function run() {
  const server = staticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const launchOptions = { headless: true };
  if (fs.existsSync(chromePath)) launchOptions.executablePath = chromePath;
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.addInitScript(({ baseUrl }) => {
    const writes = {};
    window.__workspaceWrites = writes;
    const directory = (prefix = '') => ({
      kind: 'directory',
      name: prefix.split('/').filter(Boolean).at(-1) || 'collections',
      async getDirectoryHandle(name) { return directory(prefix + name + '/'); },
      async getFileHandle(name) {
        const relative = prefix + name;
        return {
          kind: 'file',
          name,
          async getFile() {
            if (Object.hasOwn(writes, relative)) return new File([writes[relative]], name);
            const response = await fetch(baseUrl + '/data/collections/' + relative);
            if (!response.ok) throw new Error('Missing workspace file: ' + relative);
            return new File([await response.blob()], name);
          },
          async createWritable() {
            let value = '';
            return {
              async write(next) { value = String(next); },
              async close() { writes[relative] = value; }
            };
          }
        };
      },
      async queryPermission() { return 'granted'; },
      async requestPermission() { return 'granted'; }
    });
    window.showDirectoryPicker = async () => directory();
  }, { baseUrl: base });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  try {
    await page.goto(`${base}/player.html?play=gita-700&sid=6.7&lang=kn`, { waitUntil: 'networkidle' });
    assert.equal(await page.getByLabel('App language', { exact: true }).inputValue(), '', 'first profile must require an explicit app language');
    await createProfile(page);
    await page.getByRole('link', { name: /Gita 700/ }).click();
    await assert.doesNotReject(() => page.locator('#sid-label').waitFor());
    assert.equal(await page.locator('#sid-label').innerText(), '1.B');

    await page.goto(`${base}/player.html?play=gita-700&sid=6.7&lang=kn&pid=1`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#sid-label').innerText(), '6.7');
    assert.equal(await page.locator('#language-button .top-menu-label').innerText(), 'Content language (ಕನ್ನಡ)');
    assert.equal(await page.locator('#help-button .top-menu-label').innerText(), 'Help');
    assert.match(await page.locator('#chapter-title').innerText(), /^6 — /);
    assert.equal(await page.locator('.gita-700-panel').count(), 4);
    assert.equal(await page.locator('#play-button').isEnabled(), true);
    assert.match(await page.locator('#audio').getAttribute('src'), /data\/collections\/audio\/chanting-swami-brahmananda\/sa\/chapter-06\/06-007\.mp3/);
    await page.locator('#play-button').click();
    await page.locator('#play-button[aria-label="Pause audio"]').waitFor();
    await page.locator('#play-button').click();
    await page.locator('#play-button[aria-label="Play audio"]').waitFor();

    await page.keyboard.press('m');
    assert.equal(await page.locator('#top-menu').isVisible(), true);
    await page.waitForFunction(() => document.activeElement?.id === 'chapters-button');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'chapters-button');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'goto-button');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#top-menu').isVisible(), false);

    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#sid-label').innerText(), '6.8');
    await page.keyboard.press('l');
    await page.getByRole('button', { name: 'English' }).click();
    assert.equal(new URL(page.url()).searchParams.has('lang'), false);
    assert.notEqual(await page.locator('[data-role="meaning"]').innerText(), '—');

    await page.keyboard.press('g');
    await page.locator('#goto-input').fill('99.99');
    await page.locator('#goto-form').press('Enter');
    assert.match(await page.locator('#goto-error').innerText(), /not found/i);
    await page.locator('#goto-input').fill('18.E');
    await page.locator('#goto-form').press('Enter');
    assert.equal(await page.locator('#sid-label').innerText(), '18.E');

    await page.keyboard.press('c');
    assert.equal(await page.locator('.chapter-button').count(), 19);
    await page.locator('#chapters-overlay').waitFor({ state: 'visible' });
    assert.match(await page.locator('.chapter-button[data-cid="D"]').innerText(), /^D\s+Dhyana$/);
    assert.match(await page.locator('.chapter-button[data-cid="18"]').innerText(), /^18\s+Moksha Sannyasa Yoga$/);
    await page.waitForFunction(() => document.activeElement?.classList.contains('chapter-button'));
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.activeElement?.dataset.cid === 'D');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#sid-label').innerText(), 'D.1');
    assert.equal(await page.locator('#chapter-title').innerText(), 'D — Dhyana');

    await page.keyboard.press('h');
    assert.equal(await page.locator('#help-overlay').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#help-overlay').isVisible(), false);
    await page.keyboard.press('k');
    assert.equal(await page.locator('#about-overlay').isVisible(), true);
    assert.notEqual(await page.locator('#about-version').innerText(), 'dev');
    await page.keyboard.press('Escape');

    await page.locator('#footer-fullscreen-button').click();
    await page.locator('#footer-fullscreen-button[aria-label="Exit fullscreen"]').waitFor();
    await page.keyboard.press('h');
    assert.equal(await page.locator('#help-overlay').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#help-overlay').isVisible(), false);
    assert.equal(await page.locator('#footer-fullscreen-button').getAttribute('aria-label'), 'Exit fullscreen');
    await page.keyboard.press('f');
    await page.locator('#footer-fullscreen-button[aria-label="Enter fullscreen"]').waitFor();
    const accessibilityProblems = await page.evaluate(() => {
      const visibleButtonsWithoutNames = Array.from(document.querySelectorAll('button')).filter((button) => {
        if (button.hidden || getComputedStyle(button).display === 'none') return false;
        return !(button.getAttribute('aria-label') || button.textContent.trim() || button.getAttribute('title'));
      }).length;
      const invalidDialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter((dialog) => {
        const labelledBy = dialog.getAttribute('aria-labelledby');
        return dialog.getAttribute('aria-modal') !== 'true' || !labelledBy || !document.getElementById(labelledBy);
      }).length;
      return { visibleButtonsWithoutNames, invalidDialogs };
    });
    assert.deepEqual(accessibilityProblems, { visibleButtonsWithoutNames: 0, invalidDialogs: 0 });

    await page.goto(`${base}/player.html?play=gita-700&sid=6.7&pid=1`, { waitUntil: 'networkidle' });
    await page.keyboard.press('e');
    await page.locator('#workspace-overlay').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Open collections folder' }).click();
    const meaning = page.locator('[data-edit-field="languages.en.meaning"]');
    await meaning.waitFor();
    assert.equal(await meaning.getAttribute('contenteditable'), 'true');
    await meaning.fill('Regression edited meaning');
    await page.getByRole('button', { name: 'Save row' }).click();
    await page.waitForFunction(() => Object.keys(window.__workspaceWrites || {}).length === 1, null, { timeout: 30000 }).catch(async (error) => {
      const diagnostic = await page.evaluate(() => ({
        writes: Object.keys(window.__workspaceWrites || {}),
        status: document.querySelector('.edit-status')?.textContent,
        workspaceError: document.getElementById('workspace-error')?.textContent
      }));
      throw new Error(error.message + '\nWorkspace diagnostic: ' + JSON.stringify(diagnostic));
    });
    assert.equal(await meaning.innerText(), 'Regression edited meaning');
    assert.equal(await page.locator('#download-reminder').isVisible(), false);
    const workspaceWrites = await page.evaluate(() => ({ ...window.__workspaceWrites }));
    assert.deepEqual(Object.keys(workspaceWrites), ['verses/bhagavad-gita/master_en.csv']);
    assert.match(workspaceWrites['verses/bhagavad-gita/master_en.csv'], /Regression edited meaning/);

    await page.goto(`${base}/player.html?play=gita-700&sid=6.7&pid=1`, { waitUntil: 'networkidle' });
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Edit with downloads only' }).click();
    const fallbackMeaning = page.locator('[data-edit-field="languages.en.meaning"]');
    await fallbackMeaning.fill('Regression downloaded meaning');
    await page.getByRole('button', { name: 'Save row' }).click();
    assert.equal(await page.locator('#download-reminder').isVisible(), true);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-reminder-action').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'master_en.csv');
    const downloadPath = await download.path();
    assert.match(fs.readFileSync(downloadPath, 'utf8'), /Regression downloaded meaning/);

    await page.goto(`${base}/player.html?pid=1`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#sid-label').innerText(), '6.7');
    await page.keyboard.press('a');
    await page.getByRole('heading', { name: 'Choose an experience' }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Choose an experience' }).waitFor();
    assert.match(await page.locator('#gita-700-link').getAttribute('href'), /[?&]sid=6\.7(?:&|$)/, 'experience link must carry the saved SID');
    await page.getByRole('link', { name: /Gita 700/ }).click();
    await page.locator('#sid-label').waitFor();
    assert.equal(await page.locator('#sid-label').innerText(), '6.7', 'experience selection must preserve the per-experience resume point');
    await page.keyboard.press('a');
    await page.getByRole('heading', { name: 'Choose an experience' }).waitFor();

    await page.locator('[data-profile-pill]').first().click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Regression Profile');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.locator('[data-profile-pill]').first().click();
    await page.getByRole('button', { name: 'Switch profile' }).click();
    await page.getByRole('heading', { name: 'Switch profile' }).waitFor();
    await page.getByRole('button', { name: /Add another profile/ }).click();
    await createProfile(page, 'Second Regression');
    assert.match(await page.locator('[data-profile-pill]').first().getAttribute('aria-label'), /Second Regression/);
    await page.locator('[data-profile-pill]').first().click();
    await page.getByRole('button', { name: 'Switch profile' }).click();
    await page.locator('.profile-select').filter({ hasText: 'Regression Profile' }).click();
    await page.getByRole('heading', { name: 'Choose an experience' }).waitFor();
    assert.match(await page.locator('[data-profile-pill]').first().getAttribute('aria-label'), /Regression Profile/);
    await page.locator('[data-profile-pill]').first().click();
    await page.getByRole('button', { name: 'Manage profiles' }).click();
    assert.equal(await page.locator('.profile-card').count(), 2);
    const secondCard = page.locator('.profile-card').filter({ hasText: 'Second Regression' });
    const confirmDelete = page.waitForEvent('dialog');
    await secondCard.getByRole('button', { name: 'Delete' }).click();
    const dialog = await confirmDelete;
    assert.equal(dialog.type(), 'confirm');
    await dialog.accept();
    await page.waitForFunction(() => document.querySelectorAll('.profile-card').length === 1);
    assert.equal(await page.locator('.profile-card').count(), 1);
    await page.getByRole('button', { name: 'Back' }).click();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}/player.html?play=gita-700&sid=6.7`, { waitUntil: 'networkidle' });
    await createProfile(mobilePage, 'Mobile Regression');
    await mobilePage.goto(`${base}/player.html?play=gita-700&sid=6.7&pid=1`, { waitUntil: 'networkidle' });
    const boxes = await mobilePage.locator('.gita-700-panel').evaluateAll((panels) => panels.map((panel) => panel.getBoundingClientRect().top));
    assert.ok(boxes.every((top, index) => index === 0 || top > boxes[index - 1]), 'mobile panels must stack vertically');
    assert.equal(await mobilePage.locator('.controlbar').evaluate((element) => getComputedStyle(element).position), 'fixed');
    assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
    await mobilePage.evaluate(() => {
      const target = document.getElementById('renderer-root');
      const start = new Touch({ identifier: 1, target, clientX: 320, clientY: 300 });
      const end = new Touch({ identifier: 1, target, clientX: 70, clientY: 305 });
      target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], targetTouches: [start] }));
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }));
    });
    await mobilePage.locator('#sid-label').waitFor();
    assert.equal(await mobilePage.locator('#sid-label').innerText(), '6.8');
    await mobilePage.setViewportSize({ width: 844, height: 390 });
    const landscapeBoxes = await mobilePage.locator('.gita-700-panel').evaluateAll((panels) => panels.map((panel) => panel.getBoundingClientRect().top));
    assert.ok(landscapeBoxes.every((top, index) => index === 0 || top > landscapeBoxes[index - 1]), 'mobile landscape panels must remain vertically stacked');
    await mobile.close();

    const migrationContext = await browser.newContext();
    const migrationPage = await migrationContext.newPage();
    await migrationPage.goto(`${base}/offline.html`, { waitUntil: 'domcontentloaded' });
    await migrationPage.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('gitaverse-profiles', 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore('profiles', { keyPath: 'pid', autoIncrement: true });
        database.createObjectStore('settings', { keyPath: 'key' });
        database.createObjectStore('resumePoints', { keyPath: 'pid' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['profiles', 'settings'], 'readwrite');
        transaction.objectStore('profiles').put({
          pid: 1, name: 'Legacy Kannada', dob: '1990-01-01', gender: '', language: 'kn',
          photo: '', analyticsProfileId: 'legacy-regression', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
        });
        transaction.objectStore('settings').put({ key: 'defaultPid', value: 1 });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    }));
    await migrationPage.goto(`${base}/player.html?play=gita-700&sid=1.B&pid=1`, { waitUntil: 'networkidle' });
    assert.equal(await migrationPage.locator('#help-button .top-menu-label').innerText(), 'ಸಹಾಯ');
    assert.equal(await migrationPage.locator('#language-button .top-menu-label').innerText(), 'ವಿಷಯ ಭಾಷೆ (ಕನ್ನಡ)');
    const migratedProfile = await migrationPage.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('gitaverse-profiles');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const get = database.transaction('profiles').objectStore('profiles').get(1);
        get.onerror = () => reject(get.error);
        get.onsuccess = () => { database.close(); resolve(get.result); };
      };
    }));
    assert.equal(migratedProfile.interfaceLanguage, 'kn');
    assert.equal(migratedProfile.contentLanguage, 'kn');
    assert.equal(Object.hasOwn(migratedProfile, 'language'), false);
    await migrationContext.close();

    const languageContext = await browser.newContext();
    const languagePage = await languageContext.newPage();
    await languagePage.goto(`${base}/player.html`, { waitUntil: 'networkidle' });
    await languagePage.getByLabel('Name', { exact: true }).fill('Kannada Interface');
    await languagePage.getByLabel('Date of birth', { exact: true }).fill('1990-01-01');
    await languagePage.getByLabel('App language', { exact: true }).selectOption('kn');
    await languagePage.getByLabel('ಆದ್ಯತೆಯ ಗೀತಾ ವಿಷಯ ಭಾಷೆ', { exact: true }).selectOption('en');
    await languagePage.getByRole('button', { name: 'ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ' }).click();
    await languagePage.getByRole('heading', { name: 'ಅನುಭವವನ್ನು ಆಯ್ಕೆಮಾಡಿ' }).waitFor();
    await languagePage.locator('#gita-700-link').click();
    await languagePage.locator('#sid-label').waitFor();
    assert.equal(await languagePage.locator('#help-button .top-menu-label').innerText(), 'ಸಹಾಯ');
    assert.equal(await languagePage.locator('#language-button .top-menu-label').innerText(), 'ವಿಷಯ ಭಾಷೆ (English)');
    assert.match(await languagePage.locator('#chapter-title').innerText(), /^1 — Arjuna Vishada Yoga$/);
    await languagePage.goto(`${base}/player.html?play=gita-700&sid=1.B&lang=kn&pid=1`, { waitUntil: 'networkidle' });
    assert.equal(await languagePage.locator('#help-button .top-menu-label').innerText(), 'ಸಹಾಯ');
    assert.equal(await languagePage.locator('#language-button .top-menu-label').innerText(), 'ವಿಷಯ ಭಾಷೆ (ಕನ್ನಡ)');
    assert.match(await languagePage.locator('#chapter-title').innerText(), /^1 — ಅರ್ಜುನ ವಿಷಾದ ಯೋಗ$/);
    await languageContext.close();

    const fileContext = await browser.newContext();
    const filePage = await fileContext.newPage();
    const fileUrl = pathToFileURL(path.join(root, 'player.html')).href + '?play=gita-700&sid=6.7';
    await filePage.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await createProfile(filePage, 'File Regression');
    await filePage.getByRole('link', { name: /Gita 700/ }).click();
    await filePage.locator('#data-chooser').waitFor({ state: 'visible' });
    await filePage.locator('#collections-folder-input').setInputFiles(path.join(root, 'data/collections'));
    await filePage.locator('#sid-label').waitFor();
    assert.equal(await filePage.locator('#sid-label').innerText(), '1.B');
    await filePage.keyboard.press('ArrowRight');
    assert.match(await filePage.locator('#audio').getAttribute('src'), /^blob:/);
    await filePage.keyboard.press('e');
    assert.equal(await filePage.locator('#workspace-overlay').isVisible(), true);
    await fileContext.close();

    assert.deepEqual(errors, [], 'browser console/page errors');
    await page.goto(`${base}/player.html?play=gita-700&sid=6.7&pid=1`, { waitUntil: 'networkidle' });
    await page.locator('#sid-label').waitFor();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#sid-label').waitFor();
    await new Promise((resolve) => server.close(resolve));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#sid-label').waitFor();
    assert.equal(await page.locator('#sid-label').innerText(), '6.7');
    console.log('PASS: collection player browser parity, direct workspace editing, download fallback, profiles, file mode, mobile layout/swipe, resume, and offline reload');
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
