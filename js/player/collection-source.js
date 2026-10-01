import { loadCollectionExperience, loadCollectionExperienceFromFiles } from './collection-data.js';

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
    this.cache = new Map();
  }

  get requiresSelection() { return this.protocol === 'file:' && !this.files; }
  get usesLocalFiles() { return Boolean(this.files); }
  get isReady() { return !this.requiresSelection; }
  get label() { return this.files ? 'collections' : 'data/collections'; }

  clear() {
    this.cache.forEach((dataset) => dataset.release?.());
    this.cache.clear();
  }

  selectFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) throw new CollectionSourceRequiredError();
    this.clear();
    this.files = files;
  }

  async loadExperience(experienceId) {
    if (this.cache.has(experienceId)) return this.cache.get(experienceId);
    if (this.requiresSelection) throw new CollectionSourceRequiredError();
    const dataset = this.files
      ? await loadCollectionExperienceFromFiles(experienceId, this.files)
      : await loadCollectionExperience(experienceId, { version: this.version });
    this.cache.set(experienceId, dataset);
    return dataset;
  }
}
