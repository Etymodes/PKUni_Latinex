const api = require('./api');
const { communityAvatarPresets, defaultCommunityAvatar, isCommunityAvatar, normalizeCommunityAvatar, communityAvatarText } = require('../data/shared');
const current = (page, owner, generation) => page.alive && page.owner === owner && page.generation === generation && ((api.getSession() || {}).user || {}).id === owner;
const profileActions = {
  renderProfile() {
    if (this.profileOwner !== this.owner) {
      this.profileOwner = this.owner;
      this.profileRequested = false;
      this.profileLoadVersion = (this.profileLoadVersion || 0) + 1;
      this.profileDraftVersion = (this.profileDraftVersion || 0) + 1;
      this.savedAvatar = { ...defaultCommunityAvatar };
      this.avatarDraft = { ...defaultCommunityAvatar };
      this.setData({ profileLoading: false, profileSaving: false, profileSaved: false, profileExpired: false, profileErrorKey: '' });
    }
    const avatar = this.avatarDraft || defaultCommunityAvatar;
    this.setData({ avatarKind: avatar.kind, avatarValue: avatar.value, avatarPreview: isCommunityAvatar(avatar) ? communityAvatarText(avatar) : '', avatarValid: isCommunityAvatar(avatar),
      avatarDirty: JSON.stringify(avatar) !== JSON.stringify(this.savedAvatar), profileError: this.data.t[this.data.profileErrorKey] || '',
      avatarPresets: communityAvatarPresets.map(item => ({ id: item.id, emoji: item.emoji, label: this.data.locale === 'en' ? item.en : item.zh })) });
    if (this.data.view === 'account' && this.owner && !this.profileRequested) { this.profileRequested = true; this.loadProfile(); }
  },
  profileFailed(owner, generation, errorKey) {
    if (!this.alive || this.owner !== owner || this.generation !== generation) return;
    const session = api.getSession();
    if (session && session.user.id !== owner) return;
    this.setData({ profileLoading: false, profileSaving: false, profileExpired: !session, profileErrorKey: session ? errorKey : 'avatarSessionExpired' });
    this.renderProfile();
  },
  async loadProfile() {
    const owner = this.owner, generation = this.generation;
    if (!owner || !current(this, owner, generation)) return;
    const version = this.profileLoadVersion = (this.profileLoadVersion || 0) + 1;
    const draftVersion = this.profileDraftVersion;
    this.setData({ profileLoading: true, profileErrorKey: '', profileError: '' });
    try {
      const result = await api.request('/api/community/profile');
      if (!current(this, owner, generation) || version !== this.profileLoadVersion) return;
      if (!isCommunityAvatar(result && result.avatar)) throw new Error('Invalid avatar response');
      this.savedAvatar = normalizeCommunityAvatar(result.avatar);
      if (draftVersion === this.profileDraftVersion) this.avatarDraft = normalizeCommunityAvatar(result.avatar);
    } catch (_) {
      if (version === this.profileLoadVersion) this.profileFailed(owner, generation, 'avatarLoadError');
    } finally {
      if (current(this, owner, generation) && version === this.profileLoadVersion) { this.setData({ profileLoading: false }); this.renderProfile(); }
    }
  },
  changeAvatarKind(event) {
    if (!this.owner || this.data.profileSaving || this.data.profileExpired) return;
    const kind = event.currentTarget.dataset.kind;
    if (!['initials', 'preset'].includes(kind)) return;
    this.avatarDraft = kind === 'initials' ? { kind, value: 'A' } : { ...defaultCommunityAvatar };
    this.profileDraftVersion = (this.profileDraftVersion || 0) + 1;
    this.setData({ profileSaved: false, profileErrorKey: '' });
    this.renderProfile();
  },
  inputAvatar(event) {
    if (!this.owner || this.data.profileSaving || this.data.profileExpired) return;
    this.avatarDraft = { kind: 'initials', value: event.detail.value };
    this.profileDraftVersion = (this.profileDraftVersion || 0) + 1;
    this.setData({ profileSaved: false, profileErrorKey: '' }); this.renderProfile();
  },
  selectAvatarPreset(event) {
    if (!this.owner || this.data.profileSaving || this.data.profileExpired) return;
    const avatar = { kind: 'preset', value: event.currentTarget.dataset.id };
    if (!isCommunityAvatar(avatar)) return;
    this.avatarDraft = avatar;
    this.profileDraftVersion = (this.profileDraftVersion || 0) + 1;
    this.setData({ profileSaved: false, profileErrorKey: '' }); this.renderProfile();
  },
  async saveAvatar() {
    const owner = this.owner, generation = this.generation;
    if (!owner || this.data.profileSaving || !isCommunityAvatar(this.avatarDraft) || !current(this, owner, generation)) return;
    const avatar = { ...this.avatarDraft };
    this.profileLoadVersion = (this.profileLoadVersion || 0) + 1;
    this.setData({ profileSaving: true, profileLoading: false, profileSaved: false, profileErrorKey: '', profileError: '' });
    try {
      const result = await api.request('/api/community/profile', 'PUT', { avatar });
      if (!current(this, owner, generation)) return;
      if (!isCommunityAvatar(result && result.avatar) || result.avatar.kind !== avatar.kind || result.avatar.value !== avatar.value) throw new Error('Invalid avatar receipt');
      this.savedAvatar = normalizeCommunityAvatar(result.avatar);
      this.setData({ profileSaved: true });
    } catch (_) { this.profileFailed(owner, generation, 'avatarSaveError'); }
    finally { if (current(this, owner, generation)) { this.setData({ profileSaving: false }); this.renderProfile(); } }
  },
};
module.exports = { profileActions };
