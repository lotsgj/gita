import { MASTER_URL, loadMaster, readMasterFile, value } from './master-data.js';
import { ProfileStore } from './profile-store.js';
import { ProfileUI } from './profile-ui.js';
import { PwaManager } from './pwa.js';
import { AudioPlayer } from './audio-player.js';
import { InlineEditor } from './editor.js';
import { getExperience } from './renderers/registry.js';

const state = {
  dataset: null,
  index: 0,
  language: 'en',
  renderer: null,
  editor: null,
  eventsBound: false,
  overlayOpener: null,
  downloadReminderDismissed: false,
  lastSavedRevision: 0,
  activeProfile: null,
  profileSelectionMode: 'initial',
  profileReturnView: 'chooser',
  appMetadata: { version: 'dev' }
};

const params = new URLSearchParams(location.search);
let play = params.get('play');
let requestedSid = params.get('sid');
let requestedLanguage = params.get('lang');
const appVersion = document.querySelector('meta[name="app-version"]')?.content || 'dev';

const profileStore = new ProfileStore();
const pwa = new PwaManager({ appVersion });
const profileUI = new ProfileUI({
  store: profileStore,
  onSelected: selectProfile,
  onCreated: createProfile,
  onChanged: handleProfileChange
});

const audioPlayer = new AudioPlayer({
  audio: document.getElementById('audio'),
  playButton: document.getElementById('play-button'),
  playIcon: document.getElementById('play-icon'),
  pauseIcon: document.getElementById('pause-icon'),
  seek: document.getElementById('audio-seek'),
  time: document.getElementById('audio-time'),
  onError: () => pwa.showStatus(navigator.onLine ? 'Audio is currently unavailable.' : 'This audio is not available offline yet.')
});

const swipe = { active: false, x: 0, y: 0, startedAt: 0 };

function showOnly(id) {
  ['profile-setup', 'profile-selection', 'chooser', 'loading', 'error', 'data-chooser', 'app'].forEach((name) => {
    document.getElementById(name).hidden = name !== id;
  });
}

function visibleView() {
  return ['profile-selection', 'chooser', 'loading', 'error', 'data-chooser', 'app'].find((id) => !document.getElementById(id).hidden) || 'chooser';
}

function updateProfileUrl(profile) {
  const next = new URL(location.href);
  next.searchParams.set('pid', profile.pid);
  history.replaceState(null, '', next);
}

async function activateProfile(profile) {
  state.activeProfile = profile;
  updateProfileUrl(profile);
  await profileUI.renderPills(profile);
}

async function selectProfile(profile) {
  await activateProfile(profile);
  if (state.profileSelectionMode === 'initial') {
    startRequestedExperience();
  } else {
    goToExperienceSelection(profile);
  }
}

async function createProfile(profile) {
  await activateProfile(profile);
  goToExperienceSelection(profile);
}

async function handleProfileChange(profile, options = {}) {
  if (options.edit) return openProfileForm(profile);
  if (options.setup) return openProfileForm();
  if (options.deletedPid) {
    if (state.activeProfile?.pid === options.deletedPid) await activateProfile(options.remaining[0]);
    await profileUI.showSelection({ switching: true });
    return showOnly('profile-selection');
  }
  if (!profile) return;
  await activateProfile(profile);
  if (state.profileReturnView === 'profile-selection') {
    await profileUI.showSelection({ switching: true });
    return showOnly('profile-selection');
  }
  showOnly(state.profileReturnView === 'app' && state.dataset ? 'app' : 'chooser');
  if (state.dataset && state.profileReturnView === 'app') {
    state.language = requestedLanguage === 'kn' || requestedLanguage === 'en' ? requestedLanguage : profile.language;
    render();
  }
}

function goToExperienceSelection(profile = state.activeProfile) {
  play = null;
  requestedSid = null;
  requestedLanguage = profile?.language || 'en';
  const home = new URL(location.href);
  home.searchParams.delete('play');
  home.searchParams.delete('sid');
  if (requestedLanguage === 'kn') home.searchParams.set('lang', 'kn');
  else home.searchParams.delete('lang');
  if (profile) home.searchParams.set('pid', profile.pid);
  history.replaceState(null, '', home);
  startRequestedExperience();
}

