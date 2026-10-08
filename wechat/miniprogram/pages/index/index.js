const api = require('../../lib/api');
const { communityActions } = require('../../lib/community');
const { profileActions } = require('../../lib/profile');
const { studyActions } = require('../../lib/study-modes');
const vocabulary = require('../../lib/vocabulary');
const { vocabularyActions } = require('../../lib/vocabulary-page');
const bank = require('../../data/bank');
const shared = require('../../data/shared');
const { contentText } = require('../../data/content-locale');
const { copies, levelCards } = require('../../lib/copy');
const { questionCategories, questionScope, questionActions } = require('../../lib/questions');
const GUEST_KEY = 'pikku-mini-guest-v1';
const LOCALE_KEY = 'pikku-mini-locale-v1';
const categories = questionCategories;

function emptyRecord() {
  return { progress: {}, bookmarks: [], vocab: {}, preference: { language: 'la', level: 'C', vocabMode: 'context' } };
}
function readGuest() {
  const saved = wx.getStorageSync(GUEST_KEY);
  return saved && saved.progress && Array.isArray(saved.bookmarks) && saved.vocab && saved.preference ? saved : emptyRecord();
}
function fromCloud(result) {
  const record = emptyRecord();
  record.progress = result.progress || {};
  record.bookmarks = Array.isArray(result.bookmarks) ? result.bookmarks : [];
  for (const row of result.vocab || []) {
    record.vocab[shared.vocabularyKey(row.language, row.lemma)] = { seen: Number(row.seen) || 0, correct: Number(row.correct) || 0 };
  }
  if (result.preference && bank.languageConfigs[result.preference.language]) record.preference = result.preference;
  return record;
}

