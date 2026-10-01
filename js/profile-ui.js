import { resizeProfilePhoto } from './profile-store.js';

export class ProfileUI {
  constructor({ store, onSelected, onCreated, onChanged, translate = (key, fallback) => fallback, onInterfaceLanguagePreview = () => {} }) {
    this.store = store;
    this.onSelected = onSelected;
    this.onCreated = onCreated;
    this.onChanged = onChanged;
    this.translate = translate;
    this.onInterfaceLanguagePreview = onInterfaceLanguagePreview;
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
      const interfaceName = profile.interfaceLanguage === 'kn' ? 'ಕನ್ನಡ' : 'English';
      const contentName = profile.contentLanguage === 'kn' ? 'ಕನ್ನಡ' : 'English';
      language.textContent = interfaceName + ' · ' + contentName;
      copy.append(name, language);
      select.appendChild(copy);
      if (profile.pid === defaultPid) {
        const badge = document.createElement('span');
        badge.className = 'default-badge';
        badge.textContent = this.translate('profile.defaultBadge', 'Default');
        select.appendChild(badge);
      }
      const actions = document.createElement('div');
      actions.className = 'profile-card-actions';
      actions.innerHTML = `<button type="button" data-profile-action="edit" data-pid="${profile.pid}">${this.translate('profile.editAction', 'Edit')}</button><button type="button" data-profile-action="default" data-pid="${profile.pid}">${profile.pid === defaultPid ? this.translate('profile.unsetDefault', 'Unset default') : this.translate('profile.makeDefault', 'Make default')}</button><button type="button" data-profile-action="delete" data-pid="${profile.pid}">${this.translate('profile.delete', 'Delete')}</button>`;
      card.append(select, actions);
      list.appendChild(card);
    });
    const selectionTitle = document.getElementById('profile-selection-title');
    selectionTitle.dataset.i18n = switching ? 'profile.switch' : 'profile.who';
    selectionTitle.textContent = switching ? this.translate('profile.switch', 'Switch profile') : this.translate('profile.who', 'Who is using Gitaverse?');
    document.getElementById('profile-selection-back').hidden = !switching;
  }

  async showForm(profile = null, { focusPreferences = false } = {}) {
    this.editingPid = profile?.pid || null;
    this.photo = profile?.photo || '';
    const formTitle = document.getElementById('profile-form-title');
    const formIntro = document.getElementById('profile-form-intro');
    formTitle.dataset.i18n = profile ? 'profile.edit' : 'profile.create';
    formIntro.dataset.i18n = profile ? 'profile.intro.edit' : 'profile.intro.create';
    formTitle.textContent = profile ? this.translate('profile.edit', 'Edit profile') : this.translate('profile.create', 'Create your profile');
    formIntro.textContent = profile
      ? this.translate('profile.intro.edit', 'Keep this profile’s local preferences up to date.')
      : this.translate('profile.intro.create', 'Profiles keep each person’s language and experience separate on this device.');
    document.getElementById('profile-name').value = profile?.name || '';
    document.getElementById('profile-dob').value = profile?.dob || '';
    document.getElementById('profile-gender').value = profile?.gender || '';
    document.getElementById('profile-interface-language').value = profile?.interfaceLanguage || '';
    document.getElementById('profile-content-language').value = profile?.contentLanguage || 'en';
    document.getElementById('profile-default').checked = profile ? (await this.store.defaultPid()) === profile.pid : true;
    document.getElementById('profile-form-cancel').hidden = !profile;
    document.getElementById('profile-form-error').textContent = '';
    this.renderPhotoPreview(profile);
    requestAnimationFrame(() => {
      const target = focusPreferences ? document.getElementById('profile-preferences-section') : document.getElementById('profile-name');
      target?.scrollIntoView({ block: focusPreferences ? 'center' : 'nearest', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    });
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
        if (!document.getElementById('profile-name').value.trim()) throw new Error(this.translate('validation.name', 'Enter a profile name.'));
        const dob = document.getElementById('profile-dob').value;
        if (!dob || new Date(dob + 'T00:00:00') > new Date()) throw new Error(this.translate('validation.dob', 'Enter a valid date of birth.'));
        const interfaceLanguage = document.getElementById('profile-interface-language').value;
        const contentLanguage = document.getElementById('profile-content-language').value;
        if (!interfaceLanguage) throw new Error(this.translate('validation.appLanguage', 'Choose an app language.'));
        if (!contentLanguage) throw new Error(this.translate('validation.contentLanguage', 'Choose a preferred Gita content language.'));
        const profile = await this.store.save({
          pid: this.editingPid,
          name: document.getElementById('profile-name').value,
          dob,
          gender: document.getElementById('profile-gender').value,
          interfaceLanguage,
          contentLanguage,
          photo: this.photo,
          analyticsConsent: true
        });
        if (document.getElementById('profile-default').checked) await this.store.setDefaultPid(profile.pid);
        else if ((await this.store.defaultPid()) === profile.pid) await this.store.setDefaultPid(null);
        if (this.editingPid) await this.onChanged(profile);
        else await this.onCreated(profile);
      } catch (failure) {
        error.textContent = failure.message || this.translate('validation.profileSave', 'The profile could not be saved.');
      }
    });
    document.getElementById('profile-name').addEventListener('input', () => this.renderPhotoPreview());
    document.getElementById('profile-interface-language').addEventListener('change', (event) => {
      const content = document.getElementById('profile-content-language');
      if (!this.editingPid && event.target.value) content.value = event.target.value;
      this.onInterfaceLanguagePreview(event.target.value || 'en');
    });
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
