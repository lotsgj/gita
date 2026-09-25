import { serializeMaster } from './master-data.js';

export class InlineEditor {
  constructor({ dataset, renderer, currentRow, rerender, onStateChange }) {
    this.dataset = dataset;
    this.renderer = renderer;
    this.currentRow = currentRow;
    this.rerender = rerender;
    this.onStateChange = onStateChange || (() => {});
    this.active = false;
    this.dirty = false;
    this.savedChanges = false;
    this.pendingDownload = false;
    this.savedRevision = 0;
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
      '<span class="edit-status">Edit the four visible fields</span>' +
      '<button class="cancel-edit" type="button">Cancel</button>' +
      '<button class="save-edit" type="button">Save row</button>';
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

  toggle() {
    if (!this.active) this.enter();
    else if (!this.dirty || this.save()) {
      this.exit();
      this.rerender();
    }
  }

  handleInput(event) {
    this.dirty = true;
    const invalid = event.currentTarget.innerText.includes('#');
    event.currentTarget.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    this.toolbar.querySelector('.edit-status').textContent = invalid
      ? 'Remove # before saving'
      : 'Unsaved changes';
    this.updateUi();
  }

  save() {
    if (!this.active) return true;
    const elements = this.renderer.editableElements();
    const invalid = elements.find((element) => element.innerText.includes('#'));
    if (invalid) {
      invalid.focus();
      this.toolbar.querySelector('.edit-status').textContent = 'Remove # before saving';
      return false;
    }
    const row = this.currentRow();
    elements.forEach((element) => {
      row[element.dataset.editField] = element.innerText.replace(/\r/g, '').replace(/\n$/, '');
      element.setAttribute('aria-invalid', 'false');
    });
    this.dirty = false;
    this.savedChanges = true;
    this.pendingDownload = true;
    this.savedRevision += 1;
    this.toolbar.querySelector('.edit-status').textContent = 'Saved in this browser session';
    this.rerender({ keepEditing: true });
    this.updateUi();
    return true;
  }

  cancel() {
    if (this.dirty && !window.confirm('Discard the unsaved edits to this shloka?')) return false;
    this.dirty = false;
    this.exit();
    this.rerender();
    return true;
  }

  canNavigate() {
    if (!this.active || !this.dirty) return true;
    if (!window.confirm('Discard the unsaved edits to this shloka and continue?')) return false;
    this.dirty = false;
    this.exit();
    return true;
  }

  download() {
    if (this.dirty && !this.save()) return;
    const blob = new Blob([serializeMaster(this.dataset)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'master.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    this.pendingDownload = false;
    this.toolbar.querySelector('.edit-status').textContent = 'Downloaded master.csv';
    this.updateUi();
  }

  updateUi() {
    this.toolbar.querySelector('.save-edit').disabled = !this.dirty;
    this.onStateChange({
      active: this.active,
      dirty: this.dirty,
      savedChanges: this.savedChanges,
      pendingDownload: this.pendingDownload,
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
