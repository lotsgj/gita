const PROFILE_DB_NAME = 'gitaverse-profiles';
const PROFILE_DB_VERSION = 1;
const PROFILE_STORE = 'profiles';
const SETTINGS_STORE = 'settings';

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
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROFILE_STORE)) {
        database.createObjectStore(PROFILE_STORE, { keyPath: 'pid', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
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
    const now = new Date().toISOString();
    const existing = input.pid ? await this.get(input.pid) : null;
    const profile = {
      ...(existing || {}),
      name,
      dob: input.dob,
      gender: input.gender || '',
      language: input.language === 'kn' ? 'kn' : 'en',
      photo: input.photo || '',
      analyticsConsent: Boolean(input.analyticsConsent),
      analyticsProfileId: existing?.analyticsProfileId || randomAnalyticsId(),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    if (existing) profile.pid = existing.pid;
    const transaction = this.database.transaction(PROFILE_STORE, 'readwrite');
    const request = transaction.objectStore(PROFILE_STORE).put(profile);
    const pid = await requestResult(request);
    await transactionDone(transaction);
    return this.get(pid);
  }

  async remove(pid) {
    await this.open();
    const transaction = this.database.transaction([PROFILE_STORE, SETTINGS_STORE], 'readwrite');
    transaction.objectStore(PROFILE_STORE).delete(Number(pid));
    const settings = transaction.objectStore(SETTINGS_STORE);
    const defaultPid = await requestResult(settings.get('defaultPid'));
    if (defaultPid && Number(defaultPid.value) === Number(pid)) settings.delete('defaultPid');
    await transactionDone(transaction);
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
