const api = require('./api');
const { normalizeCommunityAvatar, communityAvatarText } = require('../data/shared');
let sequence = 0;
const supported = language => language === 'la' || language === 'ja';
const roomKey = page => `${page.owner || 'guest'}:${page.data.language}:${page.data.communityChannel || 'language'}`;
const current = (page, key, generation) => page.alive && page.data.view === 'community' && roomKey(page) === key && page.generation === generation && ((api.getSession() || {}).user || {}).id === (page.owner || undefined);
function messageRows(value) {
  if (!Array.isArray(value)) throw new Error('Invalid community response');
  return value.filter(item => item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.authorName === 'string')
    .map(item => ({ id: item.id, text: item.text, authorName: item.authorName, mine: item.mine === true, avatar: normalizeCommunityAvatar(item.avatar), createdAt: item.createdAt, detectedLanguage: item.detectedLanguage }));
}
const communityActions = {
  stopCommunity() {
    if (this.communityTimer) clearTimeout(this.communityTimer);
    this.communityTimer = null;
    this.communityPollKey = null;
    this.communityLoadVersion = (this.communityLoadVersion || 0) + 1;
  },
  updateCommunityPolling() {
    const enabled = supported(this.data.language);
    this.setData({ communityEnabled: enabled });
    if (!this.visible || this.data.view !== 'community' || !enabled) { this.stopCommunity(); return; }
    const key = roomKey(this);
    if (this.communityPollKey === key) { this.renderCommunity(); return; }
    this.stopCommunity();
    this.communityPollKey = key;
    if (this.communityRoomKey !== key) {
      this.communityRoomKey = key;
      this.communityMessages = [];
      this.communityTranslations = {};
      this.setData({ communityItems: [], communityDraft: '', communityWarnings: 0, communityMutedUntil: '', communityError: '', communityErrorKey: '', communityAiAvailable: null, communitySending: false, communityTranslating: '' });
    }
    const poll = async () => {
      await this.loadCommunity();
      if (this.visible && this.communityPollKey === key && this.data.view === 'community') this.communityTimer = setTimeout(poll, 10000);
    };
    poll();
  },
  setCommunityError(key) { this.setData({ communityErrorKey: key, communityError: this.data.t[key] || '' }); },
  renderCommunity() {
    const mutedUntil = this.data.communityMutedUntil;
    const muted = this.data.communityChannel !== 'study' && Date.parse(mutedUntil) > Date.now();
    this.setData({ communityError: this.data.t[this.data.communityErrorKey] || '', communityMuted: muted, communityMuteLabel: muted ? new Date(mutedUntil).toLocaleTimeString(this.data.locale === 'en' ? 'en-US' : 'zh-CN') : '',
      communityItems: (this.communityMessages || []).map(item => ({ ...item, avatarText: communityAvatarText(item.avatar), translation: ((this.communityTranslations || {})[item.id] || {})[this.data.locale] || '' })) });
  },
  async loadCommunity() {
    if (this.data.view !== 'community' || !supported(this.data.language)) return;
    const key = roomKey(this), generation = this.generation;
    const version = this.communityLoadVersion = (this.communityLoadVersion || 0) + 1;
    this.setData({ communityLoading: true });
    try {
      const result = await api.request(`/api/community?language=${this.data.language}&channel=${this.data.communityChannel || 'language'}`);
      if (!current(this, key, generation) || version !== this.communityLoadVersion) return;
      this.communityMessages = messageRows(result.messages);
      this.setData({ communityWarnings: result.warnings || 0, communityMutedUntil: result.mutedUntil || '', communityAiAvailable: result.aiAvailable === true, communityError: '', communityErrorKey: '' });
      this.renderCommunity();
    } catch (failure) {
      if (current(this, key, generation) && version === this.communityLoadVersion) this.setCommunityError('communityLoadError');
    } finally {
      if (current(this, key, generation) && version === this.communityLoadVersion) this.setData({ communityLoading: false });
    }
  },
  changeCommunityChannel(event) {
    const channel = event.currentTarget.dataset.channel;
    if (!['language', 'study'].includes(channel)) return;
    this.setData({ communityChannel: channel });
    this.updateCommunityPolling();
  },
  inputCommunity(event) { this.setData({ communityDraft: event.detail.value }); },
  async sendCommunity() {
    if (this.data.communitySending || !this.owner || !supported(this.data.language) || this.data.view !== 'community') return;
    this.renderCommunity();
    if (this.data.communityMuted) return;
    const text = this.data.communityDraft.normalize('NFC').trim();
    if (!text || [...text].length > 1000) { this.setCommunityError('communityTextLimit'); return; }
    const key = roomKey(this), generation = this.generation;
    if (!current(this, key, generation)) return;
    const old = this.communityPending;
    const pending = old && old.key === key && old.text === text ? old : { key, text, id: `mini-chat-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}` };
    this.communityPending = pending;
    this.setData({ communitySending: true, communityError: '', communityErrorKey: '' });
    try {
      const result = await api.request('/api/community/messages', 'POST', { language: this.data.language, channel: this.data.communityChannel || 'language', text, clientId: pending.id });
      if (!current(this, key, generation)) return;
      if (!Object.prototype.hasOwnProperty.call(result || {}, 'message')) throw new Error('Invalid send receipt');
      this.communityPending = null;
      this.setData({ communityDraft: '', communityWarnings: result.warnings || 0, communityMutedUntil: result.mutedUntil || '' });
      await this.loadCommunity();
    } catch (failure) {
      if (!current(this, key, generation)) return;
      const detail = failure.details || {}, code = detail.error;
      if (['language_warning', 'muted', 'client_id_conflict'].includes(code)) this.communityPending = null;
      const messages = { language_warning: 'communityWarning', muted: 'communityMute', language_check_unavailable: 'communityAiError', rate_limited: 'communityRateLimit', client_id_conflict: 'communityRetry' };
      const update = { communityErrorKey: messages[code] || 'communitySendError' };
      if (Number.isInteger(detail.warnings)) update.communityWarnings = detail.warnings;
      if (detail.mutedUntil) update.communityMutedUntil = detail.mutedUntil;
      this.setData(update);
      this.renderCommunity();
    } finally { if (current(this, key, generation)) this.setData({ communitySending: false }); }
  },
  async translateCommunity(event) {
    if (!this.owner || this.data.communityTranslating) return;
    const id = event.currentTarget.dataset.id, key = roomKey(this), generation = this.generation, locale = this.data.locale;
    if (!(this.communityMessages || []).some(item => item.id === id && !item.mine) || !current(this, key, generation)) return;
    this.setData({ communityTranslating: id, communityError: '', communityErrorKey: '' });
    try {
      const result = await api.request(`/api/community/messages/${id}/translate`, 'POST', { locale });
      if (!current(this, key, generation)) return;
      if (typeof result.translation !== 'string' || !result.translation.trim()) throw new Error('Invalid translation');
      this.communityTranslations = this.communityTranslations || {};
      this.communityTranslations[id] = { ...this.communityTranslations[id], [locale]: result.translation };
      this.renderCommunity();
    } catch (_) { if (current(this, key, generation)) this.setCommunityError('communityTranslationError'); }
    finally { if (current(this, key, generation)) this.setData({ communityTranslating: '' }); }
  },
  async moderateCommunity(event) {
    if (!this.owner) return;
    const { id, action } = event.currentTarget.dataset;
    const item = (this.communityMessages || []).find(row => row.id === id);
    if (!item || !['delete', 'report'].includes(action) || (action === 'delete' && !item.mine)) return;
    const key = roomKey(this), generation = this.generation;
    const confirmed = await new Promise(resolve => wx.showModal({ title: this.data.t[action === 'delete' ? 'communityDelete' : 'communityReport'], content: this.data.t.communityConfirm, success: value => resolve(value.confirm), fail: () => resolve(false) }));
    if (!confirmed || !current(this, key, generation)) return;
    try {
      await api.request(`/api/community/messages/${id}${action === 'report' ? '/report' : ''}`, action === 'report' ? 'POST' : 'DELETE', action === 'report' ? { reason: 'User reports inappropriate content' } : undefined);
      if (!current(this, key, generation)) return;
      if (action === 'delete') await this.loadCommunity();
      else wx.showToast({ title: this.data.t.communityReported, icon: 'none' });
    } catch (_) { if (current(this, key, generation)) this.setCommunityError('communityLoadError'); }
  },
};
module.exports = { communityActions };
