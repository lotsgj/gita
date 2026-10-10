import { openWritableCollectionWorkspace } from './collection-data.js';
import { CollectionSource, CollectionSourceRequiredError } from './collection-source.js';
import { ProfileStore } from '../profile-store.js';
import { ProfileUI } from '../profile-ui.js';
import { EventBus } from '../events/event-bus.js';
import { ResumeAdapter } from '../events/resume-adapter.js';
import { DiksoochiAdapter } from '../events/diksoochi-adapter.js';
import { ClarityAdapter } from '../events/clarity-adapter.js';
import { SentryAdapter } from '../events/sentry-adapter.js';
import { profileAnalyticsContext } from '../events/profile-analytics.js';
import { PwaManager } from '../pwa.js';
import { AudioPlayer } from './audio-player.js';
import { InlineEditor } from './editor.js';
import { getExperience } from './renderers/registry.js';
import { AboutDialog } from '../shared/about-dialog.js';
import { I18n } from '../i18n/i18n.js';
import { VersionHistoryStore } from '../version-history.js';

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
  profileReturnView: 'diksoochi',
  locationSource: null,
  experienceResumes: new Map(),
  journeyDataset: null,
  journeyView: null,
  expandedJourneySid: null,
  focusedJourneySid: null,
  journeyReturnView: 'diksoochi',
  journeyReturnFocus: 'journey-details-button',
  pendingLocalDestination: null,
  appMetadata: { version: 'dev' }
};

const params = new URLSearchParams(location.search);
let play = params.get('play');
let requestedSid = params.get('sid');
let requestedLanguage = params.get('lang');
const explicitLocationRequested = params.has('play') || params.has('sid') || params.has('lang');
const appVersion = document.querySelector('meta[name="app-version"]')?.content || 'dev';
const clarityProjectId = document.querySelector('meta[name="clarity-project-id"]')?.content || '';
const collectionSource = new CollectionSource({ version: appVersion });
const i18n = new I18n('en');
const translate = (key, fallback, values = {}) => i18n.t(key, values) === key ? fallback : i18n.t(key, values);

const profileStore = new ProfileStore();
const versionHistoryStore = new VersionHistoryStore();
const eventBus = new EventBus({
  appVersion,
  contextProvider: () => ({
    online: navigator.onLine,
    displayMode: matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
  })
});
eventBus.subscribe(new ResumeAdapter({ store: profileStore }));
eventBus.subscribe(new DiksoochiAdapter({ store: profileStore }));
const clarityAdapter = new ClarityAdapter({ projectId: clarityProjectId });
eventBus.subscribe(clarityAdapter);
eventBus.subscribe(new SentryAdapter());
clarityAdapter.initialize({ appVersion, displayMode: matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser' });
const pwa = new PwaManager({
  appVersion,
  onEvent: (name, details) => emitEvent(name, { details, profile: state.activeProfile }),
  onInstalled: (version) => versionHistoryStore.recordInstalled(version)
});
const aboutDialog = new AboutDialog({ version: appVersion, translate, historyStore: versionHistoryStore });
const profileUI = new ProfileUI({
  store: profileStore,
  onSelected: selectProfile,
  onCreated: createProfile,
  onChanged: handleProfileChange,
  translate,
  onInterfaceLanguagePreview: setInterfaceLanguage
});

function setInterfaceLanguage(language) {
  i18n.setLanguage(language);
  aboutDialog.refresh();
  if (state.dataset && state.renderer) {
    render({ trackLocation: false, keepEditing: Boolean(state.editor?.active) });
    syncFullscreenUi();
  }
}

const audioPlayer = new AudioPlayer({
  audio: document.getElementById('audio'),
  playButton: document.getElementById('play-button'),
  playIcon: document.getElementById('play-icon'),
  pauseIcon: document.getElementById('pause-icon'),
  seek: document.getElementById('audio-seek'),
  time: document.getElementById('audio-time'),
  onError: () => pwa.showStatus(navigator.onLine ? i18n.t('audio.onlineError') : i18n.t('audio.offlineError')),
  onEvent: (name) => emitEvent(name, { context: verseContext() }),
  translate
});

const swipe = { active: false, x: 0, y: 0, startedAt: 0 };
let engagementTimer = null;

function verseContext(row = currentRow()) {
  if (!row) return {};
  return { experience: play, sid: row.sid, chapter: row.cid, language: state.language };
}

function emitEvent(name, { context = {}, details = {}, profile = state.activeProfile } = {}) {
  return eventBus.emit(name, {
    profileId: profile?.pid ?? null,
    anonymousProfileId: profile?.analyticsProfileId || null,
    context: { ...profileAnalyticsContext(profile), ...context },
    details
  });
}

function showOnly(id) {
  ['profile-setup', 'profile-selection', 'diksoochi', 'journey-details', 'loading', 'error', 'data-chooser', 'app'].forEach((name) => {
    document.getElementById(name).hidden = name !== id;
  });
}

function visibleView() {
  return ['profile-selection', 'diksoochi', 'journey-details', 'loading', 'error', 'data-chooser', 'app'].find((id) => !document.getElementById(id).hidden) || 'diksoochi';
}

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim() || '—';
}

function setJourneyView(view, { save = true } = {}) {
  state.journeyView = view === 'cards' ? 'cards' : 'table';
  document.getElementById('journey-cards').hidden = state.journeyView !== 'cards';
  document.getElementById('journey-table-wrap').hidden = state.journeyView !== 'table';
  document.querySelectorAll('[data-journey-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.journeyView === state.journeyView));
  });
  syncJourneyInteraction();
  if (save && state.activeProfile) profileStore.setJourneyView(state.activeProfile.pid, state.journeyView);
}

