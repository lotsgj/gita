const PROFILE_DB_NAME = 'gitaverse-profiles';
const PROFILE_DB_VERSION = 4;
const PROFILE_STORE = 'profiles';
const SETTINGS_STORE = 'settings';
const RESUME_STORE = 'resumePoints';
const DIKSOOCHI_ENGAGEMENT_STORE = 'diksoochiEngagement';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('The profile database could not be opened.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('The profile change could not be saved.'));
    transaction.onabort = () => reject(transaction.error || new Error('The profile change was cancelled.'));
  });
}

function openProfileDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROFILE_DB_NAME, PROFILE_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      if (!database.objectStoreNames.contains(PROFILE_STORE)) {
        database.createObjectStore(PROFILE_STORE, { keyPath: 'pid', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(RESUME_STORE)) {
        database.createObjectStore(RESUME_STORE, { keyPath: 'pid' });
      }
      if (!database.objectStoreNames.contains(DIKSOOCHI_ENGAGEMENT_STORE)) {
        const engagement = database.createObjectStore(DIKSOOCHI_ENGAGEMENT_STORE, { keyPath: 'key' });
        engagement.createIndex('pid', 'pid', { unique: false });
      }
      if (event.oldVersion < 3 && database.objectStoreNames.contains(PROFILE_STORE)) {
        const profiles = transaction.objectStore(PROFILE_STORE);
        profiles.openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) return;
          const profile = cursor.value;
          const legacyLanguage = profile.language === 'kn' ? 'kn' : 'en';
          profile.interfaceLanguage = profile.interfaceLanguage === 'kn' ? 'kn' : legacyLanguage;
          profile.contentLanguage = profile.contentLanguage === 'kn' ? 'kn' : legacyLanguage;
          delete profile.language;
          cursor.update(profile);
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local profile storage is unavailable.'));
  });
}