Page({
  ...vocabularyActions,
  ...communityActions,
  ...profileActions,
  ...studyActions,
  ...questionActions,
  data: {
    locale: 'zh-CN', t: copies['zh-CN'], view: 'home', level: 'C', language: 'la', vocabMode: 'context',
    busy: false, user: null, sync: 'guest', error: '', email: '', password: '', question: null, card: null,
    paperSearch: '', wordQuery: '', dictionaryQuery: '', dictionaryOffset: 0, showModel: false, showSupport: false,
    reviewScope: false, filter: 'all', category: 'all', search: '', browse: false, revealed: false, submitted: false, wordRevealed: false,
    communityChannel: 'language', communityDraft: '', communityItems: [], communityWarnings: 0, communityMutedUntil: '', communityLoading: false, communitySending: false,
    examActive: false, examFinished: false, examMixed: false, examFormat: 'quick', examProfile: '', examIsJlpt: false, measurementItems: [], measurementDone: false, measurementReady: false, browseLimit: 40,
    choices: [], selected: -1, answerCorrect: false, questionIndex: 0, questionTotal: 0,
  },
  onLoad() {
    this.alive = true;
    this.visible = false;
    this.generation = 0;
    this.owner = null;
    this.record = readGuest();
    this.initVocabulary();
    this.questions = bank.questions;
    this.recentWords = [];
    const locale = wx.getStorageSync(LOCALE_KEY) === 'en' ? 'en' : 'zh-CN';
    this.setData({ locale, t: copies[locale] });
    this.applyPreference();
    this.refresh();
  },
  onHide() { this.visible = false; this.stopQuestionAudio(); this.stopCommunity(); this.stopExamClock(); },
  onUnload() { this.visible = false; this.stopCommunity(); this.stopExamClock(); this.destroyQuestionAudio(); this.alive = false; this.generation++; },
  onShow() {
    this.visible = true;
    this.updateCommunityPolling();
    this.tickExamClock();
    if (this.shown && !this.data.busy) this.refresh();
    this.shown = true;
  },
  async onPullDownRefresh() {
    try { await this.refresh(); } finally { wx.stopPullDownRefresh(); }
  },
  async perform(action) {
    if (this.data.busy) return;
    const generation = this.generation;
    this.setData({ busy: true, error: '' });
    try { await action(); }
    catch (error) {
      if (this.alive && generation === this.generation) {
        if (this.owner && !api.getSession()) {
          this.owner = null;
          this.resetStudyModes();
          this.stopCommunity();
          this.record = readGuest();
          this.initVocabulary();
          this.stopQuestionAudio();
          this.queue = [];
          this.setData({ user: null, question: null, card: null });
          this.applyPreference();
        }
        this.setData({ error: this.data.t.syncError, sync: api.getSession() ? 'failed' : 'guest' });
        wx.showToast({ title: error.status === 400 || error.status === 401 ? (this.data.locale === 'en' ? 'Check sign-in details' : '请检查账号、密码及邮箱验证状态') : this.data.t.syncError, icon: 'none' });
      }
    } finally {
      if (this.alive && generation === this.generation) this.setData({ busy: false });
    }
  },
  async refresh() {
    return this.perform(async () => {
      const session = api.getSession();
      const owner = session ? session.user.id : null;
      if (owner !== this.owner) {
        this.owner = owner;
        this.resetStudyModes();
        this.stopCommunity();
        this.record = owner ? emptyRecord() : readGuest();
        this.initVocabulary();
        this.stopQuestionAudio();
        this.queue = [];
        this.setData({ question: null, card: null });
        this.applyPreference();
      }
      this.setData({ user: session ? session.user : null, sync: owner ? 'loading' : 'guest' });
      const results = await Promise.allSettled([api.getOverrides(), owner ? vocabulary.sync(owner) : Promise.resolve(null)]);
      if (!this.alive || owner !== this.owner) return;
      if (results[0].status === 'fulfilled') {
        const overrides = results[0].value.overrides || [];
        const version = JSON.stringify(overrides);
        this.questions = shared.mergeQuestionOverrides(bank.questions, overrides);
        if (this.overrideVersion !== version) {
          if (this.data.examActive) this.finishExam();
          this.stopQuestionAudio();
          this.queue = [];
          this.setData({ question: null });
        }
        this.overrideVersion = version;
      }
      if (owner && results[1].status === 'fulfilled') {
        this.wordMemory = results[1].value.memory;
        this.record = fromCloud(results[1].value.cloud);
        this.record.vocab = this.wordMemory.stats;
        this.setData({ sync: 'synced' });
      } else if (owner) {
        throw results[1].reason;
      }
      this.applyPreference();
      if (results[0].status === 'rejected') this.setData({ error: this.data.t.syncError });
    });
  },
  applyPreference() {
    const pref = this.record.preference;
    const available = bank.learningLanguages.filter(item => item.id !== (this.data.locale === 'en' ? 'en-us' : 'zh-mandarin'));
    const language = available.some(item => item.id === pref.language) ? pref.language : 'la';
    const level = shared.normalizePikkuLevel(language, pref.level);
    const vocabMode = pref.vocabMode === 'word' ? 'word' : 'context';
    if (language !== this.data.language) this.setData({ dictionaryQuery: '', dictionaryOffset: 0, dictionaryEntryId: '', dictionaryField: 'all', dictionaryOrder: language === 'ja' ? 'reading' : 'headword', dictionaryIndex: 'all', dictionaryLevel: 'all', dictionaryPartOfSpeech: 'all' });
    if (language !== this.data.language || level !== this.data.level || vocabMode !== this.data.vocabMode) {
      this.stopQuestionAudio();
      this.wordSelection = null;
      this.resetStudyModes();
      this.stopCommunity();
      this.queue = [];
      this.setData({ question: null, card: null, fullPaper: false });
    }
    this.setData({ language, level, vocabMode });
    this.render();
    if (this.data.view === 'words' && !this.data.card) this.nextCard();
  },
  render() {
    const { locale, language, level, filter, category, search } = this.data;
    const t = copies[locale];
    const available = bank.learningLanguages.filter(item => item.id !== (locale === 'en' ? 'en-us' : 'zh-mandarin'));
    const languageInfo = bank.learningLanguages.find(item => item.id === language);
    const all = this.questions.filter(q => (q.language || 'la') === language);
    const selection = questionScope(all, this.data, this.record);
    this.range = selection.range;
    this.filtered = selection.filtered;
    const collectionIds = new Set(all.flatMap(q => (q.occurrences || []).map(item => item.collectionId)));
    const paperItems = bank.questionCollections.filter(item => collectionIds.has(item.id)).map(item => ({ id: item.id, label: locale === 'en' ? item.en : item.zh }));
    const paperSearch = (this.data.paperSearch || '').trim().toLowerCase();
    const matchingPapers = paperItems.filter(item => {
      const original = bank.questionCollections.find(source => source.id === item.id);
      return !paperSearch || [item.id, original.zh, original.en].join(' ').toLowerCase().includes(paperSearch);
    });
    const answered = all.filter(q => this.record.progress[q.id]);
    const rows = Object.entries(this.record.vocab).filter(([key]) => key.startsWith(language + ':'));
    this.setData({
      t, levels: levelCards(locale), languageInfo,
      reviewWrongCount: all.filter(q => ['wrong', 'review'].includes(this.record.progress[q.id])).length, reviewSavedCount: all.filter(q => this.record.bookmarks.includes(q.id)).length,
      languageLabel: languageInfo.labels[locale], greeting: languageInfo.greeting,
      factStatement: languageInfo.fact.statement, factMeaning: languageInfo.fact.meaning[locale],
      languages: available.map(item => ({ id: item.id, label: item.nativeName + ' · ' + item.labels[locale] })),
      languageIndex: available.findIndex(item => item.id === language),
      categoryItems: categories.map(id => ({ id, label: t.categories[id] })), categoryIndex: categories.indexOf(category),
      stats: { answered: answered.length, correct: answered.filter(q => this.record.progress[q.id] === 'correct').length,
        bookmarks: all.filter(q => this.record.bookmarks.includes(q.id)).length, words: rows.reduce((total, [, value]) => total + value.seen, 0) },
      paperItems, matchingPapers, bankPaperIndex: Math.max(0, matchingPapers.findIndex(item => item.id === this.data.selectedPaper)),
      selectedPaper: this.data.selectedPaper || 'jlpt-1992-1',
      selectedPaperIndex: Math.max(0, paperItems.findIndex(item => item.id === this.data.selectedPaper)),
      paperHasMedia: Boolean(bank.questionCollections.find(item => item.id === (this.data.selectedPaper || 'jlpt-1992-1'))?.categories.includes('listening')),
      fullPaper: selection.fullPaper, paperQuestions: selection.paperQuestions, paperQuestionIndex: selection.paperQuestionIndex,
      rangeCount: this.range.length, resultCount: this.filtered.length,
      results: this.filtered.slice(0, this.data.browseLimit || 40).map(q => ({ id: q.id, prompt: contentText(q.prompt, locale), status: this.record.progress[q.id] || '' })),
      isSeed: ['zh-mandarin', 'en-us', 'grc', 'ru', 'fr', 'ar'].includes(language),
      textbooks: (bank.textbookCatalog || []).filter(item => item.targetLanguage === language).map(item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, typeof value === 'string' ? contentText(value, locale) : value]))),
      dictionaries: language === 'la' ? (bank.dictionarySources || []).map(item => ({ ...item, name: contentText(item.name, locale), scope: contentText(item.scope, locale), access: contentText(item.access, locale) })) : [],
      isBookmarked: this.data.question ? this.record.bookmarks.includes(this.data.question.id) : false,
    });
    this.renderQuestion();
    this.renderVocabulary();
    this.renderStudyModes();
    this.renderProfile();
    this.updateCommunityPolling();
  },
  signedIn() {
    const session = api.getSession();
    if ((this.owner || session) && (!session || session.user.id !== this.owner)) {
      const error = new Error('Session changed');
      error.status = 401;
      throw error;
    }
    return Boolean(session);
  },
  persistGuest() { if (!this.owner && !api.getSession()) wx.setStorageSync(GUEST_KEY, this.record); },
  changeView(event) {
    if (this.data.busy) return;
    const view = event.currentTarget.dataset.view;
    if (view === 'dictionary' && this.data.view === 'account') this.setData({ dictionaryEntryId: '' });
    if (this.data.examActive && view !== 'practice') this.finishExam();
    this.stopQuestionAudio();
    this.setData({ view });
    this.render();
    if (view === 'words' && !this.data.card) this.nextCard();
  },
  changeLocale() {
    if (this.data.busy) return;
    this.stopQuestionAudio();
    const locale = this.data.locale === 'en' ? 'zh-CN' : 'en';
    wx.setStorageSync(LOCALE_KEY, locale);
    this.setData({ locale, t: copies[locale] });
    this.applyPreference();
  },
  async preference(next) {
    this.stopQuestionAudio();
    return this.perform(async () => {
      if (next.language || next.level) this.setData({ fullPaper: false, reviewScope: false });
      const pref = { language: this.data.language, level: this.data.level, vocabMode: this.data.vocabMode, ...next };
      if (this.signedIn()) await api.request('/api/preferences', 'PUT', pref);
      this.record.preference = pref;
      this.persistGuest();
      this.setData({ question: null, card: null });
      this.applyPreference();
    });
  },
  changeLanguage(event) { return this.preference({ language: this.data.languages[Number(event.detail.value)].id }); },
  changeLevel(event) { return this.preference({ level: event.detail.level }); },
  changeWordMode() { return this.preference({ vocabMode: this.data.vocabMode === 'word' ? 'context' : 'word' }); },
  async toggleBookmark() {
    if (!this.data.question) return;
    return this.perform(async () => {
      const q = this.data.question;
      const language = q.language || 'la';
      const remove = this.record.bookmarks.includes(q.id);
      if (this.signedIn()) {
        // Fetch before replacing this language to retain other devices' bookmarks.
        const latest = await api.getStats();
        const remote = latest.byLanguage && latest.byLanguage[language];
        if (!remote || !Array.isArray(remote.bookmarks)) throw new Error('Invalid bookmark response');
        const ids = new Set(remote.bookmarks);
        if (remove) ids.delete(q.id); else ids.add(q.id);
        await api.request('/api/bookmarks', 'PUT', { language, questionIds: [...ids] });
        this.record = fromCloud(latest);
        this.record.vocab = this.wordMemory.stats;
      }
      this.record.bookmarks = this.record.bookmarks.filter(id => id !== q.id);
      if (!remove) this.record.bookmarks.push(q.id);
      this.persistGuest();
      this.render();
    });
  },
  inputEmail(event) { this.setData({ email: event.detail.value }); },
  inputPassword(event) { this.setData({ password: event.detail.value }); },
  async signIn() {
    if (this.data.busy) return;
    if (!this.data.email.trim() || !this.data.password) return wx.showToast({ title: this.data.t.required, icon: 'none' });
    await this.perform(async () => {
      const password = this.data.password;
      this.setData({ password: '' });
      const session = await api.signIn(this.data.email.trim(), password);
      this.owner = session.user.id;
      this.resetStudyModes();
      this.stopCommunity();
      this.record = emptyRecord();
      this.initVocabulary();
      this.stopQuestionAudio();
      this.setData({ user: session.user, question: null, card: null, sync: 'loading' });
      this.applyPreference();
      const result = await vocabulary.sync(this.owner);
      this.wordMemory = result.memory;
      this.record = fromCloud(result.cloud);
      this.record.vocab = this.wordMemory.stats;
      this.applyPreference();
      this.setData({ sync: 'synced' });
    });
  },
  signOut() {
    if (this.data.busy) return;
    this.generation++;
    this.resetStudyModes();
    this.stopCommunity();
    api.signOut();
    this.owner = null;
    this.record = readGuest();
    this.initVocabulary();
    this.stopQuestionAudio();
    this.queue = [];
    this.setData({ user: null, sync: 'guest', question: null, card: null, password: '', email: '', error: '', busy: false });
    this.applyPreference();
  },
  copyWebsite() { wx.setClipboardData({ data: 'https://pikku.qzz.io/', success: () => wx.showToast({ title: this.data.t.copied, icon: 'none' }) }); },
  copyResource(event) { wx.setClipboardData({ data: event.currentTarget.dataset.url, success: () => wx.showToast({ title: this.data.t.copied, icon: 'none' }) }); },
});