async function openProfileForm(profile = null) {
  state.profileReturnView = visibleView();
  closeOverlays({ restoreFocus: false });
  await profileUI.showForm(profile);
  document.getElementById('profile-dob').max = new Date().toISOString().slice(0, 10);
  showOnly('profile-setup');
}

async function openProfileSelection({ switching = true } = {}) {
  state.profileReturnView = visibleView();
  state.profileSelectionMode = switching ? 'switch' : 'initial';
  closeOverlays({ restoreFocus: false });
  await profileUI.showSelection({ switching });
  showOnly('profile-selection');
}

async function initializeProfiles() {
  try {
    await profileStore.open();
    const profiles = await profileStore.list();
    if (!profiles.length) return openProfileForm();
    const requestedPid = Number(params.get('pid'));
    let profile = Number.isInteger(requestedPid) && requestedPid > 0 ? await profileStore.get(requestedPid) : null;
    if (!profile) {
      const defaultPid = await profileStore.defaultPid();
      profile = defaultPid ? await profileStore.get(defaultPid) : null;
    }
    if (!profile) return openProfileSelection({ switching: false });
    await activateProfile(profile);
    startRequestedExperience();
  } catch (error) {
    showError('Local profile storage is unavailable. Gitaverse requires browser storage to keep profiles on this device. ' + (error.message || ''));
  }
}