function randomAnalyticsId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class ProfileStore {
  constructor() {
    this.database = null;
  }

  async open() {
    if (!this.database) this.database = await openProfileDatabase();
    return this;
  }

  async list() {
    await this.open();
    const transaction = this.database.transaction(PROFILE_STORE, 'readonly');
    const profiles = await requestResult(transaction.objectStore(PROFILE_STORE).getAll());
    return profiles.sort((left, right) => left.pid - right.pid);
  }

  async get(pid) {
    await this.open();
    if (!Number.isInteger(Number(pid))) return null;
    const transaction = this.database.transaction(PROFILE_STORE, 'readonly');
    return (await requestResult(transaction.objectStore(PROFILE_STORE).get(Number(pid)))) || null;
  }

  async save(input) {
    await this.open();
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Enter a profile name.');
    if (!['en', 'kn'].includes(input.interfaceLanguage)) throw new Error('Choose an app language.');
    if (!['en', 'kn'].includes(input.contentLanguage)) throw new Error('Choose a preferred Gita content language.');
    const now = new Date().toISOString();
    const existing = input.pid ? await this.get(input.pid) : null;
    const profile = {
      ...(existing || {}),
      name,
      dob: input.dob,
      gender: input.gender || '',
      interfaceLanguage: input.interfaceLanguage,
      contentLanguage: input.contentLanguage,
      photo: input.photo || '',
      analyticsConsent: Boolean(input.analyticsConsent),
      analyticsProfileId: existing?.analyticsProfileId || randomAnalyticsId(),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    delete profile.language;
    if (existing) profile.pid = existing.pid;
    const transaction = this.database.transaction(PROFILE_STORE, 'readwrite');
    const request = transaction.objectStore(PROFILE_STORE).put(profile);
    const pid = await requestResult(request);
    await transactionDone(transaction);
    return this.get(pid);
  }

  async remove(pid) {
    await this.open();
    const transaction = this.database.transaction([PROFILE_STORE, SETTINGS_STORE, RESUME_STORE, DIKSOOCHI_ENGAGEMENT_STORE], 'readwrite');
    transaction.objectStore(PROFILE_STORE).delete(Number(pid));
    const settings = transaction.objectStore(SETTINGS_STORE);
    const defaultPid = await requestResult(settings.get('defaultPid'));
    if (defaultPid && Number(defaultPid.value) === Number(pid)) settings.delete('defaultPid');
    settings.delete(`journeyView:${Number(pid)}`);
    transaction.objectStore(RESUME_STORE).delete(Number(pid));
    const engagement = transaction.objectStore(DIKSOOCHI_ENGAGEMENT_STORE).index('pid');
    const engagementCursor = engagement.openKeyCursor(IDBKeyRange.only(Number(pid)));
    engagementCursor.onsuccess = () => {
      const cursor = engagementCursor.result;
      if (!cursor) return;
      transaction.objectStore(DIKSOOCHI_ENGAGEMENT_STORE).delete(cursor.primaryKey);
      cursor.continue();
    };
    await transactionDone(transaction);
  }

  async getResume(pid) {
    await this.open();
    if (!Number.isInteger(Number(pid))) return null;
    const transaction = this.database.transaction(RESUME_STORE, 'readonly');
    return (await requestResult(transaction.objectStore(RESUME_STORE).get(Number(pid)))) || null;
  }

  async getExperienceResume(pid, experience) {
    const record = await this.getResume(pid);
    const experienceId = String(experience || '');
    if (!record || !experienceId) return null;
    const saved = record.experiences?.[experienceId];
    if (saved?.sid) return { experience: experienceId, ...saved };
    // Records created before per-experience resume points are still usable.
    if (record.view === 'experience' && record.experience === experienceId && record.sid) {
      return {
        experience: experienceId,
        sid: record.sid,
        language: record.language,
        savedAt: record.savedAt
      };
    }
    return null;
  }

  async saveResume(resume) {
    await this.open();
    if (!Number.isInteger(Number(resume.pid))) throw new Error('A resume point requires a profile ID.');
    const pid = Number(resume.pid);
    const transaction = this.database.transaction(RESUME_STORE, 'readwrite');
    const store = transaction.objectStore(RESUME_STORE);
    const existing = await requestResult(store.get(pid));
    const record = {
      ...(existing || {}),
      pid,
      view: resume.view === 'experience' ? 'experience' : 'home',
      language: resume.language === 'kn' ? 'kn' : 'en',
      savedAt: resume.savedAt || new Date().toISOString(),
      experiences: { ...(existing?.experiences || {}) }
    };
    if (record.view === 'experience') {
      record.experience = String(resume.experience || '');
      record.sid = String(resume.sid || '');
      if (!record.experience || !record.sid) throw new Error('An experience resume point requires an experience and SID.');
      record.experiences[record.experience] = {
        sid: record.sid,
        language: record.language,
        savedAt: record.savedAt
      };
      record.lastExperience = {
        experience: record.experience,
        sid: record.sid,
        language: record.language,
        savedAt: record.savedAt
      };
    } else {
      if (!record.lastExperience && existing?.view === 'experience' && existing.experience && existing.sid) {
        record.lastExperience = {
          experience: existing.experience,
          sid: existing.sid,
          language: existing.language === 'kn' ? 'kn' : 'en',
          savedAt: existing.savedAt
        };
      }
      delete record.experience;
      delete record.sid;
    }
    store.put(record);
    await transactionDone(transaction);
    return record;
  }

  async defaultPid() {
    await this.open();
    const transaction = this.database.transaction(SETTINGS_STORE, 'readonly');
    const setting = await requestResult(transaction.objectStore(SETTINGS_STORE).get('defaultPid'));
    return setting ? Number(setting.value) : null;
  }

  async setDefaultPid(pid) {
    await this.open();
    const transaction = this.database.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    if (pid == null) store.delete('defaultPid');
    else store.put({ key: 'defaultPid', value: Number(pid) });
    await transactionDone(transaction);
  }

  async getJourneyView(pid) {
    await this.open();
    if (!Number.isInteger(Number(pid))) return null;
    const transaction = this.database.transaction(SETTINGS_STORE, 'readonly');
    const setting = await requestResult(transaction.objectStore(SETTINGS_STORE).get(`journeyView:${Number(pid)}`));
    return ['cards', 'table'].includes(setting?.value) ? setting.value : null;
  }

  async setJourneyView(pid, view) {
    await this.open();
    if (!Number.isInteger(Number(pid)) || !['cards', 'table'].includes(view)) return;
    const transaction = this.database.transaction(SETTINGS_STORE, 'readwrite');
    transaction.objectStore(SETTINGS_STORE).put({ key: `journeyView:${Number(pid)}`, value: view });
    await transactionDone(transaction);
  }

  async recordDiksoochiEngagement({ pid, experience, sid, chapter, seconds, occurredAt }) {
    await this.open();
    const profileId = Number(pid);
    if (!Number.isInteger(profileId) || !experience || !sid || !chapter) return;
    const key = `${profileId}:${experience}:${sid}`;
    const transaction = this.database.transaction(DIKSOOCHI_ENGAGEMENT_STORE, 'readwrite');
    const store = transaction.objectStore(DIKSOOCHI_ENGAGEMENT_STORE);
    const existing = await requestResult(store.get(key));
    store.put({
      ...(existing || {}), key, pid: profileId, experience, sid, chapter,
      firstMeaningfulAt: existing?.firstMeaningfulAt || occurredAt,
      lastMeaningfulAt: occurredAt,
      meaningfulVisitCount: (existing?.meaningfulVisitCount || 0) + (seconds === 10 ? 1 : 0),
      maxEngagementSeconds: Math.max(existing?.maxEngagementSeconds || 0, seconds)
    });
    await transactionDone(transaction);
  }

  async getDiksoochiSummary(pid) {
    await this.open();
    const transaction = this.database.transaction(DIKSOOCHI_ENGAGEMENT_STORE, 'readonly');
    const rows = await requestResult(transaction.objectStore(DIKSOOCHI_ENGAGEMENT_STORE).index('pid').getAll(Number(pid)));
    const meaningful = rows.filter((row) => row.meaningfulVisitCount > 0 || row.maxEngagementSeconds >= 10);
    return {
      chapters: new Set(meaningful.map((row) => row.chapter)).size,
      shlokas: new Set(meaningful.map((row) => row.sid)).size
    };
  }

  async getDiksoochiDetails(pid) {
    await this.open();
    const transaction = this.database.transaction(DIKSOOCHI_ENGAGEMENT_STORE, 'readonly');
    const rows = await requestResult(transaction.objectStore(DIKSOOCHI_ENGAGEMENT_STORE).index('pid').getAll(Number(pid)));
    const bySid = new Map();
    rows.filter((row) => row.meaningfulVisitCount > 0 || row.maxEngagementSeconds >= 10).forEach((row) => {
      const existing = bySid.get(row.sid) || { sid: row.sid, chapter: row.chapter, count: 0 };
      existing.count += Number(row.meaningfulVisitCount || (row.maxEngagementSeconds >= 10 ? 1 : 0));
      bySid.set(row.sid, existing);
    });
    return Array.from(bySid.values()).sort((left, right) => {
      const chapterDifference = Number(left.chapter) - Number(right.chapter);
      if (chapterDifference) return chapterDifference;
      const order = (value) => value === 'B' ? -1 : value === 'E' ? Number.MAX_SAFE_INTEGER : Number(value);
      return order(left.sid.split('.').pop()) - order(right.sid.split('.').pop());
    });
  }
}

export async function resizeProfilePhoto(file) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for the profile photo.');
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The selected photo could not be read.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('The selected photo is not a supported image.'));
    element.src = source;
  });
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL('image/jpeg', .82);
}
