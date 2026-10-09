import { serializeLanguageMaster } from './collection-data.js';

export class InlineEditor {
  constructor({ dataset, renderer, currentRow, rerender, workspace = null, onStateChange, translate = (key, fallback) => fallback }) {
    this.dataset = dataset;
    this.renderer = renderer;
    this.currentRow = currentRow;
    this.rerender = rerender;
    this.onStateChange = onStateChange || (() => {});
    this.workspace = workspace;
    this.translate = translate;
    this.active = false;
    this.dirty = false;
    this.savedChanges = false;
    this.pendingDownload = false;
    this.savedRevision = 0;
    this.changedLanguages = new Set();
    this.toolbar = this.createToolbar();
    this.handleInput = this.handleInput.bind(this);
    this.beforeUnload = this.beforeUnload.bind(this);
    window.addEventListener('beforeunload', this.beforeUnload);
  }

  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'edit-toolbar';
    toolbar.hidden = true;
    toolbar.innerHTML =
      '<span class="edit-status">' + this.translate('editor.editVisible', 'Edit the visible fields') + '</span>' +
      '<button class="cancel-edit" type="button">' + this.translate('editor.cancel', 'Cancel') + '</button>' +
      '<button class="save-edit" type="button">' + this.translate('editor.save', 'Save row') + '</button>';
    document.body.appendChild(toolbar);
    toolbar.querySelector('.cancel-edit').addEventListener('click', () => this.cancel());
    toolbar.querySelector('.save-edit').addEventListener('click', () => this.save());
    return toolbar;
  }

  enter() {
    if (this.active) return;
    this.active = true;
    this.dirty = false;
    document.body.classList.add('editing');
    this.toolbar.hidden = false;
    this.renderer.setEditing(true);
    this.renderer.editableElements().forEach((element) => element.addEventListener('input', this.handleInput));
    const first = this.renderer.editableElements()[0];
    if (first) first.focus();
    this.updateUi();
  }

  exit() {
    if (!this.active) return;
    this.renderer.editableElements().forEach((element) => element.removeEventListener('input', this.handleInput));
    this.active = false;
    this.dirty = false;
    document.body.classList.remove('editing');
    this.toolbar.hidden = true;
    this.renderer.setEditing(false);
    this.updateUi();
  }

  async toggle() {
    if (!this.active) this.enter();
    else if (!this.dirty || await this.save()) {
      this.exit();
      this.rerender();
    }
  }

  handleInput(event) {
    this.dirty = true;
    const invalid = event.currentTarget.innerText.includes('#');
    event.currentTarget.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    this.toolbar.querySelector('.edit-status').textContent = invalid
      ? this.translate('editor.removeHash', 'Remove # before saving')
      : this.translate('editor.unsaved', 'Unsaved changes');
    this.updateUi();
  }

  async save() {
    if (!this.active) return true;
    const elements = this.renderer.editableElements();
    const invalid = elements.find((element) => element.innerText.includes('#'));
    if (invalid) {
      invalid.focus();
      this.toolbar.querySelector('.edit-status').textContent = this.translate('editor.removeHash', 'Remove # before saving');
      return false;
    }
    const row = this.currentRow();
    const changes = [];
    const languages = new Set();
    elements.forEach((element) => {
      const field = element.dataset.editField;
      const parts = field.split('.');
      const property = parts.pop();
      const target = parts.reduce((value, part) => value[part], row);
      const value = element.innerText.replace(/\r/g, '').replace(/\n$/, '');
      const displayedTarget = String(target[property] ?? '').replace(/\r/g, '').replace(/\n$/, '');
      if (displayedTarget !== value) {
        changes.push({ target, property, previous: target[property], value });
        target[property] = value;
        languages.add(field.startsWith('source.') ? 'sa' : field.split('.')[1]);
      }
      element.setAttribute('aria-invalid', 'false');
    });
    if (!changes.length) {
      this.dirty = false;
      this.toolbar.querySelector('.edit-status').textContent = this.translate('editor.noChanges', 'No changes to save');
      this.updateUi();
      return true;
    }
    const saveButton = this.toolbar.querySelector('.save-edit');
    saveButton.disabled = true;
    this.toolbar.querySelector('.edit-status').textContent = this.workspace ? this.translate('editor.savingFiles', 'Saving to collections…') : this.translate('editor.savingBrowser', 'Saving in this browser…');
    try {
      let savedFiles = [];
      if (this.workspace) savedFiles = await this.workspace.saveLanguageMasters(this.dataset, languages);
      languages.forEach((language) => this.changedLanguages.add(language));
      this.dirty = false;
      this.savedChanges = true;
      this.pendingDownload = !this.workspace;
      this.savedRevision += 1;
      this.toolbar.querySelector('.edit-status').textContent = this.workspace
        ? this.translate('editor.savedFiles', 'Saved to {files}', { files: savedFiles.join(' and ') })
        : this.translate('editor.savedBrowser', 'Saved in this browser session');
      this.rerender({ keepEditing: true });
      this.updateUi();
      return true;
    } catch (error) {
      changes.forEach(({ target, property, previous }) => { target[property] = previous; });
      this.toolbar.querySelector('.edit-status').textContent = error.message || this.translate('editor.saveFailed', 'The local collections could not be saved.');
      this.dirty = true;
      this.updateUi();
      return false;
    }
  }

  cancel() {
    if (this.dirty && !window.confirm(this.translate('editor.discard', 'Discard the unsaved edits to this shloka?'))) return false;
    this.dirty = false;
    this.exit();
    this.rerender();
    return true;
  }

  canNavigate() {
    if (!this.active || !this.dirty) return true;
    if (!window.confirm(this.translate('editor.discardNavigate', 'Discard the unsaved edits to this shloka and continue?'))) return false;
    this.dirty = false;
    this.exit();
    return true;
  }

  async download() {
    if (this.dirty && !await this.save()) return;
    Array.from(this.changedLanguages).sort().forEach((language) => {
      const blob = new Blob([serializeLanguageMaster(this.dataset, language)], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = 'master_' + language + '.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
    this.pendingDownload = false;
    this.toolbar.querySelector('.edit-status').textContent = this.translate('editor.downloaded', 'Downloaded edited language data');
    this.updateUi();
  }

  updateUi() {
    this.toolbar.querySelector('.save-edit').disabled = !this.dirty;
    this.onStateChange({
      active: this.active,
      dirty: this.dirty,
      savedChanges: this.savedChanges,
      pendingDownload: this.pendingDownload,
      workspace: Boolean(this.workspace),
      savedRevision: this.savedRevision
    });
  }

  beforeUnload(event) {
    if (!this.dirty && !this.pendingDownload) return;
    event.preventDefault();
    event.returnValue = '';
  }

  destroy() {
    window.removeEventListener('beforeunload', this.beforeUnload);
    document.body.classList.remove('editing');
    this.toolbar.remove();
  }
}
