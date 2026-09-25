import { resizeProfilePhoto } from './profile-store.js';

export class ProfileUI {
  constructor({ store, onSelected, onCreated, onChanged }) {
    this.store = store;
    this.onSelected = onSelected;
    this.onCreated = onCreated;
    this.onChanged = onChanged;
    this.editingPid = null;
    this.photo = '';
    this.bind();
  }

  initials(profile) {
    return profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ॐ';
  }

  avatar(profile, className = 'profile-avatar') {
    if (profile.photo) {
      const image = document.createElement('img');
      image.className = className;
      image.src = profile.photo;
      image.alt = '';
      return image;
    }
    const fallback = document.createElement('span');
    fallback.className = className + ' profile-initials';
    fallback.textContent = this.initials(profile);
    return fallback;
  }

  async showSelection({ switching = false } = {}) {
    const profiles = await this.store.list();
    const defaultPid = await this.store.defaultPid();
    const list = document.getElementById('profile-list');
    list.textContent = '';
    profiles.forEach((profile) => {
      const card = document.createElement('article');
      card.className = 'profile-card';
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'profile-select';
      select.dataset.pid = profile.pid;
      select.appendChild(this.avatar(profile, 'profile-card-avatar'));
      const copy = document.createElement('span');
      copy.className = 'profile-card-copy';
      const name = document.createElement('strong');
      name.textContent = profile.name;
      const language = document.createElement('small');
      language.textContent = profile.language === 'kn' ? 'ಕನ್ನಡ' : 'English';
      copy.append(name, language);
      select.appendChild(copy);
      if (profile.pid === defaultPid) {
        const badge = document.createElement('span');
        badge.className = 'default-badge';
        badge.textContent = 'Default';
        select.appendChild(badge);
      }
      const actions = document.createElement('div');
      actions.className = 'profile-card-actions';
      actions.innerHTML = `<button type="button" data-profile-action="edit" data-pid="${profile.pid}">Edit</button><button type="button" data-profile-action="default" data-pid="${profile.pid}">${profile.pid === defaultPid ? 'Unset default' : 'Make default'}</button><button type="button" data-profile-action="delete" data-pid="${profile.pid}">Delete</button>`;
      card.append(select, actions);
      list.appendChild(card);
    });
    document.getElementById('profile-selection-title').textContent = switching ? 'Switch profile' : 'Who is using Gitaverse?';
    document.getElementById('profile-selection-back').hidden = !switching;
  }

  async showForm(profile = null) {
    this.editingPid = profile?.pid || null;
    this.photo = profile?.photo || '';
    document.getElementById('profile-form-title').textContent = profile ? 'Edit profile' : 'Create your profile';
    document.getElementById('profile-form-intro').textContent = profile
      ? 'Keep this profile’s local preferences up to date.'
      : 'Profiles keep each person’s language and experience separate on this device.';
    document.getElementById('profile-name').value = profile?.name || '';
    document.getElementById('profile-dob').value = profile?.dob || '';
    document.getElementById('profile-gender').value = profile?.gender || '';
    document.getElementById('profile-language').value = profile?.language || 'en';
    document.getElementById('profile-default').checked = profile ? (await this.store.defaultPid()) === profile.pid : true;
    document.getElementById('profile-form-cancel').hidden = !profile;
    document.getElementById('profile-form-error').textContent = '';
    this.renderPhotoPreview(profile);
  }

  renderPhotoPreview(profile = null) {
    const preview = document.getElementById('profile-photo-preview');
    preview.textContent = '';
    preview.appendChild(this.avatar({ name: document.getElementById('profile-name').value || profile?.name || '', photo: this.photo }, 'profile-photo-avatar'));
    document.getElementById('profile-photo-remove').hidden = !this.photo;
  }

  async renderPills(profile) {
    document.querySelectorAll('[data-profile-pill]').forEach((button) => {
      button.textContent = '';
      button.appendChild(this.avatar(profile, 'profile-pill-avatar'));
      const name = document.createElement('span');
      name.textContent = profile.name;
      button.appendChild(name);
      button.dataset.pid = profile.pid;
      button.setAttribute('aria-label', 'Profile: ' + profile.name + '. Open profile options.');
    });
  }

  bind() {
    document.getElementById('profile-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('profile-form-error');
      error.textContent = '';
      try {
        const dob = document.getElementById('profile-dob').value;
        if (!dob || new Date(dob + 'T00:00:00') > new Date()) throw new Error('Enter a valid date of birth.');
        const profile = await this.store.save({
          pid: this.editingPid,
          name: document.getElementById('profile-name').value,
          dob,
          gender: document.getElementById('profile-gender').value,
          language: document.getElementById('profile-language').value,
          photo: this.photo,
          analyticsConsent: true
        });
        if (document.getElementById('profile-default').checked) await this.store.setDefaultPid(profile.pid);
        else if ((await this.store.defaultPid()) === profile.pid) await this.store.setDefaultPid(null);
        if (this.editingPid) await this.onChanged(profile);
        else await this.onCreated(profile);
      } catch (failure) {
        error.textContent = failure.message || 'The profile could not be saved.';
      }
    });
    document.getElementById('profile-name').addEventListener('input', () => this.renderPhotoPreview());
    document.getElementById('profile-photo').addEventListener('change', async (event) => {
      const error = document.getElementById('profile-form-error');
      try {
        this.photo = await resizeProfilePhoto(event.target.files?.[0]);
        this.renderPhotoPreview();
      } catch (failure) { error.textContent = failure.message; }
    });
    document.getElementById('profile-photo-remove').addEventListener('click', () => {
      this.photo = '';
      document.getElementById('profile-photo').value = '';
      this.renderPhotoPreview();
    });
    document.getElementById('profile-list').addEventListener('click', async (event) => {
      const select = event.target.closest('.profile-select');
      if (select) return this.onSelected(await this.store.get(select.dataset.pid));
      const action = event.target.closest('[data-profile-action]');
      if (!action) return;
      const profile = await this.store.get(action.dataset.pid);
      if (action.dataset.profileAction === 'edit') return this.onChanged(profile, { edit: true });
      if (action.dataset.profileAction === 'default') {
        const current = await this.store.defaultPid();
        await this.store.setDefaultPid(current === profile.pid ? null : profile.pid);
        return this.showSelection({ switching: true });
      }
      if (action.dataset.profileAction === 'delete' && window.confirm('Delete the profile “' + profile.name + '” from this device?')) {
        await this.store.remove(profile.pid);
        const remaining = await this.store.list();
        if (!remaining.length) return this.onChanged(null, { setup: true });
        return this.onChanged(null, { deletedPid: profile.pid, remaining });
      }
    });
  }
}