function journeyItems() {
  const selector = state.journeyView === 'cards' ? '#journey-cards .journey-card' : '#journey-table-body .journey-table-row';
  return Array.from(document.querySelectorAll(selector));
}

function syncJourneyInteraction({ focus = false } = {}) {
  const items = journeyItems();
  if (!items.length) return;
  if (!items.some((item) => item.dataset.journeySid === state.focusedJourneySid)) state.focusedJourneySid = items[0].dataset.journeySid;
  document.querySelectorAll('[data-journey-sid]').forEach((item) => {
    const expanded = item.dataset.journeySid === state.expandedJourneySid;
    item.setAttribute('aria-expanded', String(expanded));
    item.tabIndex = item.dataset.journeySid === state.focusedJourneySid && items.includes(item) ? 0 : -1;
  });
  document.querySelectorAll('[data-journey-detail]').forEach((detail) => {
    detail.hidden = detail.dataset.journeyDetail !== state.expandedJourneySid;
  });
  if (focus) items.find((item) => item.dataset.journeySid === state.focusedJourneySid)?.focus();
}

function toggleJourneyItem(sid) {
  state.focusedJourneySid = sid;
  state.expandedJourneySid = state.expandedJourneySid === sid ? null : sid;
  syncJourneyInteraction({ focus: true });
}

