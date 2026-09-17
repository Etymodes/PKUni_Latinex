const api = require('../../lib/api');
const bank = require('../../data/bank');
const shared = require('../../data/shared');
const { copies, levelCards } = require('../../lib/copy');
const GUEST_KEY = 'pikku-mini-guest-v1';
const LOCALE_KEY = 'pikku-mini-locale-v1';
const categories = ['all', 'vocabulary', 'morphology', 'syntax', 'sentencePattern', 'classics', 'translation'];

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
function shuffled(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

Page({
  data: {
    locale: 'zh-CN', t: copies['zh-CN'], view: 'home', level: 'C', language: 'la', vocabMode: 'context',
    busy: false, user: null, sync: 'guest', error: '', email: '', password: '', question: null, card: null,
    filter: 'all', category: 'all', search: '', browse: false, revealed: false, submitted: false, wordRevealed: false,
    choices: [], selected: -1, answerCorrect: false, questionIndex: 0, questionTotal: 0,
  },
  onLoad() {
    this.alive = true;
    this.generation = 0;
    this.owner = null;
    this.record = readGuest();
    this.questions = bank.questions;
    this.recentWords = [];
    const locale = wx.getStorageSync(LOCALE_KEY) === 'en' ? 'en' : 'zh-CN';
    this.setData({ locale, t: copies[locale] });
    this.applyPreference();
    this.refresh();
  },
  onUnload() { this.alive = false; this.generation++; },
  onShow() {
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
          this.record = readGuest();
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
        this.record = owner ? emptyRecord() : readGuest();
        this.queue = [];
        this.setData({ question: null, card: null });
        this.applyPreference();
      }
      this.setData({ user: session ? session.user : null, sync: owner ? 'loading' : 'guest' });
      const results = await Promise.allSettled([api.getOverrides(), owner ? api.getStats() : Promise.resolve(null)]);
      if (!this.alive) return;
      if (results[0].status === 'fulfilled') {
        const overrides = results[0].value.overrides || [];
        const version = JSON.stringify(overrides);
        this.questions = shared.mergeQuestionOverrides(bank.questions, overrides);
        if (this.overrideVersion !== version) {
          this.queue = [];
          this.setData({ question: null });
        }
        this.overrideVersion = version;
      }
      if (owner && results[1].status === 'fulfilled') {
        this.record = fromCloud(results[1].value);
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
    if (language !== this.data.language || level !== this.data.level) {
      this.queue = [];
      this.setData({ question: null, card: null });
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
    this.range = all.filter(q => shared.normalizePikkuLevel(language, q.level) === level);
    this.filtered = this.range.filter(q => (filter === 'all' || (filter === 'wrong' ? this.record.progress[q.id] === 'wrong' || this.record.progress[q.id] === 'review' : this.record.bookmarks.includes(q.id)))
      && (category === 'all' || q.category === category)
      && (!search.trim() || [q.prompt, q.text, q.latin, q.context, q.id].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase())));
    const answered = all.filter(q => this.record.progress[q.id]);
    const rows = Object.entries(this.record.vocab).filter(([key]) => key.startsWith(language + ':'));
    this.setData({
      t, levels: levelCards(locale), languageInfo,
      languageLabel: languageInfo.labels[locale], greeting: languageInfo.greeting,
      factStatement: languageInfo.fact.statement, factMeaning: languageInfo.fact.meaning[locale],
      languages: available.map(item => ({ id: item.id, label: item.nativeName + ' · ' + item.labels[locale] })),
      languageIndex: available.findIndex(item => item.id === language),
      categoryItems: categories.map(id => ({ id, label: t.categories[id] })), categoryIndex: categories.indexOf(category),
      stats: { answered: answered.length, correct: answered.filter(q => this.record.progress[q.id] === 'correct').length,
        bookmarks: all.filter(q => this.record.bookmarks.includes(q.id)).length, words: rows.reduce((total, [, value]) => total + value.seen, 0) },
      rangeCount: this.range.length, resultCount: this.filtered.length,
      results: this.filtered.slice(0, 40).map(q => ({ id: q.id, prompt: q.prompt, status: this.record.progress[q.id] || '' })),
      isSeed: ['zh-mandarin', 'en-us', 'grc', 'ru'].includes(language),
      textbooks: (bank.textbookCatalog || []).filter(item => item.targetLanguage === language),
      dictionaries: language === 'la' ? (bank.dictionarySources || []) : [],
      isBookmarked: this.data.question ? this.record.bookmarks.includes(this.data.question.id) : false,
    });
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
    this.setData({ view });
    if (view === 'words' && !this.data.card) this.nextCard();
  },
  changeLocale() {
    if (this.data.busy) return;
    const locale = this.data.locale === 'en' ? 'zh-CN' : 'en';
    wx.setStorageSync(LOCALE_KEY, locale);
    this.setData({ locale, t: copies[locale], question: null, card: null });
    this.applyPreference();
  },
  async preference(next) {
    return this.perform(async () => {
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
  changeFilter(event) {
    if (this.data.busy) return;
    this.setData({ filter: event.currentTarget.dataset.filter, question: null });
    this.render();
  },
  changeCategory(event) {
    if (this.data.busy) return;
    this.setData({ category: categories[Number(event.detail.value)], question: null });
    this.render();
  },
  changeSearch(event) { this.setData({ search: event.detail.value }); this.render(); },
  toggleBrowse() { this.setData({ browse: !this.data.browse }); },
  startPractice() {
    if (this.data.busy) return;
    if (this.data.view === 'home') {
      this.setData({ filter: 'all', category: 'all', search: '' });
      this.render();
    }
    this.queue = shuffled(this.filtered);
    this.setData({ view: 'practice', browse: false, questionIndex: 0, questionTotal: this.queue.length });
    this.showQuestion(this.queue[0]);
  },
  openQuestion(event) {
    if (this.data.busy) return;
    this.queue = this.filtered.slice();
    const index = this.queue.findIndex(q => q.id === event.currentTarget.dataset.id);
    this.setData({ questionIndex: index, questionTotal: this.queue.length, browse: false });
    this.showQuestion(this.queue[index]);
  },
  showQuestion(question) {
    const choices = question ? shuffled((question.options || []).map((text, index) => ({ index, text }))) : [];
    this.setData({ question: question || null, choices, revealed: false, submitted: false, selected: -1, answerCorrect: false,
      isBookmarked: question ? this.record.bookmarks.includes(question.id) : false });
  },
  nextQuestion() {
    if (this.data.busy) return;
    const index = this.data.questionIndex + 1;
    this.setData({ questionIndex: index });
    this.showQuestion(this.queue && this.queue[index]);
    if (!this.data.question) this.render();
  },
  async answer(event) {
    if (this.data.busy || this.data.submitted || !this.data.question) return;
    const q = this.data.question;
    const selected = Number(event.currentTarget.dataset.index);
    const correct = q.type === 'choice' ? selected === q.answer : event.currentTarget.dataset.correct === 'yes';
    this.setData({ selected, revealed: true, submitted: true, answerCorrect: correct });
    return this.perform(async () => {
      const status = correct ? 'correct' : 'wrong';
      if (this.signedIn()) await api.request('/api/progress', 'POST', { questionId: q.id, language: q.language || 'la', level: q.level, category: q.category, status });
      this.record.progress[q.id] = status;
      this.persistGuest();
      this.render();
    });
  },
  revealAnswer() { this.setData({ revealed: true }); },
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
      }
      this.record.bookmarks = this.record.bookmarks.filter(id => id !== q.id);
      if (!remove) this.record.bookmarks.push(q.id);
      this.persistGuest();
      this.render();
    });
  },
  nextCard() {
    const eligible = bank.vocabularyCards.filter(card => card.language === this.data.language && shared.vocabularyMatchesLevel(card, this.data.level));
    const card = shared.chooseNextVocabularyCard(eligible, this.record.vocab, this.recentWords);
    if (card) this.recentWords = [...this.recentWords.slice(-3), card.id];
    this.setData({ card, wordRevealed: false });
  },
  revealWord() { this.setData({ wordRevealed: true }); },
  async rateWord(event) {
    if (!this.data.card || this.data.busy || !this.data.wordRevealed) return;
    const card = this.data.card;
    const correct = event.currentTarget.dataset.correct === 'yes';
    // The server increments counters; never replay an uncertain write automatically.
    this.setData({ wordRevealed: false });
    return this.perform(async () => {
      try {
        if (this.signedIn()) await api.request('/api/vocab', 'POST', { language: card.language, answers: [{ lemma: card.term, correct }] });
        const key = shared.vocabularyKey(card.language, card.term);
        const stat = this.record.vocab[key] || { seen: 0, correct: 0 };
        this.record.vocab[key] = { seen: stat.seen + 1, correct: stat.correct + (correct ? 1 : 0) };
        this.persistGuest();
        this.render();
      } finally { this.nextCard(); }
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
      this.record = emptyRecord();
      this.setData({ user: session.user, question: null, card: null, sync: 'loading' });
      this.applyPreference();
      this.record = fromCloud(await api.getStats());
      this.applyPreference();
      this.setData({ sync: 'synced' });
    });
  },
  signOut() {
    if (this.data.busy) return;
    this.generation++;
    api.signOut();
    this.owner = null;
    this.record = readGuest();
    this.queue = [];
    this.setData({ user: null, sync: 'guest', question: null, card: null, password: '', email: '', error: '', busy: false });
    this.applyPreference();
  },
  copyWebsite() { wx.setClipboardData({ data: 'https://pikku.qzz.io/', success: () => wx.showToast({ title: this.data.t.copied, icon: 'none' }) }); },
  copyResource(event) { wx.setClipboardData({ data: event.currentTarget.dataset.url }); },
});
