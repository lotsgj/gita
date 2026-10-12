import { loadCollectionExperience, loadCollectionExperienceFromFiles, openWritableCollectionWorkspace } from './collection-data.js';

export class CollectionSourceRequiredError extends Error {
  constructor() {
    super('Choose the local collections folder to continue.');
    this.name = 'CollectionSourceRequiredError';
  }
}

export class CollectionSource {
  constructor({ protocol = location.protocol, version = '' } = {}) {
    this.protocol = protocol;
    this.version = version;
    this.files = null;
    this.directoryHandle = null;
    this.cache = new Map();
    this.workspaces = new Map();
  }

  get requiresSelection() { return this.protocol === 'file:' && !this.files && !this.directoryHandle; }
  get usesLocalFiles() { return Boolean(this.files || this.directoryHandle); }
  get isReady() { return !this.requiresSelection; }
  get label() { return this.directoryHandle?.name || (this.files ? 'collections' : 'data/collections'); }

  clear() {
    this.cache.forEach((dataset) => dataset.release?.());
    this.cache.clear();
    this.workspaces.clear();
  }

  selectFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) throw new CollectionSourceRequiredError();
    this.clear();
    this.files = files;
    this.directoryHandle = null;
  }

  selectDirectory(directoryHandle) {
    if (!directoryHandle || directoryHandle.kind !== 'directory') throw new CollectionSourceRequiredError();
    this.clear();
    this.files = null;
    this.directoryHandle = directoryHandle;
  }

  workspaceFor(experienceId) { return this.workspaces.get(experienceId) || null; }

  async loadExperience(experienceId) {
    if (this.cache.has(experienceId)) return this.cache.get(experienceId);
    if (this.requiresSelection) throw new CollectionSourceRequiredError();
    let dataset;
    if (this.directoryHandle) {
      const opened = await openWritableCollectionWorkspace(experienceId, this.directoryHandle);
      dataset = opened.dataset;
      this.workspaces.set(experienceId, opened.workspace);
    } else {
      dataset = this.files
        ? await loadCollectionExperienceFromFiles(experienceId, this.files)
        : await loadCollectionExperience(experienceId, { version: this.version });
    }
    this.cache.set(experienceId, dataset);
    return dataset;
  }
}
