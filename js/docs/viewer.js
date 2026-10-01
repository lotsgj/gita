import { marked } from './vendor/marked.esm.js';
import { ProfileStore } from '../profile-store.js';
import { ProfileUI } from '../profile-ui.js';
import { EventBus } from '../events/event-bus.js';
import { ClarityAdapter } from '../events/clarity-adapter.js';
import { profileAnalyticsContext } from '../events/profile-analytics.js';
import { AboutDialog } from '../shared/about-dialog.js';

const DOCUMENT_ROOT = 'docs/';
const article = document.getElementById('docs-article');
const nav = document.getElementById('docs-nav');
const menuButton = document.getElementById('docs-menu-button');
const scrim = document.getElementById('docs-nav-scrim');
const folderInput = document.getElementById('docs-folder-input');
const appVersion = document.querySelector('meta[name="app-version"]')?.content || 'dev';
const clarityProjectId = document.querySelector('meta[name="clarity-project-id"]')?.content || '';
let manifest;
let entries = [];
let activeRoute = '';
let localFiles = null;
const localObjectUrls = new Map();
let activeProfile = null;

const profileStore = new ProfileStore();
const eventBus = new EventBus({
  appVersion,
  contextProvider: () => ({ surface: 'rachana', documentationPage: activeRoute || 'unavailable', displayMode: matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser' })
});
eventBus.subscribe(new ClarityAdapter({ projectId: clarityProjectId }));

function emitRachanaEvent(name, details = {}) {
  return eventBus.emit(name, {
    profileId: activeProfile?.pid ?? null,
    anonymousProfileId: activeProfile?.analyticsProfileId || null,
    context: activeProfile ? profileAnalyticsContext(activeProfile) : { ageBand: 'missing', genderGroup: 'not_said', profileLanguage: 'none' },
    details
  });
}

const aboutDialog = new AboutDialog({ version: appVersion, onOpen: () => emitRachanaEvent('rachana_about_opened') });

function closeProfileViews() {
  document.getElementById('profile-setup').hidden = true;
  document.getElementById('profile-selection').hidden = true;
  document.getElementById('profile-menu-overlay').hidden = true;
}

function updateProfileContext(profile) {
  activeProfile = profile;
  const target = new URL('player.html', location.href);
  if (profile) target.searchParams.set('pid', profile.pid);
  document.getElementById('docs-gitaverse-link').href = target.href;
  if (profile) profileUI.renderPills(profile);
  else {
    const pill = document.getElementById('docs-profile-pill');
    pill.textContent = 'Create profile';
    pill.removeAttribute('data-pid');
    pill.setAttribute('aria-label', 'Create a Gitaverse profile');
  }
}

async function showProfileForm(profile = null, { focusPreferences = false } = {}) {
  await profileUI.showForm(profile, { focusPreferences });
  document.getElementById('profile-dob').max = new Date().toISOString().slice(0, 10);
  closeProfileViews();
  document.getElementById('profile-setup').hidden = false;
}

async function showProfileSelection() {
  await profileUI.showSelection({ switching: true });
  closeProfileViews();
  document.getElementById('profile-selection').hidden = false;
}

async function selectRachanaProfile(profile) {
  updateProfileContext(profile);
  closeProfileViews();
  emitRachanaEvent('rachana_profile_selected');
}

async function changeRachanaProfile(profile, options = {}) {
  if (options.edit) return showProfileForm(profile);
  if (options.setup) return showProfileForm();
  if (options.deletedPid) {
    if (activeProfile?.pid === options.deletedPid) updateProfileContext(options.remaining[0] || null);
    return showProfileSelection();
  }
  updateProfileContext(profile);
  closeProfileViews();
}

async function createRachanaProfile(profile) {
  updateProfileContext(profile);
  closeProfileViews();
  emitRachanaEvent('rachana_profile_selected', { source: 'created' });
}

const profileUI = new ProfileUI({ store: profileStore, onSelected: selectRachanaProfile, onCreated: createRachanaProfile, onChanged: changeRachanaProfile });

async function initializeProfile() {
  try {
    await profileStore.open();
    const profiles = await profileStore.list();
    const requestedPid = Number(new URLSearchParams(location.search).get('pid'));
    let profile = Number.isInteger(requestedPid) && requestedPid > 0 ? await profileStore.get(requestedPid) : null;
    if (!profile) {
      const defaultPid = await profileStore.defaultPid();
      profile = defaultPid ? await profileStore.get(defaultPid) : profiles[0] || null;
    }
    updateProfileContext(profile);
  } catch (_) {
    updateProfileContext(null);
  }
}

function setNavigationOpen(open) {
  document.body.classList.toggle('docs-nav-open', open);
  menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  menuButton.setAttribute('aria-label', open ? 'Close documentation navigation' : 'Open documentation navigation');
  scrim.hidden = !open;
  if (open) requestAnimationFrame(() => nav.querySelector('.active, a')?.focus());
  if (open) emitRachanaEvent('rachana_navigation_opened');
}

function routeFromLocation() {
  return new URLSearchParams(location.search).get('page') || manifest.defaultPage;
}

function safeText(value) {
  return document.createTextNode(String(value ?? ''));
}

function normalizeSelectedFiles(fileList) {
  const files = new Map();
  for (const file of Array.from(fileList || [])) {
    const original = String(file.webkitRelativePath || file.name).replace(/\\/g, '/').replace(/^\/+/, '');
    const marker = original.indexOf('docs/');
    const relative = marker >= 0 ? original.slice(marker + 'docs/'.length) : original.split('/').slice(1).join('/');
    if (relative) files.set(relative, file);
  }
  return files;
}

async function readDocumentationFile(relative) {
  if (localFiles) {
    const file = localFiles.get(relative);
    if (!file) throw new Error('The selected docs folder is missing ' + relative + '.');
    return file.text();
  }
  const response = await fetch(DOCUMENT_ROOT + relative, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.text();
}

function showFolderChooser(message = '') {
  article.setAttribute('aria-busy', 'false');
  article.textContent = '';
  const card = document.createElement('div');
  card.className = 'docs-error-card';
  const heading = document.createElement('h1');
  heading.textContent = 'Open local Rachana';
  const description = document.createElement('p');
  description.className = message ? 'docs-error' : '';
  description.textContent = message || 'Browsers require you to choose the local docs folder before Rachana can read its Markdown files.';
  const actions = document.createElement('div');
  actions.className = 'docs-folder-actions';
  const choose = document.createElement('label');
  choose.className = 'docs-folder-button';
  choose.htmlFor = 'docs-folder-input';
  choose.textContent = 'Choose docs folder';
  const note = document.createElement('p');
  note.className = 'docs-folder-note';
  note.textContent = 'Choose this repository’s docs folder. Its files remain on this device.';
  actions.append(choose, note);
  card.append(heading, description, actions);
  article.appendChild(card);
  document.title = 'Open local Rachana — Rachana';
}

function buildNavigation() {
  nav.textContent = '';
  manifest.sections.forEach((section) => {
    const wrapper = document.createElement('section');
    wrapper.className = 'docs-nav-section';
    const heading = document.createElement('h2');
    heading.className = 'docs-nav-title';
    heading.appendChild(safeText(section.title));
    const list = document.createElement('ul');
    list.className = 'docs-nav-list';
    section.pages.forEach((page) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'docs-nav-link';
      link.href = '?page=' + encodeURIComponent(page.route);
      link.dataset.route = page.route;
      link.appendChild(safeText(page.title));
      item.appendChild(link);
      list.appendChild(item);
    });
    wrapper.append(heading, list);
    nav.appendChild(wrapper);
  });
}

function escapeDocumentHtml(markdown) {
  return String(markdown).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function safeProtocol(value, { image = false } = {}) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) return true;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !trimmed.startsWith('//')) return true;
  try {
    const url = new URL(trimmed, location.href);
    return ['http:', 'https:'].includes(url.protocol) || (!image && url.protocol === 'mailto:');
  } catch (_) {
    return false;
  }
}

