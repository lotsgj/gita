const DB_NAME = 'gitaverse-version-history';
const DB_VERSION = 1;
const STORE = 'versions';

function versionHistoryRequestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Version history storage is unavailable.'));
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'version' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Version history storage is unavailable.'));
  });
}

export function validateVersionHistory(records) {
  if (!Array.isArray(records)) throw new Error('Version history must be an array.');
  const seen = new Set();
  records.forEach((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`Version history record ${index + 1} is invalid.`);
    if (!/^\d+\.\d{2}[A-Z][a-z]{2}\d{4}-\d{6}$/.test(record.version || '')) throw new Error(`Version history record ${index + 1} has an invalid version.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date || '')) throw new Error(`Version history record ${index + 1} has an invalid date.`);
    if (!String(record.message || '').trim()) throw new Error(`Version history record ${index + 1} has no change message.`);
    if (seen.has(record.version)) throw new Error(`Version history contains duplicate version ${record.version}.`);
    seen.add(record.version);
  });
  return records;
}

function versionTimestamp(version) {
  const match = String(version).match(/\.(\d{2})([A-Z][a-z]{2})(\d{4})-(\d{2})(\d{2})(\d{2})$/);
  if (!match) return 0;
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[2]);
  return Date.UTC(Number(match[3]), month, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6]));
}

export function mergeVersionHistory(deployed = [], local = [], currentVersion = '') {
  const merged = new Map();
  deployed.forEach((record) => merged.set(record.version, { ...record }));
  local.forEach((record) => merged.set(record.version, { ...(merged.get(record.version) || {}), ...record }));
  if (currentVersion && !merged.has(currentVersion)) {
    merged.set(currentVersion, { version: currentVersion, date: new Date().toISOString().slice(0, 10), message: 'Current Gitaverse build' });
  }
  return Array.from(merged.values()).sort((left, right) => {
    const dateOrder = String(right.date || '').localeCompare(String(left.date || ''));
    return dateOrder || versionTimestamp(right.version) - versionTimestamp(left.version);
  });
}

export class VersionHistoryStore {
  constructor() { this.database = null; }
  async open() { if (!this.database) this.database = await openDatabase(); return this; }
  async recordSeen(version, at = new Date().toISOString()) { return this.record(version, 'dateSeen', at); }
  async recordInstalled(version, at = new Date().toISOString()) { return this.record(version, 'dateInstalled', at); }
  async record(version, field, at) {
    if (!version || version === 'dev') return null;
    await this.open();
    const transaction = this.database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const existing = await versionHistoryRequestResult(store.get(version)) || { version };
    if (!existing[field]) existing[field] = at;
    store.put(existing);
    return existing;
  }
  async list() {
    await this.open();
    return versionHistoryRequestResult(this.database.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  }
}
