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
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json'
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
  await page.getByRole('heading', { name: 'Diksoochi', exact: true }).waitFor();
}

async function assertYogaTopColumnsDoNotOverlap(page) {
  const boxes = await page.locator('[data-role="shloka"], [data-role$="-transliteration"]').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { role: element.dataset.role, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }).sort((left, right) => left.left - right.left)
  );
  assert.equal(boxes.length, 3);
  assert.ok(boxes[0].right <= boxes[1].left + 1, `${boxes[0].role} overlaps ${boxes[1].role}`);
  assert.ok(boxes[1].right <= boxes[2].left + 1, `${boxes[1].role} overlaps ${boxes[2].role}`);
  assert.ok(boxes.every((box) => box.top < box.bottom), 'all top-row fields must have visible geometry');
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
  await context.route('https://docs.google.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>Google deck fixture</title>'
  }));
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
  const missingIllustrationResponses = [];
  const missingResourceMessages = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() === 404 && /\/data\/collections\/images\/gita-sara-illustrations\/[^/]+-\d+\.webp(?:\?|$)/.test(response.url())) {
      missingIllustrationResponses.push(response.url());
    }
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().startsWith('Failed to load resource: the server responded with a status of 404')) missingResourceMessages.push(message.text());
    else errors.push(message.text());
  });

  try {
    await page.goto(`${base}/player.html?play=gita-700&sid=6.7&lang=kn`, { waitUntil: 'networkidle' });
    assert.equal(await page.getByLabel('App language', { exact: true }).inputValue(), '', 'first profile must require an explicit app language');
    await createProfile(page);
    assert.equal(await page.locator('.diksoochi-dimension').count(), 0);
    assert.equal(await page.locator('#diksoochi-journey-empty').innerText(), 'Your journey details will be updated here.');
    assert.equal(await page.locator('#diksoochi-know-summary').isHidden(), true);
    assert.equal(await page.getByRole('heading', { name: 'Your journey', exact: true }).isVisible(), true);
    assert.equal(await page.locator('.diksoochi-flute').isVisible(), true);
    assert.equal(await page.locator('.diksoochi-flute img').evaluate((image) => getComputedStyle(image).animationIterationCount), 'infinite');
    assert.equal(await page.getByText('A personal compass, not a test.').count(), 0);
    const landingOrder = await page.evaluate(() => ['.diksoochi-journey-group', '.diksoochi-experiences'].map((selector) => document.querySelector(selector).getBoundingClientRect().top));
    assert.ok(landingOrder[0] < landingOrder[1], 'Your Journey must appear before Choose an Experience');
    assert.equal(await page.getByText('Come back to what matters', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Choose your way in', { exact: true }).count(), 0);
    const experienceOrder = await page.locator('.diksoochi-experiences .experience-link').evaluateAll((links) => links.map((link) => link.id));
    assert.deepEqual(experienceOrder, ['gita-yoga-link', 'gita-sara-link', 'gita-700-link'], 'the chooser must preserve the approved experience order');
    await page.locator('#gita-yoga-link').click();
    assert.equal(await page.locator('#experience-detail').isVisible(), true, 'experience selection must reveal its details before entering');
    assert.equal(await page.locator('#experience-detail-title').innerText(), 'Gita Yoga');
    await page.locator('#experience-detail-action').click();
    await page.locator('.gita-yoga-panel').first().waitFor();
    assert.equal(await page.locator('#sid-label').innerText(), '1.B');
    assert.equal(await page.locator('.gita-yoga-panel').count(), 3);
    assert.equal(await page.locator('.gita-yoga-field').count(), 8, 'each Gita Yoga data field must have exactly one UI element');
    assert.equal(await page.locator('[data-role]').evaluateAll((elements) => new Set(elements.map((element) => element.dataset.role)).size), 8, 'Gita Yoga roles must not be duplicated');
    assert.equal(await page.locator('.gita-yoga-sanskrit').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(251, 246, 234)');
    assert.equal(await page.locator('.gita-yoga-language-panel').first().evaluate((element) => getComputedStyle(element).minHeight), '0px', 'language panels must use content-driven height');
    assert.equal(await page.locator('.gita-yoga-panels').evaluate((panels) => panels.clientHeight === panels.parentElement.clientHeight), true, 'desktop Gita Yoga must fill the fixed renderer area');
    assert.equal(await page.locator('.gita-yoga-language-panel').evaluateAll((panels) => new Set(panels.map((panel) => Math.round(panel.getBoundingClientRect().height))).size), 1, 'desktop language panels must share one fixed-height row');
    assert.equal(await page.locator('[data-role="sanskrit-words"]').evaluate((words) => words.getBoundingClientRect().top < document.querySelector('[data-role="shloka"]').getBoundingClientRect().top), true, 'desktop word-by-word text must precede the three shloka columns');
    assert.ok(Number(await page.locator('[data-role="shloka"]').evaluate((element) => getComputedStyle(element).fontWeight)) <= 550, 'Gita Yoga shloka typography must remain light');
    assert.equal(await page.locator('[data-language-panel="en"]').evaluate((element) => element.getBoundingClientRect().left < document.querySelector('[data-language-panel="kn"]').getBoundingClientRect().left), true, 'English must be the primary desktop panel for English content');
    await assertYogaTopColumnsDoNotOverlap(page);
    assert.notEqual(await page.locator('[data-role="shloka"]').innerText(), '—');
    assert.match(await page.locator('#audio').getAttribute('src'), /^https:\/\/media\.gitajyoti\.org\/audio\/chanting-aj-padma-aj-vijay-learn-mode\/.*\.ogg$/);
    await page.keyboard.press('l');
    await page.getByRole('button', { name: 'ಕನ್ನಡ' }).click();
    assert.equal(await page.locator('[data-language-panel="kn"]').evaluate((element) => element.getBoundingClientRect().left < document.querySelector('[data-language-panel="en"]').getBoundingClientRect().left), true, 'Kannada must move to the primary desktop panel when content language changes');
    await assertYogaTopColumnsDoNotOverlap(page);
    await page.locator('#renderer-root').evaluate((root) => {
      root.querySelector('.gita-yoga-panels').style.paddingBottom = '1000px';
      root.scrollTop = root.scrollHeight;
    });
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#renderer-root').evaluate((root) => root.scrollTop), 0, 'a newly rendered verse must start at the top');
    await page.locator('.gita-yoga-panels').evaluate((panels) => { panels.style.paddingBottom = ''; });

    await page.setViewportSize({ width: 1680, height: 950 });
    await page.goto(`${base}/player.html?play=gita-yoga&sid=7.1&lang=kn&pid=1`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#renderer-root').evaluate((root) => root.scrollHeight <= root.clientHeight + 1), true, 'a content-fitting desktop verse must not create a renderer scrollbar');
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto(`${base}/player.html?play=gita-yoga&sid=8.1&pid=1`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.gita-yoga-panel').count(), 3, 'missing work-in-progress audio must not prevent verse rendering');
    assert.equal(await page.locator('#play-button').isDisabled(), true, 'a verse without mapped Gita Yoga audio must disable playback');

    await page.goto(`${base}/player.html?play=gita-sara&sid=2.47&lang=en&pid=1`, { waitUntil: 'networkidle' });
    await page.locator('.gita-sara-layout').waitFor();
    assert.equal(await page.locator('#sid-label').innerText(), '2.47');
    assert.equal(await page.locator('[data-sara-panel]').count(), 3);
    assert.equal(await page.locator('.gita-sara-deck-frame').count(), 1, 'the associated Google deck is rendered without placeholder media');
    assert.equal(await page.locator('[data-media-action="previous"]').isHidden(), true);
    const deckUrl = new URL(await page.locator('.gita-sara-deck-frame').getAttribute('src'));
    assert.equal(deckUrl.pathname, '/presentation/d/1M9NHIrSyx0MMUkvnzqnzgp2jCd0z3A-XE5lyao33QNc/embed');
    assert.equal(deckUrl.searchParams.get('rm'), 'minimal');
    assert.match(await page.locator('[data-role="question-stage"]').innerText(), /^1\.\s+.*complete attention/s);
    await page.locator('[data-text-action="next"]').click();
    assert.match(await page.locator('[data-role="question-stage"]').innerText(), /^2\.\s+.*outcome/s);
    await page.locator('[data-text-action="toggle-all"]').click();
    assert.equal(await page.locator('[data-role="question-stage"] p').count(), 4);
    assert.deepEqual(await page.locator('[data-role="question-stage"] p').allTextContents(), [
      '1. What action deserves your complete attention right now?',
      '2. Where is concern about the outcome changing the quality of your action?',
      '3. What would wholehearted effort look like if success were not guaranteed?',
      '4. Is fear of the result pulling you toward inaction?'
    ]);
    assert.equal(await page.locator('[data-role="question-stage"] p').first().evaluate((element) => getComputedStyle(element).textAlign), 'left');
    const questionLeftEdges = await page.locator('[data-role="question-stage"] p').evaluateAll((questions) => questions.map((question) => question.getBoundingClientRect().left));
    assert.ok(Math.max(...questionLeftEdges) - Math.min(...questionLeftEdges) < 2, 'all-question mode must give every question the same left edge');
    assert.equal(await page.locator('[data-role="meaning"]').getAttribute('lang'), 'en');
    assert.match(await page.locator('#audio').getAttribute('src'), /^https:\/\/media\.gitajyoti\.org\/audio\/chanting-swami-brahmananda\/.*\.mp3$/);
    const saraWidths = await page.locator('[data-sara-panel]').evaluateAll((panels) => panels.map((panel) => panel.getBoundingClientRect().width));
    const threePanelWordSize = Number.parseFloat(await page.locator('[data-role="word"]').evaluate((element) => getComputedStyle(element).fontSize));
    assert.ok(Math.max(...saraWidths) - Math.min(...saraWidths) < 3, 'all three desktop panels must have equal width');
    assert.equal(await page.locator('#renderer-root').evaluate((root) => root.scrollHeight <= root.clientHeight + 1), true, 'desktop Gita Sara must fit without renderer scrolling');
    await page.keyboard.press('m');
    assert.equal(await page.locator('#questions-button').isVisible(), true, 'the shared menu exposes Questions only for a capable renderer');
    assert.equal(await page.locator('#questions-button .top-menu-label').innerText(), 'Questions (On)');
    await page.locator('#questions-button').click();
    assert.equal(await page.locator('[data-sara-panel="questions"]').isHidden(), true, 'Q hides the contemplation panel');
    const focusedWidths = await page.locator('[data-sara-panel="text"], [data-sara-panel="media"]').evaluateAll((panels) => panels.map((panel) => panel.getBoundingClientRect().width));
    assert.ok(Math.abs(focusedWidths[1] - saraWidths[1]) < 2, 'the illustration panel keeps its exact three-panel width');
    assert.ok(focusedWidths[0] > focusedWidths[1] * 1.9, 'the shloka panel receives the removed question-panel space');
    await page.waitForFunction((previous) => Number.parseFloat(getComputedStyle(document.querySelector('[data-role="word"]')).fontSize) > previous, threePanelWordSize);
    const focusedWordSize = Number.parseFloat(await page.locator('[data-role="word"]').evaluate((element) => getComputedStyle(element).fontSize));
    assert.ok(focusedWordSize > threePanelWordSize, 'word-by-word text uses the additional focused-view space');
    assert.equal(await page.locator('[data-sara-view-action]').count(), 0, 'question visibility controls do not occupy content panels');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-sara-panel="questions"]').isHidden(), true, 'the focused view remains active across shloka navigation');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('q');
    assert.equal(await page.locator('[data-sara-panel="questions"]').isVisible(), true, 'Q restores the contemplation panel');
    await page.keyboard.press('c');
    await page.locator('#chapters-overlay').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.chapter-button').count(), 19);
    assert.equal(await page.locator('.chapter-list-icon').count(), 19, 'curated Gita Sara chapters must retain every shared chapter icon');
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await page.locator('#workspace-overlay').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Open collections folder' }).click();
    await page.locator('[data-role="media-editor"]:visible').waitFor();
    assert.equal(await page.locator('[data-media-edit-row]').count(), 1, 'Gita Sara edit mode exposes only associated media');
    assert.equal(await page.locator('[data-question-edit-row]').count(), 4, 'Gita Sara edit mode exposes bilingual questions');
    assert.equal(await page.locator('[data-media-field="alt"]').count(), 1, 'only the active card exposes selected-language metadata');
    assert.equal(await page.locator('[data-question-field="text"]').count(), 1, 'only the active question exposes selected-language text');
    await page.locator('[data-media-edit-row]').first().locator('[data-media-field="url"]').fill('https://docs.google.com/presentation/d/regressionDeck/edit?usp=sharing');
    await page.locator('[data-question-edit-row]').first().locator('[data-question-field="text"]').fill('Regression contemplation question?');
    await page.getByRole('button', { name: 'Save row' }).click();
    await page.waitForFunction(() => document.querySelector('.edit-status')?.textContent?.startsWith('Saved to'));
    const saraWrites = await page.evaluate(() => ({ ...window.__workspaceWrites }));
    assert.match(saraWrites['deck/gita-sara-google-decks/catalog.csv'], /regressionDeck/);
    assert.match(saraWrites['text/gita-sara-contemplations/master_en.csv'], /Regression contemplation question/);
    assert.ok(saraWrites['experiences/gita-sara/media.csv'], 'media composition is saved');
    assert.ok(saraWrites['experiences/gita-sara/contemplations.csv'], 'question composition is saved');
    await page.evaluate(() => Object.keys(window.__workspaceWrites).forEach((key) => delete window.__workspaceWrites[key]));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.gita-sara-deck-frame').count(), 1);
    assert.equal(await page.locator('.gita-sara-media-error').count(), 0);

    await page.goto(`${base}/player.html?play=gita-sara&sid=1.1&lang=en&pid=1`, { waitUntil: 'networkidle' });
    await page.locator('.gita-sara-media-image').waitFor();
    const illustrationSource = await page.locator('.gita-sara-media-image').getAttribute('src');
    assert.equal(await page.locator('.gita-sara-media-image').evaluate((image) => getComputedStyle(image).objectFit), 'cover');
    const threePanelImageWidth = await page.locator('[data-sara-panel="media"]').evaluate((panel) => panel.getBoundingClientRect().width);
    await page.keyboard.press('q');
    assert.equal(await page.locator('.gita-sara-media-image').getAttribute('src'), illustrationSource, 'changing panel count must not change the visible illustration source');
    assert.ok(Math.abs(await page.locator('[data-sara-panel="media"]').evaluate((panel) => panel.getBoundingClientRect().width) - threePanelImageWidth) < 2, 'image framing remains identical because its panel width is invariant');
    await page.keyboard.press('q');
    assert.equal(await page.locator('[data-text-action="toggle-all"]').isHidden(), false);
    assert.match(await page.locator('[data-role="question-stage"]').innerText(), /^1\.\s+Who is Dhritarastra\?/);
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Open collections folder' }).click();
    await page.locator('[data-role="media-editor"]:visible').waitFor();
    assert.equal(await page.locator('[data-media-edit-row]').count(), 1);
    assert.equal(await page.locator('[data-question-edit-row]').count(), 5);
    await page.locator('[data-question-edit-row]').first().locator('[data-question-field="text"]').fill('Who is Dhritarastra in this scene?');
    await page.getByRole('button', { name: 'Save row' }).click();
    await page.waitForFunction(() => document.querySelector('.edit-status')?.textContent?.startsWith('Saved to'));
    await page.keyboard.press('Escape');
    await page.locator('.gita-sara-media-image').waitFor();
    assert.match(await page.locator('.gita-sara-media-image').getAttribute('src'), /^blob:/, 'retained local media must keep its resolved source after an edit save and exit');
    assert.equal(await page.locator('.gita-sara-media-error').count(), 0, 'retained local media must not become unavailable after another collection save');
    await page.goto(`${base}/player.html?play=gita-sara&sid=D.1&lang=en&pid=1`, { waitUntil: 'networkidle' });
    assert.match(await page.locator('.gita-sara-media-image').getAttribute('src'), /gita-sara-default-illustration\/transformation-cycle-clean\.png/);
    assert.equal(await page.locator('.gita-sara-media-image').getAttribute('alt'), 'TRUTH. REALISE. USE.');
    assert.equal(await page.locator('[data-role="media-caption"]').innerText(), 'TRUTH. REALISE. USE.');
    assert.match(await page.locator('[data-role="question-stage"]').innerText(), /^1\.\s+What is Truth/);
    assert.equal(await page.locator('[data-text-action="toggle-all"]').isHidden(), true, 'one question must remain in single-question mode');
    assert.equal(await page.locator('[data-media-action="next"]').isHidden(), true, 'single fallback media needs no navigation');
    assert.equal(await page.locator('#play-button').isDisabled(), true, 'Dhyana remains usable without Swami Brahmananda audio');

    await page.keyboard.press('a');
    await page.locator('#gita-700-link').waitFor({ state: 'visible' });
    await page.locator('#gita-700-link').click();
    await page.locator('#experience-detail-action').click();
    await assert.doesNotReject(() => page.locator('#sid-label').waitFor());
    assert.equal(await page.locator('#sid-label').innerText(), '1.B');

    await page.goto(`${base}/player.html?play=gita-700&sid=6.7&lang=kn&pid=1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    for (const sample of ['Gitaverse', 'श्रीमद्भगवद्गीता', 'ಶ್ರೀಮದ್ಭಗವದ್ಗೀತೆ']) {
      await page.evaluate((text) => document.fonts.load('16px "Gitaverse Noto Sans"', text), sample);
      assert.equal(await page.evaluate((text) => document.fonts.check('16px "Gitaverse Noto Sans"', text), sample), true, `Noto Sans must load for ${sample}`);
    }
    assert.match(await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily), /Gitaverse Noto Sans/);
    assert.equal(await page.locator('#sid-label').innerText(), '6.7');
    assert.equal(await page.locator('#language-button .top-menu-label').innerText(), 'Content language (ಕನ್ನಡ)');
    assert.equal(await page.locator('#help-button .top-menu-label').innerText(), 'Help');
    assert.match(await page.locator('#chapter-title').innerText(), /^6 — /);
    assert.equal(await page.locator('.gita-700-panel').count(), 4);
    assert.equal(await page.locator('[data-role="shloka"]').getAttribute('lang'), 'sa');
    assert.equal(await page.locator('[data-role="meaning"]').getAttribute('lang'), 'kn');
    assert.match(await page.locator('[data-role="shloka"]').evaluate((element) => getComputedStyle(element).fontFamily), /Gitaverse Noto Sans/);
    assert.equal(await page.locator('.gita-700-panel-content').evaluateAll((panels) => panels.every((panel) => {
      const text = panel.firstElementChild;
      return text.scrollHeight <= panel.clientHeight + 1 && text.scrollWidth <= panel.clientWidth + 1;
    })), true, 'Noto Sans content must fit every desktop panel');
    assert.equal(await page.locator('#play-button').isEnabled(), true);
    assert.equal(await page.locator('#audio').getAttribute('src'), 'https://media.gitajyoti.org/audio/chanting-swami-brahmananda/sa/chapter-06/06-007.mp3');
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
    assert.equal(await page.getByText('Open Your journey', { exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#help-overlay').isVisible(), false);
    await page.keyboard.press('k');
    assert.equal(await page.locator('#about-overlay').isVisible(), true);
    const deployedVersion = await page.locator('#about-version').innerText();
    assert.notEqual(deployedVersion, 'dev');
    await page.getByRole('button', { name: 'Version history' }).click();
    await page.locator('.about-history-item').first().waitFor();
    assert.equal(await page.locator('.about-history-item h3').first().innerText(), deployedVersion);
    assert.ok((await page.locator('.about-history-item p').first().innerText()).length > 0);
    assert.match(await page.locator('.about-history-item').first().innerText(), /Seen on this device/);
    await page.getByRole('button', { name: '← Back to About' }).click();
    assert.equal(await page.getByRole('heading', { name: 'About Gitaverse' }).isVisible(), true);
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
    await page.getByRole('heading', { name: 'Diksoochi', exact: true }).waitFor();
    assert.equal(await page.locator('#continue-journey-link').getAttribute('data-experience'), 'gita-700', 'Home must continue the most recently visited experience rather than the first chooser item');
    assert.equal(await page.locator('#continue-journey-title').innerText(), 'Shloka 6.7');
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('gitaverse-profiles');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('diksoochiEngagement', 'readwrite');
        transaction.objectStore('diksoochiEngagement').put({
          key: '1:gita-700:6.7', pid: 1, experience: 'gita-700', sid: '6.7', chapter: '6',
          firstMeaningfulAt: new Date().toISOString(), lastMeaningfulAt: new Date().toISOString(), meaningfulVisitCount: 1, maxEngagementSeconds: 10
        });
        transaction.objectStore('diksoochiEngagement').put({
          key: '1:gita-yoga:6.7', pid: 1, experience: 'gita-yoga', sid: '6.7', chapter: '6',
          firstMeaningfulAt: new Date().toISOString(), lastMeaningfulAt: new Date().toISOString(), meaningfulVisitCount: 2, maxEngagementSeconds: 20
        });
        transaction.objectStore('diksoochiEngagement').put({
          key: '1:gita-700:8.4', pid: 1, experience: 'gita-700', sid: '8.4', chapter: '8',
          firstMeaningfulAt: new Date().toISOString(), lastMeaningfulAt: new Date().toISOString(), meaningfulVisitCount: 1, maxEngagementSeconds: 10
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    }));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Diksoochi', exact: true }).waitFor();
    assert.equal(await page.locator('#diksoochi-know-summary-text').innerText(), 'You have explored 2 chapters and 2 shlokas.');
    await page.getByRole('button', { name: 'Details' }).click();
    await page.getByRole('heading', { name: 'Your journey', exact: true }).waitFor();
    assert.equal(await page.locator('[data-journey-view="cards"] svg').count(), 1);
    assert.equal((await page.locator('[data-journey-view="cards"]').innerText()).trim(), '', 'journey view controls must remain icon-only');
    assert.equal(await page.getByRole('button', { name: 'Table view' }).getAttribute('title'), 'Table view');
    assert.equal(await page.locator('#journey-table-body .journey-table-row').count(), 2, 'the same SID across experiences must be one journey row');
    const journeyCells = await page.locator('#journey-table-body tr').first().locator('th, td').allTextContents();
    assert.equal(journeyCells[0], '6.7');
    assert.equal(journeyCells[3], '3');
    assert.ok(journeyCells[1].length > 10 && !journeyCells[1].includes('\n'), 'Sanskrit must be populated on one line');
    assert.ok(journeyCells[2].length > 10 && !journeyCells[2].includes('\n'), 'preferred-language meaning must be populated on one line');
    const journeyRows = page.locator('#journey-table-body .journey-table-row');
    await journeyRows.first().focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.journeySid), '8.4');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.journeySid), '8.4', 'table left/right must not change the selected row');
    await page.keyboard.press('Enter');
    assert.equal(await journeyRows.nth(1).getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('[data-journey-detail="8.4"]').last().isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await journeyRows.nth(1).getAttribute('aria-expanded'), 'false');
    await page.getByRole('button', { name: 'Card view' }).click();
    assert.equal(await page.getByRole('button', { name: 'Card view' }).getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.journey-card[data-journey-sid="6.7"]').innerText(), /6\.7[\s\S]*3/);
    assert.equal(await page.locator('.journey-card[data-journey-sid="8.4"]').getAttribute('tabindex'), '0', 'view switching must preserve the selected SID');
    await page.locator('.journey-card[data-journey-sid="8.4"]').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.journeySid), '6.7');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.journey-card[data-journey-sid="6.7"]').getAttribute('aria-expanded'), 'true');
    assert.match(await page.locator('.journey-card[data-journey-sid="6.7"] .journey-expanded').innerText(), /\n/, 'expanded card must show complete shloka and meaning blocks');
    await page.getByRole('button', { name: '← Back' }).click();
    await page.getByRole('button', { name: 'Details' }).click();
    await page.locator('.journey-card').first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Card view' }).getAttribute('aria-pressed'), 'true', 'journey view preference must persist per profile');
    await page.getByRole('button', { name: '← Back' }).click();
    assert.match(await page.locator('#gita-700-link').getAttribute('href'), /[?&]sid=6\.7(?:&|$)/, 'experience link must carry the saved SID');
    await page.locator('#gita-700-link').click();
    await page.locator('#experience-detail-action').click();
    await page.locator('#sid-label').waitFor();
    assert.equal(await page.locator('#sid-label').innerText(), '6.7', 'experience selection must preserve the per-experience resume point');
    await page.locator('#play-button').click();
    await page.locator('#play-button[aria-label="Pause audio"]').waitFor();
    await page.keyboard.press('m');
    await page.getByRole('button', { name: /Your journey\s+J/ }).click();
    await page.getByRole('heading', { name: 'Your journey', exact: true }).waitFor();
    assert.equal(await page.locator('#audio').evaluate((audio) => audio.paused), true, 'opening journey from the player must pause audio');
    await page.getByRole('button', { name: 'Table view' }).click();
    await page.locator('.journey-table-row').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.journey-table-detail:not([hidden]) p').first().evaluate((element) => getComputedStyle(element).textAlign), 'center');
    await page.getByRole('button', { name: '← Back' }).click();
    assert.equal(await page.locator('#sid-label').innerText(), '6.7', 'journey Back must restore the originating player SID');
    assert.equal(await page.locator('#audio').evaluate((audio) => audio.paused), true, 'audio must remain paused after returning from journey');
    await page.keyboard.press('j');
    await page.getByRole('heading', { name: 'Your journey', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#sid-label').innerText(), '6.7', 'J and Escape must return to the player origin');
    await page.keyboard.press('a');
    await page.getByRole('heading', { name: 'Diksoochi', exact: true }).waitFor();

    await page.locator('[data-profile-pill]').first().click();
    assert.deepEqual(await page.locator('.profile-menu-options button').allTextContents(), ['My preferences', 'View / edit profile', 'Switch / manage profiles']);
    await page.getByRole('button', { name: 'My preferences' }).click();
    await page.locator('#profile-preferences-section').waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('heading', { name: 'My preferences' }).isVisible(), true);
    assert.equal(await page.getByLabel('App language', { exact: true }).inputValue(), 'en');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.locator('[data-profile-pill]').first().click();
    await page.getByRole('button', { name: 'View / edit profile' }).click();
    assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Regression Profile');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.locator('[data-profile-pill]').first().click();
    await page.getByRole('button', { name: 'Switch / manage profiles' }).click();
    await page.getByRole('heading', { name: 'Switch profile' }).waitFor();
    await page.getByRole('button', { name: /Add another profile/ }).click();
    await createProfile(page, 'Second Regression');
    assert.match(await page.locator('[data-profile-pill]').first().getAttribute('aria-label'), /Second Regression/);
    await page.locator('[data-profile-pill]').first().click();
    await page.getByRole('button', { name: 'Switch / manage profiles' }).click();
    await page.locator('.profile-select').filter({ hasText: 'Regression Profile' }).click();
    await page.getByRole('heading', { name: 'Diksoochi', exact: true }).waitFor();
    assert.match(await page.locator('[data-profile-pill]').first().getAttribute('aria-label'), /Regression Profile/);
    await page.locator('[data-profile-pill]').first().click();
    await page.getByRole('button', { name: 'Switch / manage profiles' }).click();
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

    await page.goto(`${base}/player.html?play=gita-sara&sid=2.47&lang=en&pid=1`, { waitUntil: 'networkidle' });
    await page.keyboard.press('q');
    await page.waitForTimeout(50);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.gita-sara-layout').waitFor();
    assert.equal(await page.locator('[data-sara-panel="questions"]').isHidden(), true, 'the Gita Sara view persists per profile across reload');
    await page.keyboard.press('q');

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}/player.html?play=gita-700&sid=6.7`, { waitUntil: 'networkidle' });
    await createProfile(mobilePage, 'Mobile Regression');
    assert.equal(await mobilePage.locator('#diksoochi-journey-empty').isVisible(), true, 'mobile Diksoochi must show its compact journey state');
    await mobilePage.goto(`${base}/player.html?play=gita-yoga&sid=1.1&pid=1`, { waitUntil: 'networkidle' });
    const yogaBoxes = await mobilePage.locator('.gita-yoga-panel').evaluateAll((panels) => panels.map((panel) => {
      const box = panel.getBoundingClientRect();
      return { left: box.left, top: box.top };
    }));
    assert.equal(new Set(yogaBoxes.map(({ left }) => Math.round(left))).size, 1, 'mobile Gita Yoga panels must share one column');
    assert.equal(new Set(yogaBoxes.map(({ top }) => Math.round(top))).size, 3, 'mobile Gita Yoga panels must occupy separate rows');
    assert.equal(await mobilePage.locator('[data-role="kn-transliteration"]').isVisible(), true, 'mobile language panels must retain their transliteration');
    assert.equal(await mobilePage.locator('[data-role="sanskrit-words"]').evaluate((words) => words.getBoundingClientRect().top > document.querySelector('[data-role="shloka"]').getBoundingClientRect().top), true, 'mobile must retain shloka before Sanskrit word-by-word text');
    await mobilePage.goto(`${base}/player.html?play=gita-sara&sid=2.47&lang=en&pid=1`, { waitUntil: 'domcontentloaded' });
    await mobilePage.locator('.gita-sara-layout').waitFor();
    const saraMobileBoxes = await mobilePage.locator('[data-sara-panel]').evaluateAll((panels) => panels.map((panel) => ({ left: panel.getBoundingClientRect().left, top: panel.getBoundingClientRect().top })));
    assert.equal(new Set(saraMobileBoxes.map(({ left }) => Math.round(left))).size, 1, 'mobile Gita Sara panels must share one column');
    assert.ok(saraMobileBoxes.every(({ top }, index) => index === 0 || top > saraMobileBoxes[index - 1].top), 'mobile Gita Sara panels must stack in text, media, question order');
    const saraTextBoxes = await mobilePage.locator('.gita-sara-text').evaluateAll((fields) => fields.map((field) => {
      const box = field.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }));
    assert.ok(saraTextBoxes.every((box, index) => index === 0 || box.top >= saraTextBoxes[index - 1].bottom), 'mobile Gita Sara text fields must flow without overlap');
    assert.equal(await mobilePage.locator('.gita-sara-text-panel').evaluate((panel) => panel.scrollHeight <= panel.clientHeight + 1), true, 'mobile Gita Sara text panel must grow to fit its content');
    await mobilePage.keyboard.press('q');
    assert.equal(await mobilePage.locator('[data-sara-panel="questions"]').isHidden(), true, 'mobile Q hides questions without creating a parallel layout');
    const focusedMobileBoxes = await mobilePage.locator('[data-sara-panel="text"], [data-sara-panel="media"]').evaluateAll((panels) => panels.map((panel) => ({ left: panel.getBoundingClientRect().left, top: panel.getBoundingClientRect().top })));
    assert.equal(new Set(focusedMobileBoxes.map(({ left }) => Math.round(left))).size, 1, 'mobile focused panels remain one full-width column');
    assert.ok(focusedMobileBoxes[1].top > focusedMobileBoxes[0].top, 'mobile focused panels retain text-before-media order');
    await mobilePage.goto(`${base}/player.html?play=gita-700&sid=6.7&pid=1`, { waitUntil: 'networkidle' });
    await mobilePage.keyboard.press('m');
    assert.equal(await mobilePage.locator('#questions-button').isHidden(), true, 'Questions stays hidden for renderers that do not yet support it');
    await mobilePage.keyboard.press('m');
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
    await languagePage.getByRole('heading', { name: 'ದಿಕ್ಸೂಚಿ', exact: true }).waitFor();
    await languagePage.getByRole('heading', { name: 'ಅನುಭವವನ್ನು ಆಯ್ಕೆಮಾಡಿ' }).waitFor();
    await languagePage.locator('#gita-700-link').click();
    await languagePage.locator('#experience-detail-action').click();
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
    await filePage.evaluate(() => document.fonts.ready);
    await filePage.evaluate(() => document.fonts.load('16px "Gitaverse Noto Sans"', 'ಶ್ರೀಮದ್ಭಗವದ್ಗೀತೆ'));
    assert.equal(await filePage.evaluate(() => document.fonts.check('16px "Gitaverse Noto Sans"', 'ಶ್ರೀಮದ್ಭಗವದ್ಗೀತೆ')), true, 'file mode must load bundled Noto Sans');
    await createProfile(filePage, 'File Regression');
    await filePage.locator('#home-collections').waitFor({ state: 'visible' });
    assert.equal(await filePage.locator('#home-collections-title').innerText(), 'Local collections');
    await filePage.locator('#home-collections-input').setInputFiles(path.join(root, 'data/collections'));
    await filePage.locator('#sid-label').waitFor();
    assert.equal(await filePage.locator('#sid-label').innerText(), '6.7', 'file-mode direct destination must continue after selecting collections');
    await filePage.keyboard.press('ArrowRight');
    assert.match(await filePage.locator('#audio').getAttribute('src'), /^https:\/\/media\.gitajyoti\.org\/audio\/chanting-swami-brahmananda\/.*\.mp3$/);
    const originalLocalAudio = await filePage.locator('#audio').getAttribute('src');
    await filePage.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('gitaverse-profiles');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('diksoochiEngagement', 'readwrite');
        transaction.objectStore('diksoochiEngagement').put({
          key: '1:gita-700:6.7', pid: 1, experience: 'gita-700', sid: '6.7', chapter: '6',
          firstMeaningfulAt: new Date().toISOString(), lastMeaningfulAt: new Date().toISOString(), meaningfulVisitCount: 1, maxEngagementSeconds: 10
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    }));
    await filePage.keyboard.press('a');
    assert.equal(await filePage.locator('#home-collections-title').innerText(), 'Local collections ready');
    await filePage.getByRole('button', { name: 'Details' }).click();
    await filePage.locator('#journey-table-body tr').first().waitFor();
    assert.equal(await filePage.locator('#journey-table-body .journey-table-row').count(), 1, 'file-mode journey details must reuse the Home collection choice');
    await filePage.getByRole('button', { name: '← Back' }).click();
    await filePage.keyboard.press('e');
    assert.equal(await filePage.locator('#workspace-overlay').isVisible(), false, 'edit shortcut is inactive on Home');
    await filePage.locator('#home-collections-input').setInputFiles(path.join(root, 'data/collections'));
    await filePage.locator('#gita-700-link').click();
    await filePage.locator('#experience-detail-action').click();
    await filePage.locator('#sid-label').waitFor();
    assert.equal(await filePage.locator('#audio').getAttribute('src'), originalLocalAudio, 'reselecting collections must preserve canonical remote media URLs');
    await filePage.keyboard.press('e');
    assert.equal(await filePage.locator('#workspace-overlay').isVisible(), true);
    await fileContext.close();

    assert.deepEqual(errors, [], 'browser console/page errors');
    assert.equal(missingResourceMessages.length, missingIllustrationResponses.length, 'only planned missing illustrations may produce handled 404 responses');
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