function documentPathFromHref(href, currentPath) {
  if (!href || href.startsWith('#')) return null;
  try {
    const base = new URL(DOCUMENT_ROOT + currentPath, location.href);
    const target = new URL(href, base);
    if (target.origin !== location.origin) return null;
    const root = new URL(DOCUMENT_ROOT, location.href).pathname;
    if (!target.pathname.startsWith(root)) return null;
    return decodeURIComponent(target.pathname.slice(root.length));
  } catch (_) {
    return null;
  }
}

function relativeDocumentPath(value, currentPath) {
  try {
    const base = new URL('https://rachana.local/docs/' + currentPath);
    const target = new URL(value, base);
    if (target.origin !== base.origin || !target.pathname.startsWith('/docs/')) return null;
    return decodeURIComponent(target.pathname.slice('/docs/'.length));
  } catch (_) {
    return null;
  }
}

function localMediaUrl(value, currentPath) {
  const relative = relativeDocumentPath(value, currentPath);
  const file = relative && localFiles?.get(relative);
  if (!file) return null;
  if (!localObjectUrls.has(relative)) localObjectUrls.set(relative, URL.createObjectURL(file));
  return localObjectUrls.get(relative);
}

function sanitizeRenderedMarkdown(html, entry) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowedTags = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'A', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'DEL', 'BLOCKQUOTE', 'PRE', 'CODE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'HR', 'BR', 'IMG']);
  const allowedAttributes = {
    A: new Set(['href', 'title']),
    IMG: new Set(['src', 'alt', 'title']),
    CODE: new Set(['class'])
  };
  Array.from(template.content.querySelectorAll('*')).forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ''));
      return;
    }
    Array.from(element.attributes).forEach((attribute) => {
      if (!allowedAttributes[element.tagName]?.has(attribute.name)) element.removeAttribute(attribute.name);
    });
    if (element.tagName === 'CODE' && element.className && !/^language-[a-z0-9_-]+$/i.test(element.className)) element.removeAttribute('class');
    if (element.tagName === 'A') {
      const href = element.getAttribute('href');
      if (!safeProtocol(href)) {
        element.removeAttribute('href');
        return;
      }
      const internalPath = documentPathFromHref(href, entry.path);
      const internalEntry = entries.find((candidate) => candidate.path === internalPath);
      if (internalEntry) {
        element.href = '?page=' + encodeURIComponent(internalEntry.route);
        element.dataset.route = internalEntry.route;
      } else {
        const target = new URL(href, new URL(DOCUMENT_ROOT + entry.path, location.href));
        if (target.origin !== location.origin) {
          element.target = '_blank';
          element.rel = 'noopener noreferrer';
        }
      }
    }
    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src');
      if (!safeProtocol(src, { image: true })) element.removeAttribute('src');
      else if (localFiles) {
        const objectUrl = localMediaUrl(src, entry.path);
        if (objectUrl) element.src = objectUrl;
        else element.removeAttribute('src');
      } else element.src = new URL(src, new URL(DOCUMENT_ROOT + entry.path, location.href)).href;
    }
  });
  return template.content;
}