async function checkPlayerVersion() {
  try {
    const response = await fetch('data/app-version.json?check=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) return true;
    const latest = await response.json();
    state.appMetadata = latest;
    document.getElementById('about-version').textContent = latest.version || appVersion;
    if (latest.version && appVersion !== latest.version && !navigator.serviceWorker?.controller) {
      const refreshed = new URL(location.href);
      refreshed.searchParams.set('v', latest.version);
      location.replace(refreshed.href);
      return false;
    }
  } catch (_) {
    return true;
  }
  return true;
}

async function startRequestedExperience() {
  const chooserLink = document.getElementById('gita-700-link');
  const chooserUrl = new URL(location.href);
  chooserUrl.searchParams.set('play', 'gita-700');
  chooserUrl.searchParams.delete('sid');
  chooserUrl.searchParams.set('pid', state.activeProfile.pid);
  const chooserLanguage = requestedLanguage === 'kn' || requestedLanguage === 'en' ? requestedLanguage : state.activeProfile.language;
  if (chooserLanguage === 'kn') chooserUrl.searchParams.set('lang', 'kn');
  else chooserUrl.searchParams.delete('lang');
  chooserLink.href = chooserUrl.href;
  if (!play) return showOnly('chooser');

  const experience = getExperience(play);
  if (!experience || !experience.available) {
    return showError('The requested experience is not available yet. Use ?play=gita-700.');
  }

  showOnly('loading');
  try {
    const masterUrl = MASTER_URL + '?v=' + encodeURIComponent(appVersion);
    await startPlayer(await loadMaster(masterUrl), experience);
  } catch (error) {
    showDataChooser(error.message);
  }
}

async function startPlayer(dataset, experience) {
  if (state.editor) state.editor.destroy();
  if (state.renderer) state.renderer.destroy();
  state.dataset = dataset;
  state.language = requestedLanguage === 'kn' || requestedLanguage === 'en' ? requestedLanguage : state.activeProfile.language;
  state.renderer = await experience.load();
  state.renderer.mount(document.getElementById('renderer-root'));

  const requestedIndex = requestedSid ? findSid(requestedSid) : -1;
  const defaultIndex = findSid('1.B');
  state.index = requestedIndex >= 0 ? requestedIndex : (defaultIndex >= 0 ? defaultIndex : 0);

  state.editor = new InlineEditor({
    dataset: state.dataset,
    renderer: state.renderer,
    currentRow,
    rerender: render,
    onStateChange: ({ active, savedChanges, pendingDownload, savedRevision }) => {
      document.querySelector('#edit-button .top-menu-label').textContent = active ? 'Leave edit mode' : 'Edit this shloka';
      if (savedRevision > state.lastSavedRevision) {
        state.lastSavedRevision = savedRevision;
        state.downloadReminderDismissed = false;
      }
      const reminder = document.getElementById('download-reminder');
      reminder.hidden = !savedChanges || state.downloadReminderDismissed;
      const action = document.getElementById('download-reminder-action');
      action.textContent = pendingDownload ? '↓ Download edited master.csv' : '↓ Download again';
    }
  });

  bindEvents();
  buildChapterList();
  showOnly('app');
  render();
}

function showDataChooser(message) {
  showOnly('data-chooser');
  document.getElementById('file-error').textContent = message || '';
  document.getElementById('master-file-input').value = '';
}

function showError(message) {
  showOnly('error');
  document.getElementById('error-message').textContent = message;
}

function currentRow() {
  return state.dataset && state.dataset.rows[state.index];
}

function findSid(sid) {
  const target = String(sid || '').trim().toUpperCase();
  return state.dataset.rows.findIndex((row) => String(row.sid).toUpperCase() === target);
}

function chapterNameFor(cid, language) {
  const field = 'cname_' + language;
  const row = state.dataset.rows.find((candidate) => candidate.cid === cid && candidate[field]);
  return row ? row[field] : '';
}

function chapterIconFor(cid) {
  const row = state.dataset.rows.find((candidate) => candidate.cid === cid && candidate.icon_gita_700);
  return row ? row.icon_gita_700 : '';
}

function audioSource(row) {
  const explicit = value(row, [state.renderer.audioField]);
  if (explicit) return new URL(explicit, location.href).href;
  if (play === 'gita-700' && /^\d+$/.test(row.cid) && /^\d+$/.test(row.snum)) {
    const chapter = String(row.cid).padStart(2, '0');
    const shloka = String(row.snum).padStart(3, '0');
    return new URL('data/gita-700/audio/sn/chapter-' + chapter + '/' + chapter + '-' + shloka + '.mp3', location.href).href;
  }
  return '';
}

function render(options = {}) {
  const row = currentRow();
  if (!row) return;
  audioPlayer.setSource(audioSource(row));
  const chapterName = chapterNameFor(row.cid, state.language);
  document.getElementById('chapter-title').textContent = row.cid === 'D'
    ? 'D — Dhyana'
    : row.cid + (chapterName ? ' — ' + chapterName : '');
  const chapterIcon = document.getElementById('chapter-icon');
  const iconPath = chapterIconFor(row.cid);
  chapterIcon.hidden = !iconPath;
  if (iconPath) chapterIcon.src = new URL(iconPath, location.href).href;
  else chapterIcon.removeAttribute('src');
  document.getElementById('sid-label').textContent = row.sid;
  document.getElementById('position-label').textContent = (state.index + 1) + ' / ' + state.dataset.rows.length;
  document.querySelector('#language-button .top-menu-label').textContent = state.language === 'kn'
    ? 'Language (ಕನ್ನಡ)'
    : 'Language (Eng)';
  document.documentElement.lang = state.language;
  state.renderer.render(row, state.language);
  if (options.keepEditing && state.editor.active) state.renderer.setEditing(true);
  updateUrl();
  updateChapterSelection();
}

function updateUrl() {
  const next = new URL(location.href);
  next.searchParams.set('play', play);
  next.searchParams.set('sid', currentRow().sid);
  if (state.language === 'kn') next.searchParams.set('lang', 'kn');
  else next.searchParams.delete('lang');
  history.replaceState(null, '', next);
}

function navigate(offset) {
  if (!state.editor.canNavigate()) return;
  const next = state.index + offset;
  if (next < 0 || next >= state.dataset.rows.length) return;
  state.index = next;
  render();
  if (matchMedia('(max-width: 760px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function swipeIsBlocked(target) {
  return state.editor.active
    || !document.getElementById('top-menu').hidden
    || Boolean(document.querySelector('.overlay:not([hidden])'))
    || Boolean(target.closest('button, input, select, textarea, a, [contenteditable="true"], .controlbar, .edit-toolbar, .download-reminder'));
}

function beginSwipe(event) {
  swipe.active = event.touches.length === 1 && !swipeIsBlocked(event.target);
  if (!swipe.active) return;
  swipe.x = event.touches[0].clientX;
  swipe.y = event.touches[0].clientY;
  swipe.startedAt = Date.now();
}

function finishSwipe(event) {
  if (!swipe.active || event.changedTouches.length !== 1) return;
  swipe.active = false;
  const deltaX = event.changedTouches[0].clientX - swipe.x;
  const deltaY = event.changedTouches[0].clientY - swipe.y;
  if (Date.now() - swipe.startedAt > 1200) return;
  if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
  navigate(deltaX < 0 ? 1 : -1);
}

function setLanguage(language) {
  if (!state.editor.canNavigate()) return;
  state.language = language === 'kn' ? 'kn' : 'en';
  requestedLanguage = state.language;
  state.activeProfile.language = state.language;
  profileStore.save(state.activeProfile).then((profile) => {
    state.activeProfile = profile;
    profileUI.renderPills(profile);
  }).catch(() => {});
  render();
}

function openOverlay(id) {
  if (state.editor?.active) return;
  state.overlayOpener = document.getElementById('top-menu').contains(document.activeElement)
    ? document.getElementById('menu-button')
    : document.activeElement;
  setMenuOpen(false);
  document.getElementById(id).hidden = false;
  if (id === 'goto-overlay') {
    document.getElementById('goto-input').value = currentRow().sid;
    document.getElementById('goto-error').textContent = '';
    requestAnimationFrame(() => document.getElementById('goto-input').select());
  } else if (id === 'chapters-overlay') {
    requestAnimationFrame(() => {
      const current = document.querySelector('.chapter-button.active');
      (current || document.querySelector('.chapter-button'))?.focus();
    });
  } else if (id === 'language-overlay') {
    document.querySelectorAll('.language-option').forEach((button) => {
      button.classList.toggle('active', button.dataset.language === state.language);
      button.setAttribute('aria-pressed', button.dataset.language === state.language ? 'true' : 'false');
    });
    requestAnimationFrame(() => document.querySelector('.language-option.active')?.focus());
  }
}

function closeOverlays({ restoreFocus = true } = {}) {
  let closed = false;
  ['goto-overlay', 'chapters-overlay', 'language-overlay', 'help-overlay', 'profile-menu-overlay', 'about-overlay'].forEach((id) => {
    const overlay = document.getElementById(id);
    if (!overlay.hidden) { overlay.hidden = true; closed = true; }
  });
  if (closed && restoreFocus && state.overlayOpener && document.contains(state.overlayOpener)) state.overlayOpener.focus();
  if (closed) state.overlayOpener = null;
  return closed;
}

function setMenuOpen(open) {
  const menu = document.getElementById('top-menu');
  const button = document.getElementById('menu-button');
  menu.hidden = !open;
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (open) requestAnimationFrame(() => menuOptions()[0]?.focus());
  else if (menu.contains(document.activeElement)) button.focus();
}

function toggleMenu() {
  setMenuOpen(document.getElementById('top-menu').hidden);
}

function menuOptions() {
  return Array.from(document.querySelectorAll('#top-menu .top-menu-item:not([hidden])'));
}

function moveMenuFocus(offset) {
  const options = menuOptions();
  if (!options.length) return;
  const current = options.indexOf(document.activeElement);
  options[(current + offset + options.length) % options.length].focus();
}

function selectChapterButton(button) {
  if (!button || !state.editor.canNavigate()) return;
  state.index = Number(button.dataset.index);
  closeOverlays({ restoreFocus: false });
  render();
  document.getElementById('chapter-trigger').focus();
}

function moveChapterFocus(key) {
  const buttons = Array.from(document.querySelectorAll('.chapter-button'));
  const current = Math.max(0, buttons.indexOf(document.activeElement));
  const columns = Math.max(1, getComputedStyle(document.getElementById('chapter-list')).gridTemplateColumns.split(' ').length);
  let next = current;
  if (key === 'ArrowLeft') next = Math.max(0, current - 1);
  else if (key === 'ArrowRight') next = Math.min(buttons.length - 1, current + 1);
  else if (key === 'ArrowUp') next = Math.max(0, current - columns);
  else if (key === 'ArrowDown') next = Math.min(buttons.length - 1, current + columns);
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = buttons.length - 1;
  buttons[next]?.focus();
}

function chooseLanguage(language) {
  closeOverlays();
  setLanguage(language);
}

function goHome() {
  setMenuOpen(false);
  if (!state.editor.canNavigate()) return;
  if (state.editor.pendingDownload && !window.confirm('Changes have not been downloaded. Are you sure you want to return Home?')) return;
  goToExperienceSelection();
}

function goToSid(sid) {
  if (!state.editor.canNavigate()) return false;
  const found = findSid(sid);
  if (found < 0) return false;
  state.index = found;
  closeOverlays();
  render();
  return true;
}

function buildChapterList() {
  const chapters = [];
  state.dataset.rows.forEach((row, index) => {
    if (!chapters.some((chapter) => chapter.cid === row.cid)) {
      chapters.push({ cid: row.cid, index, en: chapterNameFor(row.cid, 'en'), kn: chapterNameFor(row.cid, 'kn'), sa: chapterNameFor(row.cid, 'sa') });
    }
  });
  const list = document.getElementById('chapter-list');
  list.textContent = '';
  chapters.forEach((chapter) => {
    const beginning = state.dataset.rows.findIndex((row) => row.cid === chapter.cid && String(row.snum).toUpperCase() === 'B');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.dataset.cid = chapter.cid;
    button.dataset.index = beginning >= 0 ? beginning : chapter.index;
    const iconPath = chapterIconFor(chapter.cid);
    if (iconPath) {
      const icon = document.createElement('img');
      icon.className = 'chapter-list-icon';
      icon.src = new URL(iconPath, location.href).href;
      icon.alt = '';
      button.appendChild(icon);
    }
    const number = document.createElement('span');
    number.className = 'chapter-number';
    number.textContent = chapter.cid === 'D' ? 'ॐ' : chapter.cid;
    const name = document.createElement('span');
    name.className = 'chapter-name';
    name.dataset.en = chapter.en || chapter.sa || 'Chapter ' + chapter.cid;
    name.dataset.kn = chapter.kn || chapter.en || chapter.sa || 'Chapter ' + chapter.cid;
    button.append(number, name);
    list.appendChild(button);
  });
}

function updateChapterSelection() {
  document.querySelectorAll('.chapter-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.cid === currentRow().cid);
    const name = button.querySelector('.chapter-name');
    name.textContent = state.language === 'kn' ? name.dataset.kn : name.dataset.en;
  });
}

function updateDeviceLayout() {
  const mobile = matchMedia('(hover: none) and (pointer: coarse)').matches || matchMedia('(max-width: 760px)').matches;
  document.documentElement.classList.toggle('mobile-layout', mobile);
  if (!mobile && document.documentElement.classList.contains('immersive')) {
    document.documentElement.classList.remove('immersive');
  }
  syncFullscreenUi();
}

function syncFullscreenUi() {
  const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement)
    || document.documentElement.classList.contains('immersive');
  document.querySelector('#fullscreen-button .top-menu-label').textContent = active ? 'Exit fullscreen' : 'Fullscreen';
  const button = document.getElementById('footer-fullscreen-button');
  button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  button.title = (active ? 'Exit fullscreen' : 'Fullscreen') + ' (F)';
  button.querySelector('.fullscreen-enter-icon').toggleAttribute('hidden', active);
  button.querySelector('.fullscreen-exit-icon').toggleAttribute('hidden', !active);
}

function handleFullscreenChange() {
  syncFullscreenUi();
  requestAnimationFrame(() => state.renderer?.fitText());
}

async function toggleFullscreen() {
  setMenuOpen(false);
  const root = document.documentElement;
  const activeNative = document.fullscreenElement || document.webkitFullscreenElement;
  if (activeNative) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) await Promise.resolve(exit.call(document)).catch(() => {});
    handleFullscreenChange();
    return;
  }
  if (root.classList.contains('immersive')) {
    root.classList.remove('immersive');
    syncFullscreenUi();
    requestAnimationFrame(() => state.renderer?.fitText());
    return;
  }
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (request) {
    try {
      await Promise.resolve(request.call(root));
      handleFullscreenChange();
      return;
    } catch (_) {
      // Fall through to the application-managed fallback.
    }
  }
  root.classList.add('immersive');
  syncFullscreenUi();
  requestAnimationFrame(() => state.renderer?.fitText());
}