function moveJourneyFocus(key) {
  const items = journeyItems();
  if (!items.length) return;
  const current = Math.max(0, items.findIndex((item) => item.dataset.journeySid === state.focusedJourneySid));
  let next = current;
  if (key === 'Home') next = 0;
  else if (key === 'End') next = items.length - 1;
  else if (state.journeyView === 'table' && key === 'ArrowUp') next = Math.max(0, current - 1);
  else if (state.journeyView === 'table' && key === 'ArrowDown') next = Math.min(items.length - 1, current + 1);
  else if (state.journeyView === 'cards') {
    const columns = items.filter((item) => Math.abs(item.getBoundingClientRect().top - items[0].getBoundingClientRect().top) < 2).length || 1;
    if (key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (key === 'ArrowRight') next = Math.min(items.length - 1, current + 1);
    else if (key === 'ArrowUp') next = Math.max(0, current - columns);
    else if (key === 'ArrowDown') next = Math.min(items.length - 1, current + columns);
  }
  state.focusedJourneySid = items[next].dataset.journeySid;
  syncJourneyInteraction({ focus: true });
}

function handleJourneyKeydown(event) {
  const item = event.target.closest('[data-journey-sid]');
  if ((event.key === 'Enter' || event.key === ' ') && item) {
    event.preventDefault();
    toggleJourneyItem(item.dataset.journeySid);
    return true;
  }
  if (item && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    if (state.journeyView === 'table' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return true;
    event.preventDefault();
    moveJourneyFocus(event.key);
    return true;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    if (state.expandedJourneySid) {
      state.expandedJourneySid = null;
      syncJourneyInteraction({ focus: true });
    } else {
      returnFromJourney();
    }
    return true;
  }
  return false;
}

function returnFromJourney() {
  state.expandedJourneySid = null;
  const target = state.journeyReturnView === 'app' && state.dataset ? 'app' : 'diksoochi';
  showOnly(target);
  requestAnimationFrame(() => document.getElementById(state.journeyReturnFocus)?.focus());
}

function renderJourneyDetails(rows, dataset) {
  const bySid = new Map(dataset.rows.map((row) => [row.sid, row]));
  const cards = document.getElementById('journey-cards');
  const table = document.getElementById('journey-table-body');
  cards.textContent = '';
  table.textContent = '';
  rows.forEach((engagement) => {
    const verse = bySid.get(engagement.sid);
    const sanskrit = oneLine(verse?.source.shloka);
    const preferred = state.activeProfile.contentLanguage;
    const meaning = oneLine(verse?.languages[preferred]?.meaning || verse?.languages.en?.meaning);
    const card = document.createElement('article');
    card.className = 'journey-card';
    card.dataset.journeySid = engagement.sid;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${engagement.sid}, ${i18n.t('diksoochi.count')} ${engagement.count}`);
    const detailId = `journey-card-detail-${engagement.sid.replace('.', '-')}`;
    card.setAttribute('aria-controls', detailId);
    const cardHead = document.createElement('div');
    cardHead.className = 'journey-card-head';
    const sid = document.createElement('strong');
    sid.textContent = engagement.sid;
    const count = document.createElement('span');
    count.className = 'journey-count';
    count.textContent = String(engagement.count);
    count.setAttribute('aria-label', `${i18n.t('diksoochi.count')}: ${engagement.count}`);
    const indicator = document.createElement('i');
    indicator.className = 'journey-chevron';
    indicator.setAttribute('aria-hidden', 'true');
    cardHead.append(sid, count, indicator);
    const shloka = document.createElement('p');
    shloka.className = 'journey-line journey-sanskrit';
    shloka.lang = 'sa';
    shloka.textContent = sanskrit;
    shloka.title = sanskrit;
    const meaningLine = document.createElement('p');
    meaningLine.className = 'journey-line';
    meaningLine.lang = preferred;
    meaningLine.textContent = meaning;
    meaningLine.title = meaning;
    const cardDetail = document.createElement('div');
    cardDetail.className = 'journey-expanded';
    cardDetail.id = detailId;
    cardDetail.dataset.journeyDetail = engagement.sid;
    cardDetail.hidden = true;
    const fullShloka = document.createElement('p');
    fullShloka.className = 'journey-expanded-shloka';
    fullShloka.lang = 'sa';
    fullShloka.textContent = verse?.source.shloka || '—';
    const fullMeaning = document.createElement('p');
    fullMeaning.lang = preferred;
    fullMeaning.textContent = verse?.languages[preferred]?.meaning || verse?.languages.en?.meaning || '—';
    cardDetail.append(fullShloka, fullMeaning);
    card.append(cardHead, shloka, meaningLine, cardDetail);
    cards.appendChild(card);

    const tr = document.createElement('tr');
    tr.className = 'journey-table-row';
    tr.dataset.journeySid = engagement.sid;
    tr.tabIndex = -1;
    tr.setAttribute('aria-label', `${engagement.sid}, ${i18n.t('diksoochi.count')} ${engagement.count}`);
    const tableDetailId = `journey-table-detail-${engagement.sid.replace('.', '-')}`;
    tr.setAttribute('aria-controls', tableDetailId);
    [engagement.sid, sanskrit, meaning, String(engagement.count)].forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      cell.textContent = value;
      if (index === 0) cell.scope = 'row';
      if (index === 1 || index === 2) {
        cell.className = 'journey-table-line';
        cell.lang = index === 1 ? 'sa' : preferred;
        cell.title = value;
      }
      if (index === 3) {
        const rowIndicator = document.createElement('i');
        rowIndicator.className = 'journey-chevron';
        rowIndicator.setAttribute('aria-hidden', 'true');
        cell.appendChild(rowIndicator);
      }
      tr.appendChild(cell);
    });
    const detailRow = document.createElement('tr');
    detailRow.className = 'journey-table-detail';
    detailRow.id = tableDetailId;
    detailRow.dataset.journeyDetail = engagement.sid;
    detailRow.hidden = true;
    const detailCell = document.createElement('td');
    detailCell.colSpan = 4;
    const tableShloka = document.createElement('p');
    tableShloka.className = 'journey-expanded-shloka';
    tableShloka.lang = 'sa';
    tableShloka.textContent = verse?.source.shloka || '—';
    const tableMeaning = document.createElement('p');
    tableMeaning.lang = preferred;
    tableMeaning.textContent = verse?.languages[preferred]?.meaning || verse?.languages.en?.meaning || '—';
    detailCell.append(tableShloka, tableMeaning);
    detailRow.appendChild(detailCell);
    table.append(tr, detailRow);
  });
}

async function openJourneyDetails() {
  const origin = visibleView();
  if (origin === 'app' || origin === 'diksoochi') {
    state.journeyReturnView = origin;
    state.journeyReturnFocus = origin === 'app' ? 'menu-button' : 'journey-details-button';
  }
  if (collectionSource.requiresSelection) return requestLocalCollections();
  if (origin === 'app') {
    setMenuOpen(false);
    audioPlayer.pause();
  }
  showOnly('loading');
  try {
    const [rows, savedView, dataset] = await Promise.all([
      profileStore.getDiksoochiDetails(state.activeProfile.pid),
      profileStore.getJourneyView(state.activeProfile.pid),
      state.journeyDataset ? Promise.resolve(state.journeyDataset) : collectionSource.loadExperience('gita-700')
    ]);
    state.journeyDataset = dataset;
    state.expandedJourneySid = null;
    state.focusedJourneySid = rows[0]?.sid || null;
    renderJourneyDetails(rows, dataset);
    setJourneyView(savedView || (matchMedia('(max-width: 700px)').matches ? 'cards' : 'table'), { save: false });
    showOnly('journey-details');
  } catch (error) {
    showError(error.message || i18n.t('error.title'));
  }
}

function syncHomeCollectionSource() {
  const section = document.getElementById('home-collections');
  section.hidden = location.protocol !== 'file:';
  if (section.hidden) return;
  const ready = collectionSource.isReady;
  document.getElementById('home-collections-title').textContent = i18n.t(ready ? 'collections.readyTitle' : 'collections.title');
  document.getElementById('home-collections-message').textContent = ready
    ? i18n.t('collections.readyMessage', { name: collectionSource.label })
    : i18n.t('collections.message');
  document.getElementById('home-collections-button').textContent = i18n.t(ready ? 'collections.change' : 'collections.load');
  document.getElementById('home-collections-error').textContent = '';
  document.querySelectorAll('#continue-journey-link, #gita-yoga-link, #gita-700-link, #gita-sara-link').forEach((link) => {
    link.classList.toggle('needs-collections', !ready);
    link.setAttribute('aria-disabled', String(!ready));
  });
}

function requestLocalCollections() {
  showOnly('diksoochi');
  syncHomeCollectionSource();
  const section = document.getElementById('home-collections');
  section.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('home-collections-button').focus({ preventScroll: true });
}

function openHomeExperience(link) {
  if (collectionSource.requiresSelection) return requestLocalCollections();
  const destination = new URL(link.href, location.href);
  play = destination.searchParams.get('play');
  requestedSid = destination.searchParams.get('sid');
  requestedLanguage = destination.searchParams.get('lang');
  history.replaceState(null, '', destination);
  startRequestedExperience();
}

async function useSelectedCollections(fileList) {
  const error = document.getElementById('home-collections-error');
  error.textContent = '';
  try {
    collectionSource.selectFiles(fileList);
    state.journeyDataset = null;
    await collectionSource.loadExperience('gita-700');
    syncHomeCollectionSource();
    if (state.pendingLocalDestination) {
      ({ play, requestedSid, requestedLanguage } = state.pendingLocalDestination);
      state.pendingLocalDestination = null;
      return startRequestedExperience();
    }
  } catch (failure) {
    collectionSource.clear();
    collectionSource.files = null;
    syncHomeCollectionSource();
    error.textContent = failure.message || i18n.t('collections.invalid');
  }
}

function updateProfileUrl(profile) {
  const next = new URL(location.href);
  next.searchParams.set('pid', profile.pid);
  history.replaceState(null, '', next);
}

async function activateProfile(profile) {
  if (state.activeProfile?.pid !== profile.pid) state.experienceResumes.clear();
  state.activeProfile = profile;
  setInterfaceLanguage(profile.interfaceLanguage);
  updateProfileUrl(profile);
  await profileUI.renderPills(profile);
}

async function selectProfile(profile) {
  await activateProfile(profile);
  emitEvent(state.profileSelectionMode === 'initial' ? 'profile_selected' : 'profile_switched');
  await openProfileLocation(profile, { honorExplicit: state.profileSelectionMode === 'initial' });
}

async function createProfile(profile) {
  await activateProfile(profile);
  emitEvent('profile_created');
  if (location.protocol === 'file:' && explicitLocationRequested && play) return startRequestedExperience();
  goToExperienceSelection(profile, { source: 'profile_created' });
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
  emitEvent('profile_updated');
  if (state.profileReturnView === 'profile-selection') {
    await profileUI.showSelection({ switching: true });
    return showOnly('profile-selection');
  }
  if (state.profileReturnView === 'journey-details') return openJourneyDetails();
  if (state.dataset && state.profileReturnView === 'app') {
    showOnly('app');
    state.language = requestedLanguage === 'kn' || requestedLanguage === 'en' ? requestedLanguage : profile.contentLanguage;
    render();
  } else {
    play = null;
    requestedSid = null;
    await startRequestedExperience();
  }
}

function goToExperienceSelection(profile = state.activeProfile, { source = 'home', track = true } = {}) {
  play = null;
  requestedSid = null;
  requestedLanguage = profile?.contentLanguage || 'en';
  const home = new URL(location.href);
  home.searchParams.delete('play');
  home.searchParams.delete('sid');
  home.searchParams.set('view', 'diksoochi');
  if (requestedLanguage === 'kn') home.searchParams.set('lang', 'kn');
  else home.searchParams.delete('lang');
  if (profile) home.searchParams.set('pid', profile.pid);
  history.replaceState(null, '', home);
  if (track && profile) {
    emitEvent('home_opened', {
      profile,
      context: { language: requestedLanguage },
      details: { source }
    });
  }
  startRequestedExperience();
}

async function openProfileLocation(profile, { honorExplicit = false } = {}) {
  if (honorExplicit && explicitLocationRequested) {
    state.locationSource = 'deep_link';
    return startRequestedExperience();
  }
  const resume = await profileStore.getResume(profile.pid);
  requestedLanguage = resume?.language || profile.contentLanguage;
  if (resume?.view === 'experience') {
    play = resume.experience;
    requestedSid = resume.sid;
    state.locationSource = 'resume';
    return startRequestedExperience();
  }
  goToExperienceSelection(profile, { source: resume ? 'resume' : 'profile_selected', track: !resume });
}

async function openProfileForm(profile = null, { focusPreferences = false } = {}) {
  state.profileReturnView = visibleView();
  closeOverlays({ restoreFocus: false });
  await profileUI.showForm(profile, { focusPreferences });
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
    emitEvent('app_opened', { profile: null });
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
    emitEvent('profile_selected');
    await openProfileLocation(profile, { honorExplicit: true });
  } catch (error) {
    try { emitEvent('profile_storage_failed', { details: { operation: 'initialize' } }); } catch (_) {}
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

const homeExperienceDetails = {
  'gita-yoga': { kicker: 'home.gitaYogaKicker', description: 'home.gitaYogaDetail', features: 'home.gitaYogaFeatures' },
  'gita-700': { kicker: 'home.gita700Kicker', description: 'home.gita700Detail', features: 'home.gita700Features' },
  'gita-sara': { kicker: 'home.gitaSaraKicker', description: 'home.gitaSaraDetail', features: 'home.gitaSaraFeatures' }
};

function closeHomeExperienceDetail({ focus = false } = {}) {
  const panel = document.getElementById('experience-detail');
  const active = document.querySelector('[data-experience-card].active');
  panel.hidden = true;
  delete panel.dataset.experience;
  document.querySelectorAll('[data-experience-card]').forEach((card) => card.classList.remove('active'));
  if (focus) active?.focus();
}

function showHomeExperienceDetail(link) {
  const experienceId = link.dataset.experienceCard;
  const detail = homeExperienceDetails[experienceId];
  const panel = document.getElementById('experience-detail');
  document.querySelectorAll('[data-experience-card]').forEach((card) => card.classList.toggle('active', card === link));
  panel.dataset.experience = experienceId;
  document.getElementById('experience-detail-kicker').textContent = i18n.t(detail.kicker);
  document.getElementById('experience-detail-title').textContent = getExperience(experienceId).label;
  document.getElementById('experience-detail-description').textContent = i18n.t(detail.description);
  document.getElementById('experience-detail-features').replaceChildren(...i18n.t(detail.features).split('|').map((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  document.getElementById('experience-detail-action').href = link.href;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function startRequestedExperience() {
  const experienceIds = ['gita-yoga', 'gita-700', 'gita-sara'];
  const resumes = new Map(await Promise.all(experienceIds.map(async (experienceId) => [
    experienceId,
    state.experienceResumes.get(experienceId) || await profileStore.getExperienceResume(state.activeProfile.pid, experienceId)
  ])));
  const chooserUrls = new Map(experienceIds.map((experienceId) => {
    const resume = resumes.get(experienceId);
    const chooserUrl = new URL(location.href);
    chooserUrl.searchParams.set('play', experienceId);
    chooserUrl.searchParams.delete('view');
    if (resume?.sid) chooserUrl.searchParams.set('sid', resume.sid);
    else chooserUrl.searchParams.delete('sid');
    chooserUrl.searchParams.set('pid', state.activeProfile.pid);
    const language = resume?.language || (requestedLanguage === 'kn' || requestedLanguage === 'en' ? requestedLanguage : state.activeProfile.contentLanguage);
    if (language === 'kn') chooserUrl.searchParams.set('lang', 'kn');
    else chooserUrl.searchParams.delete('lang');
    document.getElementById(experienceId + '-link').href = chooserUrl.href;
    return [experienceId, chooserUrl];
  }));
  const latest = await profileStore.getResume(state.activeProfile.pid);
  const lastExperienceId = latest?.lastExperience?.experience || (latest?.view === 'experience' ? latest.experience : null);
  const continueExperience = getExperience(lastExperienceId)?.available
    ? lastExperienceId
    : 'gita-yoga';
  const continueResume = resumes.get(continueExperience);
  const chooserUrl = chooserUrls.get(continueExperience);
  const continueLink = document.getElementById('continue-journey-link');
  continueLink.href = chooserUrl.href;
  continueLink.dataset.experience = continueExperience;
  continueLink.setAttribute('aria-label', continueResume?.sid
    ? i18n.t('diksoochi.resumeExperience', { experience: getExperience(continueExperience).label, sid: continueResume.sid })
    : i18n.t('diksoochi.beginExperience', { experience: getExperience(continueExperience).label }));
  document.getElementById('continue-journey-kicker').textContent = continueResume?.sid
    ? i18n.t('diksoochi.resumeLabel', { experience: getExperience(continueExperience).label })
    : i18n.t('diksoochi.beginLabel');
  document.getElementById('continue-journey-title').textContent = continueResume?.sid
    ? i18n.t('diksoochi.shlokaLabel', { sid: continueResume.sid })
    : getExperience(continueExperience).label;
  if (!play) {
    const summary = await profileStore.getDiksoochiSummary(state.activeProfile.pid);
    document.getElementById('diksoochi-greeting').textContent = i18n.t('diksoochi.greeting', { name: state.activeProfile.name });
    const knowSummary = document.getElementById('diksoochi-know-summary');
    const knowSummaryText = document.getElementById('diksoochi-know-summary-text');
    const journeyStatements = document.getElementById('diksoochi-journey-statements');
    const journeyEmpty = document.getElementById('diksoochi-journey-empty');
    const hasJourneyDetails = summary.shlokas > 0;
    knowSummaryText.textContent = hasJourneyDetails
      ? i18n.t('diksoochi.knowSummary', {
          chapterText: i18n.t(summary.chapters === 1 ? 'diksoochi.chapterOne' : 'diksoochi.chapterMany', { count: summary.chapters }),
          shlokaText: i18n.t(summary.shlokas === 1 ? 'diksoochi.shlokaOne' : 'diksoochi.shlokaMany', { count: summary.shlokas })
        })
      : '';
    knowSummary.hidden = !hasJourneyDetails;
    journeyStatements.hidden = !hasJourneyDetails;
    journeyEmpty.hidden = hasJourneyDetails;
    closeHomeExperienceDetail();
    syncHomeCollectionSource();
    return showOnly('diksoochi');
  }

  if (collectionSource.requiresSelection) {
    state.pendingLocalDestination = { play, requestedSid, requestedLanguage };
    play = null;
    requestedSid = null;
    return requestLocalCollections();
  }

  const experience = getExperience(play);
  if (!experience || !experience.available) {
    if (state.locationSource === 'resume') {
      state.locationSource = null;
      return goToExperienceSelection(state.activeProfile, { source: 'invalid_resume' });
    }
    return showError('The requested experience is not available. Choose Gita Yoga, Gita 700, or Gita Sara.');
  }

  showOnly('loading');
  try {
    await startPlayer(await collectionSource.loadExperience(play), experience);
  } catch (error) {
    emitEvent('data_load_failed', {
      context: { experience: play, language: requestedLanguage || state.activeProfile.contentLanguage },
      details: { source: 'automatic' }
    });
    showDataChooser(error.message);
  }
}

async function startPlayer(dataset, experience, { workspace = null, sid = requestedSid } = {}) {
  if (state.editor) state.editor.destroy();
  if (state.renderer) state.renderer.destroy();
  state.dataset = dataset;
  state.language = requestedLanguage === 'kn' || requestedLanguage === 'en' ? requestedLanguage : state.activeProfile.contentLanguage;
  const requestedIndex = sid ? findSid(sid) : -1;
  if (state.locationSource === 'resume' && sid && requestedIndex < 0) {
    state.locationSource = null;
    return goToExperienceSelection(state.activeProfile, { source: 'invalid_resume' });
  }
  state.renderer = await experience.load({ translate });
  state.renderer.mount(document.getElementById('renderer-root'));

  const defaultIndex = findSid('1.B');
  state.index = requestedIndex >= 0 ? requestedIndex : (defaultIndex >= 0 ? defaultIndex : 0);
  emitEvent('experience_selected', { context: { experience: play, language: state.language } });

  state.editor = new InlineEditor({
    dataset: state.dataset,
    renderer: state.renderer,
    currentRow,
    rerender: (options = {}) => render({ ...options, trackLocation: false }),
    workspace,
    translate,
    onStateChange: ({ active, savedChanges, pendingDownload, workspace: hasWorkspace, savedRevision }) => {
      document.querySelector('#edit-button .top-menu-label').textContent = active ? i18n.t('menu.leaveEdit') : i18n.t('menu.edit');
      if (savedRevision > state.lastSavedRevision) {
        state.lastSavedRevision = savedRevision;
        state.downloadReminderDismissed = false;
      }
      const reminder = document.getElementById('download-reminder');
      reminder.hidden = hasWorkspace || !savedChanges || state.downloadReminderDismissed;
      const action = document.getElementById('download-reminder-action');
      action.textContent = pendingDownload ? i18n.t('editor.download') : i18n.t('editor.downloadAgain');
    }
  });

  bindEvents();
  buildChapterList();
  showOnly('app');
  render({ source: state.locationSource || (sid ? 'deep_link' : 'experience_selection') });
}

function showDataChooser(message) {
  showOnly('data-chooser');
  document.getElementById('file-error').textContent = message || '';
  document.getElementById('collections-folder-input').value = '';
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
  const row = state.dataset.rows.find((candidate) => candidate.cid === cid && (
    language === 'sa' ? candidate.source.chapterName : candidate.languages[language]?.chapterName
  ));
  return row ? (language === 'sa' ? row.source.chapterName : row.languages[language]?.chapterName || '') : '';
}

function chapterIconFor(cid) {
  const row = state.dataset.rows.find((candidate) => candidate.cid === cid && candidate.media.chapterIconUrl);
  return row ? row.media.chapterIconUrl : '';
}

function audioSource(row) {
  const source = row.media.primaryAudioUrl || row.media.chantFullSaUrl;
  return source ? new URL(source, location.href).href : '';
}

function render(options = {}) {
  const row = currentRow();
  if (!row) return;
  audioPlayer.setSource(audioSource(row));
  const chapterName = chapterNameFor(row.cid, state.language);
  document.getElementById('chapter-title').textContent = row.cid + (chapterName ? ' — ' + chapterName : '');
  const chapterIcon = document.getElementById('chapter-icon');
  const iconPath = chapterIconFor(row.cid);
  chapterIcon.hidden = !iconPath;
  if (iconPath) chapterIcon.src = new URL(iconPath, location.href).href;
  else chapterIcon.removeAttribute('src');
  document.getElementById('sid-label').textContent = row.sid;
  document.getElementById('position-label').textContent = (state.index + 1) + ' / ' + state.dataset.rows.length;
  document.querySelector('#language-button .top-menu-label').textContent = i18n.t('menu.contentLanguage', { language: state.language === 'kn' ? 'ಕನ್ನಡ' : 'English' });
  state.renderer.render(row, state.language);
  document.getElementById('renderer-root').scrollTop = 0;
  state.experienceResumes.set(play, {
    experience: play,
    sid: row.sid,
    language: state.language,
    savedAt: new Date().toISOString()
  });
  if (options.keepEditing && state.editor.active) state.renderer.setEditing(true);
  updateUrl();
  updateChapterSelection();
  trackVerseEngagement(row);
  if (options.trackLocation !== false) {
    const source = options.source || state.locationSource || 'render';
    state.locationSource = null;
    emitEvent('location_changed', {
      context: {
        experience: play,
        sid: row.sid,
        chapter: row.cid,
        language: state.language
      },
      details: { source }
    });
  }
}

function trackVerseEngagement(row) {
  if (engagementTimer) clearInterval(engagementTimer);
  const thresholds = new Map([
    [2000, 'verse_viewed'],
    [10000, 'verse_engaged_10s'],
    [30000, 'verse_engaged_30s'],
    [60000, 'verse_engaged_60s']
  ]);
  let activeMilliseconds = 0;
  let lastTick = Date.now();
  engagementTimer = setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastTick;
    lastTick = now;
    if (document.visibilityState !== 'visible' || currentRow()?.sid !== row.sid) return;
    activeMilliseconds += Math.min(elapsed, 1500);
    thresholds.forEach((event, threshold) => {
      if (activeMilliseconds >= threshold) {
        emitEvent(event, { context: verseContext(row) });
        thresholds.delete(threshold);
      }
    });
    if (!thresholds.size) {
      clearInterval(engagementTimer);
      engagementTimer = null;
    }
  }, 1000);
}

function updateUrl() {
  const next = new URL(location.href);
  next.searchParams.set('play', play);
  next.searchParams.set('sid', currentRow().sid);
  if (state.language === 'kn') next.searchParams.set('lang', 'kn');
  else next.searchParams.delete('lang');
  history.replaceState(null, '', next);
}

function navigate(offset, source = offset > 0 ? 'next' : 'previous') {
  if (!state.editor.canNavigate()) return;
  const next = state.index + offset;
  if (next < 0 || next >= state.dataset.rows.length) return;
  state.index = next;
  render({ source });
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
  navigate(deltaX < 0 ? 1 : -1, 'swipe');
}

function setLanguage(language) {
  if (!state.editor.canNavigate()) return;
  state.language = language === 'kn' ? 'kn' : 'en';
  requestedLanguage = state.language;
  state.activeProfile.contentLanguage = state.language;
  profileStore.save(state.activeProfile).then((profile) => {
    state.activeProfile = profile;
    profileUI.renderPills(profile);
  }).catch(() => {});
  emitEvent('language_changed', {
    context: { experience: play, sid: currentRow().sid, chapter: currentRow().cid, language: state.language },
    details: { source: 'language_menu' }
  });
  render({ source: 'language_change' });
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
  } else if (id === 'workspace-overlay') {
    document.getElementById('workspace-error').textContent = '';
    requestAnimationFrame(() => document.getElementById('open-collections-workspace').focus());
  }
}

function closeOverlays({ restoreFocus = true } = {}) {
  let closed = false;
  ['workspace-overlay', 'goto-overlay', 'chapters-overlay', 'language-overlay', 'help-overlay', 'profile-menu-overlay', 'about-overlay'].forEach((id) => {
    const overlay = document.getElementById(id);
    if (!overlay.hidden) { overlay.hidden = true; closed = true; }
  });
  if (closed && restoreFocus && state.overlayOpener && document.contains(state.overlayOpener)) state.overlayOpener.focus();
  if (closed) state.overlayOpener = null;
  return closed;
}

async function requestEditMode() {
  setMenuOpen(false);
  if (state.editor.active) return state.editor.toggle();
  openOverlay('workspace-overlay');
}

async function openCollectionsWorkspace() {
  const message = document.getElementById('workspace-error');
  const button = document.getElementById('open-collections-workspace');
  if (typeof window.showDirectoryPicker !== 'function') {
    message.textContent = i18n.t('workspace.unsupported');
    return;
  }
  button.disabled = true;
  message.textContent = i18n.t('workspace.opening');
  try {
    const handle = await window.showDirectoryPicker({ id: 'gitaverse-collections', mode: 'readwrite' });
    const permission = { mode: 'readwrite' };
    if (handle.queryPermission && await handle.queryPermission(permission) !== 'granted') {
      if (!handle.requestPermission || await handle.requestPermission(permission) !== 'granted') {
        throw new Error(i18n.t('workspace.permission'));
      }
    }
    const sid = currentRow().sid;
    const { dataset, workspace } = await openWritableCollectionWorkspace(play, handle);
    closeOverlays({ restoreFocus: false });
    await startPlayer(dataset, getExperience(play), { workspace, sid });
    state.editor.enter();
  } catch (error) {
    if (error?.name !== 'AbortError') message.textContent = error.message || i18n.t('workspace.openFailed');
  } finally {
    button.disabled = false;
  }
}

function enterDownloadOnlyEditMode() {
  closeOverlays({ restoreFocus: false });
  state.editor.enter();
}

function setMenuOpen(open) {
  const menu = document.getElementById('top-menu');
  const button = document.getElementById('menu-button');
  menu.hidden = !open;
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.setAttribute('aria-label', open ? i18n.t('menu.close') : i18n.t('menu.open'));
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
  render({ source: 'chapter' });
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
  if (state.editor.pendingDownload && !window.confirm(i18n.t('editor.returnHome'))) return;
  goToExperienceSelection();
}

function goToSid(sid) {
  if (!state.editor.canNavigate()) return false;
  const found = findSid(sid);
  if (found < 0) return false;
  state.index = found;
  closeOverlays({ restoreFocus: false });
  render({ source: 'goto' });
  document.getElementById('chapter-trigger').focus();
  return true;
}

function buildChapterList() {
  const chapters = [];
  state.dataset.rows.forEach((row, index) => {
    if (!chapters.some((chapter) => chapter.cid === row.cid)) {
      chapters.push({ cid: row.cid, index, en: chapterNameFor(row.cid, 'en'), kn: chapterNameFor(row.cid, 'kn') });
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
    number.textContent = chapter.cid;
    const name = document.createElement('span');
    name.className = 'chapter-name';
    name.dataset.en = chapter.en;
    name.dataset.kn = chapter.kn;
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
  document.querySelector('#fullscreen-button .top-menu-label').textContent = active ? i18n.t('menu.exitFullscreen') : i18n.t('menu.fullscreen');
  const button = document.getElementById('footer-fullscreen-button');
  button.setAttribute('aria-label', active ? i18n.t('fullscreen.exit') : i18n.t('fullscreen.enter'));
  button.title = (active ? i18n.t('fullscreen.exit') : i18n.t('menu.fullscreen')) + ' (F)';
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
  document.getElementById('collections-folder-input').addEventListener('change', async (event) => {
    try {
      collectionSource.selectFiles(event.target.files);
      const dataset = await collectionSource.loadExperience(play);
      await startPlayer(dataset, getExperience(play));
    } catch (error) {
      showDataChooser(error.message || 'The selected collections folder could not be read.');
    }
  });
  document.getElementById('retry-data-button').addEventListener('click', startRequestedExperience);
  document.getElementById('home-collections-input').addEventListener('change', (event) => useSelectedCollections(event.target.files));
  document.getElementById('home-collections-button').addEventListener('click', () => document.getElementById('home-collections-input').click());
  document.querySelectorAll('#continue-journey-link, #experience-detail-action').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    openHomeExperience(link);
  }));
  document.querySelectorAll('[data-experience-card]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    showHomeExperienceDetail(link);
  }));
  document.getElementById('experience-detail-close').addEventListener('click', () => closeHomeExperienceDetail({ focus: true }));
  updateDeviceLayout();
  document.getElementById('menu-button').addEventListener('click', (event) => { event.stopPropagation(); toggleMenu(); });
  document.getElementById('chapter-trigger').addEventListener('click', () => openOverlay('chapters-overlay'));
  document.getElementById('goto-button').addEventListener('click', () => openOverlay('goto-overlay'));
  document.getElementById('footer-goto-button').addEventListener('click', () => openOverlay('goto-overlay'));
  document.getElementById('chapters-button').addEventListener('click', () => openOverlay('chapters-overlay'));
  document.getElementById('help-button').addEventListener('click', () => openOverlay('help-overlay'));
  document.getElementById('about-button').addEventListener('click', (event) => aboutDialog.open(event.currentTarget));
  document.querySelectorAll('[data-about]').forEach((button) => button.addEventListener('click', (event) => aboutDialog.open(event.currentTarget)));
  document.getElementById('language-button').addEventListener('click', () => openOverlay('language-overlay'));
  document.getElementById('home-button').addEventListener('click', goHome);
  document.getElementById('journey-button').addEventListener('click', openJourneyDetails);
  document.getElementById('journey-details-button').addEventListener('click', openJourneyDetails);
  document.getElementById('journey-back-button').addEventListener('click', returnFromJourney);
  document.querySelectorAll('[data-journey-view]').forEach((button) => button.addEventListener('click', () => setJourneyView(button.dataset.journeyView)));
  ['journey-cards', 'journey-table-body'].forEach((id) => document.getElementById(id).addEventListener('click', (event) => {
    const item = event.target.closest('[data-journey-sid]');
    if (item) toggleJourneyItem(item.dataset.journeySid);
  }));
  document.querySelectorAll('[data-profile-pill]').forEach((button) => button.addEventListener('click', () => openOverlay('profile-menu-overlay')));
  document.getElementById('profile-preferences-button').addEventListener('click', () => openProfileForm(state.activeProfile, { focusPreferences: true }));
  document.getElementById('switch-manage-profiles-button').addEventListener('click', () => openProfileSelection());
  document.getElementById('edit-profile-button').addEventListener('click', () => openProfileForm(state.activeProfile));
  document.getElementById('add-profile-button').addEventListener('click', () => openProfileForm());
  document.getElementById('profile-selection-back').addEventListener('click', () => {
    showOnly(state.profileReturnView === 'app' && state.dataset ? 'app' : (state.profileReturnView === 'journey-details' ? 'journey-details' : 'diksoochi'));
  });
  document.getElementById('profile-form-cancel').addEventListener('click', () => {
    setInterfaceLanguage(state.activeProfile?.interfaceLanguage || 'en');
    showOnly(state.profileReturnView === 'app' && state.dataset ? 'app' : (state.profileReturnView === 'profile-selection' ? 'profile-selection' : (state.profileReturnView === 'journey-details' ? 'journey-details' : 'diksoochi')));
  });
  document.getElementById('edit-button').addEventListener('click', requestEditMode);
  document.getElementById('open-collections-workspace').addEventListener('click', openCollectionsWorkspace);
  document.getElementById('edit-download-only').addEventListener('click', enterDownloadOnlyEditMode);
  document.getElementById('download-reminder-action').addEventListener('click', () => state.editor.download());
  document.getElementById('download-reminder-close').addEventListener('click', () => {
    if (state.editor.pendingDownload && !window.confirm(i18n.t('editor.dismissDownload'))) return;
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
    if (!goToSid(document.getElementById('goto-input').value)) document.getElementById('goto-error').textContent = i18n.t('goto.notFound');
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
    if (!document.getElementById('journey-details').hidden && handleJourneyKeydown(event)) return;
    if (!state.dataset || document.getElementById('app').hidden) return;
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
      } else if (menuKey === 'j') {
        event.preventDefault(); openJourneyDetails();
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
    else if (key === 'j') { event.preventDefault(); openJourneyDetails(); }
    else if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
    else if (key === 'h') { event.preventDefault(); openOverlay('help-overlay'); }
    else if (key === 'k') { event.preventDefault(); openOverlay('about-overlay'); }
    else if (key === 'm') { event.preventDefault(); toggleMenu(); }
    else if (key === 'e') { event.preventDefault(); requestEditMode(); }
  });
}

bindEvents();
versionHistoryStore.recordSeen(appVersion).catch(() => {});
pwa.start();
checkPlayerVersion().then((current) => { if (current) initializeProfiles(); });