function setActiveNavigation(route) {
  nav.querySelectorAll('[data-route]').forEach((link) => {
    const active = link.dataset.route === route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function showDocumentError(title, message) {
  article.setAttribute('aria-busy', 'false');
  article.textContent = '';
  const card = document.createElement('div');
  card.className = 'docs-error-card';
  const heading = document.createElement('h1');
  heading.textContent = title;
  const description = document.createElement('p');
  description.className = 'docs-error';
  description.textContent = message;
  card.append(heading, description);
  article.appendChild(card);
  document.title = title + ' — Rachana';
}

async function loadDocument(route, { historyMode = 'none' } = {}) {
  const entry = entries.find((candidate) => candidate.route === route);
  if (!entry) {
    activeRoute = '';
    setActiveNavigation('');
    showDocumentError('Document not found', 'This Rachana page does not exist or is not listed in its navigation.');
    return;
  }
  article.setAttribute('aria-busy', 'true');
  article.innerHTML = '<p class="docs-loading">Opening ' + entry.title.replace(/[<>&]/g, '') + '…</p>';
  try {
    const markdown = await readDocumentationFile(entry.path);
    const rendered = marked.parse(escapeDocumentHtml(markdown), { async: false, gfm: true, breaks: false });
    article.replaceChildren(sanitizeRenderedMarkdown(rendered, entry));
    article.setAttribute('aria-busy', 'false');
    activeRoute = route;
    setActiveNavigation(route);
    document.title = entry.title + ' — Rachana';
    if (historyMode !== 'none') {
      const next = new URL(location.href);
      next.searchParams.set('page', route);
      history[historyMode + 'State']({ route }, '', next);
    }
    document.getElementById('docs-main').scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    setNavigationOpen(false);
    emitRachanaEvent('rachana_page_viewed', { route });
  } catch (_) {
    emitRachanaEvent('rachana_document_failed', { route });
    showDocumentError('Unable to open this document', 'The Markdown file could not be loaded. Check the connection or try again.');
  }
}

function handleRouteClick(event) {
  const link = event.target.closest('a[data-route]');
  if (!link) return;
  event.preventDefault();
  if (link.dataset.route !== activeRoute) loadDocument(link.dataset.route, { historyMode: 'push' });
  else setNavigationOpen(false);
}

async function initialize() {
  if (location.protocol === 'file:' && !localFiles) {
    showFolderChooser();
    return;
  }
  try {
    manifest = JSON.parse(await readDocumentationFile('navigation.json'));
    entries = manifest.sections.flatMap((section) => section.pages);
    buildNavigation();
    await loadDocument(routeFromLocation());
    emitRachanaEvent('rachana_opened');
  } catch (_) {
    emitRachanaEvent('rachana_document_failed', { route: 'navigation' });
    showDocumentError('Unable to open Rachana', 'The documentation navigation could not be loaded.');
  }
}

folderInput.addEventListener('change', async (event) => {
  localFiles = normalizeSelectedFiles(event.target.files);
  if (!localFiles.has('navigation.json')) {
    localFiles = null;
    folderInput.value = '';
    showFolderChooser('The selected folder does not contain docs/navigation.json. Choose the repository’s docs folder.');
    return;
  }
  await initialize();
});

menuButton.addEventListener('click', () => setNavigationOpen(!document.body.classList.contains('docs-nav-open')));
document.getElementById('docs-about-button').addEventListener('click', (event) => aboutDialog.open(event.currentTarget));
document.getElementById('docs-gitaverse-link').addEventListener('click', () => emitRachanaEvent('rachana_gitaverse_opened'));
document.getElementById('docs-profile-pill').addEventListener('click', () => {
  if (!activeProfile) return showProfileForm();
  document.getElementById('profile-menu-overlay').hidden = false;
});
document.getElementById('profile-preferences-button').addEventListener('click', () => showProfileForm(activeProfile, { focusPreferences: true }));
document.getElementById('switch-manage-profiles-button').addEventListener('click', showProfileSelection);
document.getElementById('edit-profile-button').addEventListener('click', () => showProfileForm(activeProfile));
document.getElementById('add-profile-button').addEventListener('click', () => showProfileForm());
document.getElementById('profile-selection-back').addEventListener('click', closeProfileViews);
document.getElementById('profile-form-cancel').addEventListener('click', closeProfileViews);
document.querySelectorAll('.docs-overlay-close').forEach((button) => button.addEventListener('click', closeProfileViews));
document.getElementById('profile-menu-overlay').addEventListener('click', (event) => { if (event.target.id === 'profile-menu-overlay') closeProfileViews(); });
scrim.addEventListener('click', () => setNavigationOpen(false));
nav.addEventListener('click', handleRouteClick);
article.addEventListener('click', handleRouteClick);
window.addEventListener('popstate', () => loadDocument(routeFromLocation()));
window.addEventListener('resize', () => { if (innerWidth > 760) setNavigationOpen(false); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && aboutDialog.close()) {
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape' && (!document.getElementById('profile-menu-overlay').hidden || !document.getElementById('profile-setup').hidden || !document.getElementById('profile-selection').hidden)) {
    event.preventDefault();
    closeProfileViews();
    return;
  }
  if (event.key === 'Escape' && document.body.classList.contains('docs-nav-open')) {
    event.preventDefault();
    setNavigationOpen(false);
    menuButton.focus();
  }
});

initializeProfile().then(initialize);