function bindEvents() {
  if (state.eventsBound) return;
  state.eventsBound = true;
  document.getElementById('master-file-input').addEventListener('change', async (event) => {
    try {
      const dataset = await readMasterFile(event.target.files && event.target.files[0]);
      const experience = getExperience(play);
      await startPlayer(dataset, experience);
    } catch (error) {
      showDataChooser(error.message || 'The selected file could not be read.');
    }
  });
  document.getElementById('retry-data-button').addEventListener('click', startRequestedExperience);
  updateDeviceLayout();
  document.getElementById('menu-button').addEventListener('click', (event) => { event.stopPropagation(); toggleMenu(); });
  document.getElementById('chapter-trigger').addEventListener('click', () => openOverlay('chapters-overlay'));
  document.getElementById('goto-button').addEventListener('click', () => openOverlay('goto-overlay'));
  document.getElementById('footer-goto-button').addEventListener('click', () => openOverlay('goto-overlay'));
  document.getElementById('chapters-button').addEventListener('click', () => openOverlay('chapters-overlay'));
  document.getElementById('help-button').addEventListener('click', () => openOverlay('help-overlay'));
  document.getElementById('about-button').addEventListener('click', () => openOverlay('about-overlay'));
  document.querySelectorAll('[data-about]').forEach((button) => button.addEventListener('click', () => openOverlay('about-overlay')));
  document.getElementById('language-button').addEventListener('click', () => openOverlay('language-overlay'));
  document.getElementById('home-button').addEventListener('click', goHome);
  document.querySelectorAll('[data-profile-pill]').forEach((button) => button.addEventListener('click', () => openOverlay('profile-menu-overlay')));
  document.getElementById('switch-profile-button').addEventListener('click', () => openProfileSelection());
  document.getElementById('manage-profiles-button').addEventListener('click', () => openProfileSelection());
  document.getElementById('edit-profile-button').addEventListener('click', () => openProfileForm(state.activeProfile));
  document.getElementById('add-profile-button').addEventListener('click', () => openProfileForm());
  document.getElementById('profile-selection-back').addEventListener('click', () => {
    showOnly(state.profileReturnView === 'app' && state.dataset ? 'app' : 'chooser');
  });
  document.getElementById('profile-form-cancel').addEventListener('click', () => {
    showOnly(state.profileReturnView === 'app' && state.dataset ? 'app' : (state.profileReturnView === 'profile-selection' ? 'profile-selection' : 'chooser'));
  });
  document.getElementById('edit-button').addEventListener('click', () => { setMenuOpen(false); state.editor.toggle(); });
  document.getElementById('download-reminder-action').addEventListener('click', () => state.editor.download());
  document.getElementById('download-reminder-close').addEventListener('click', () => {
    if (state.editor.pendingDownload && !window.confirm('Changes have not been downloaded. Are you sure you want to dismiss this reminder?')) return;
    state.downloadReminderDismissed = true;
    document.getElementById('download-reminder').hidden = true;
  });
  document.getElementById('fullscreen-button').addEventListener('click', toggleFullscreen);
  document.getElementById('footer-fullscreen-button').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.getElementById('language-options').addEventListener('click', (event) => {
    const option = event.target.closest('.language-option');
    if (option) chooseLanguage(option.dataset.language);
  });
  document.addEventListener('click', (event) => { if (!event.target.closest('.top-menu-wrap')) setMenuOpen(false); });
  document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', closeOverlays));
  document.querySelectorAll('.overlay').forEach((overlay) => overlay.addEventListener('click', (event) => { if (event.target === overlay) closeOverlays(); }));
  document.getElementById('goto-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!goToSid(document.getElementById('goto-input').value)) document.getElementById('goto-error').textContent = 'That shloka ID was not found.';
  });
  document.getElementById('chapter-list').addEventListener('click', (event) => {
    const button = event.target.closest('.chapter-button');
    selectChapterButton(button);
  });
  const rendererRoot = document.getElementById('renderer-root');
  rendererRoot.addEventListener('touchstart', beginSwipe, { passive: true });
  rendererRoot.addEventListener('touchend', finishSwipe, { passive: true });
  rendererRoot.addEventListener('touchcancel', () => { swipe.active = false; }, { passive: true });
  window.addEventListener('resize', () => {
    updateDeviceLayout();
    if (state.renderer) state.renderer.fitText();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && closeOverlays()) {
      event.preventDefault();
      return;
    }
    if (!state.dataset) return;
    const active = document.activeElement;
    const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && state.editor.active) {
      event.preventDefault(); state.editor.save(); return;
    }
    if (event.key === 'Escape') {
      if (closeOverlays()) event.preventDefault();
      else if (!document.getElementById('top-menu').hidden) { setMenuOpen(false); event.preventDefault(); }
      else if (state.editor.active) { event.preventDefault(); state.editor.cancel(); }
      else if (document.documentElement.classList.contains('immersive')) {
        document.documentElement.classList.remove('immersive');
        syncFullscreenUi();
        event.preventDefault();
      }
      return;
    }
    const menu = document.getElementById('top-menu');
    if (!menu.hidden && menu.contains(active)) {
      const menuKey = event.key.toLowerCase();
      if (menuKey === 'm') {
        event.preventDefault(); setMenuOpen(false);
      } else if (menuKey === 'c') {
        event.preventDefault(); openOverlay('chapters-overlay');
      } else if (menuKey === 'l') {
        event.preventDefault(); openOverlay('language-overlay');
      } else if (menuKey === 'a') {
        event.preventDefault(); goHome();
      } else if (menuKey === 'k') {
        event.preventDefault(); openOverlay('about-overlay');
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault(); moveMenuFocus(event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Enter' && active.tagName !== 'SELECT') {
        event.preventDefault(); active.click();
      }
      return;
    }
    const chaptersOverlay = document.getElementById('chapters-overlay');
    if (!chaptersOverlay.hidden) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); moveChapterFocus(event.key);
      } else if (event.key === 'Enter' && active.classList.contains('chapter-button')) {
        event.preventDefault(); selectChapterButton(active);
      }
      return;
    }
    const languageOverlay = document.getElementById('language-overlay');
    if (!languageOverlay.hidden) {
      const options = Array.from(document.querySelectorAll('.language-option'));
      const current = Math.max(0, options.indexOf(active));
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault(); options[(current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus();
      } else if (event.key === 'Enter' && active.classList.contains('language-option')) {
        event.preventDefault(); chooseLanguage(active.dataset.language);
      }
      return;
    }
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
    else if (event.key === ' ' || key === 'p') { event.preventDefault(); audioPlayer.toggle(); }
    else if (key === 'g') { event.preventDefault(); openOverlay('goto-overlay'); }
    else if (key === 'c') { event.preventDefault(); openOverlay('chapters-overlay'); }
    else if (key === 'l') { event.preventDefault(); openOverlay('language-overlay'); }
    else if (key === 'a') { event.preventDefault(); goHome(); }
    else if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
    else if (key === 'h') { event.preventDefault(); openOverlay('help-overlay'); }
    else if (key === 'k') { event.preventDefault(); openOverlay('about-overlay'); }
    else if (key === 'm') { event.preventDefault(); toggleMenu(); }
    else if (key === 'e') { event.preventDefault(); state.editor.toggle(); }
  });
}

bindEvents();
pwa.start();
checkPlayerVersion().then((current) => { if (current) initializeProfiles(); });
