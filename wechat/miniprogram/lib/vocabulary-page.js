const vocabulary = require('./vocabulary');
const shared = require('../data/shared');
const bank = require('../data/bank');
const { contentText, localizeVocabularyCard } = require('../data/content-locale');
const outcomes = ['forgotten', 'approximate', 'remembered'];
const scopeIds = ['level', 'all', 'n1-2000', 'jlpt-1992', 'jlpt-1993-1', 'ja-hlb1000-n1-u01'];
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function details(card, locale) {
  const result = vocabulary.details(localizeVocabularyCard(card, locale));
  // Decide which dictionary citations may be shown using their canonical names.
  result.dictionaryReferences = vocabulary.details(card).dictionaryReferences.map(reference => ({ ...reference, name: contentText(reference.name, locale), note: contentText(reference.note, locale) }));
  return { ...result, otherSpellings: result.otherSpellings.join(' · '), otherReadings: result.otherReadings.join(' · '), derivatives: result.derivatives.join(' · ') };
}
const vocabularyActions = {
  initVocabulary() {
    this.wordMemory = vocabulary.load(this.owner, this.record.vocab);
    this.record.vocab = this.wordMemory.stats;
    this.wordSelection = null;
    this.recentWords = [];
    this.setData({ card: null, wordRevealed: false, dictionaryQuery: '', dictionaryOffset: 0, roundTotal: 0, roundApproximate: 0, roundRemembered: 0 });
  },
  renderVocabulary() {
    if (!this.wordMemory) return;
    const { language, locale } = this.data;
    const card = this.data.card && this.wordSelection ? this.wordSelection.card : null;
    const t = this.data.t;
    const entries = vocabulary.entries({ language, locale, query: this.data.dictionaryQuery || '' });
    const scopes = (language === 'ja' ? scopeIds : scopeIds.slice(0, 2)).map(id => ({ id, label: t.wordScopes[id] }));
    if (!scopes.some(item => item.id === this.data.wordScope)) this.setData({ wordScope: 'level' });
    const eligible = vocabulary.entries({ language, locale, level: this.data.level, query: this.data.wordQuery || '', scope: this.data.wordScope })
      .filter(item => this.data.wordScope !== 'level' || shared.vocabularyMatchesLevel(item, this.data.level));
    const personal = vocabulary.model(this.wordMemory, language);
    const wordStat = card ? vocabulary.wordStats(this.wordMemory, card) : null;
    this.setData({
      wordScopeItems: scopes, wordScopeIndex: scopes.findIndex(item => item.id === this.data.wordScope), eligibleWords: eligible.length,
      dictionaryTotal: entries.length, dictionaryFirst: entries.length ? (this.data.dictionaryOffset || 0) + 1 : 0, dictionaryLast: Math.min((this.data.dictionaryOffset || 0) + 40, entries.length), dictionaryCount: vocabulary.entries({ language }).length,
      dictionaryRows: this.data.view === 'dictionary' ? entries.slice(this.data.dictionaryOffset || 0, (this.data.dictionaryOffset || 0) + 40).map(item => ({
        id: item.id, card: localizeVocabularyCard(item, locale), details: details(item, locale), stat: vocabulary.wordStats(this.wordMemory, item),
      })) : [],
      pendingWords: this.owner ? this.wordMemory.pendingReviewIds.length : 0, modelSamples: personal.sampleCount,
      modelError: personal.metrics.brier == null ? '' : personal.metrics.brier.toFixed(3), modelCount: personal.metrics.count,
      modelBaseline: personal.metrics.baselineBrier == null ? '' : personal.metrics.baselineBrier.toFixed(3),
      card: card ? localizeVocabularyCard(card, locale) : null, wordDetails: card ? details(card, locale) : null, wordStat,
      today: localDate(), forecastDate: this.data.forecastDate || localDate(new Date(Date.now() + 86400000)),
    });
    this.updateForecast();
  },
  nextCard(focusId) {
    if (!this.wordMemory) this.initVocabulary();
    this.wordSelection = vocabulary.select(this.wordMemory, {
      language: this.data.language, locale: this.data.locale, level: this.data.level, scope: this.data.wordScope || 'level', query: this.data.wordQuery || '',
      mode: this.data.vocabMode, recentIds: this.recentWords, focusId: typeof focusId === 'string' ? focusId : undefined,
    });
    const card = this.wordSelection && this.wordSelection.card;
    if (card) this.recentWords = [...this.recentWords.slice(-3), card.id];
    this.setData({ card: card || null, wordRevealed: false, future: null });
    this.renderVocabulary();
  },
  revealWord() { if (!this.data.busy && this.data.card) this.setData({ wordRevealed: true }); },
  async rateWord(event) {
    if (!this.wordSelection || this.data.busy || !this.data.wordRevealed) return;
    const outcome = event.currentTarget.dataset.outcome;
    if (!outcomes.includes(outcome)) return;
    const selection = this.wordSelection;
    return this.perform(async () => {
      this.signedIn();
      const memory = vocabulary.review(this.wordMemory, selection, outcome);
      this.wordMemory = memory;
      this.record.vocab = memory.stats;
      this.setData({ wordRevealed: false, roundTotal: (this.data.roundTotal || 0) + 1,
        roundApproximate: (this.data.roundApproximate || 0) + Number(outcome === 'approximate'),
        roundRemembered: (this.data.roundRemembered || 0) + Number(outcome === 'remembered') });
      this.render();
      this.nextCard();
      if (this.owner) {
        const owner = this.owner;
        const result = await vocabulary.sync(owner);
        if (!this.alive || this.owner !== owner) return;
        this.wordMemory = result.memory;
        this.record.vocab = result.memory.stats;
        this.setData({ sync: 'synced' });
        this.render();
      }
    });
  },
  changeWordScope(event) {
    if (this.data.busy) return;
    this.setData({ wordScope: this.data.wordScopeItems[Number(event.detail.value)].id });
    this.recentWords = [];
    this.nextCard();
  },
  changeWordQuery(event) {
    if (this.data.busy) return;
    this.setData({ wordQuery: event.detail.value });
    this.nextCard();
  },
  openDictionary() {
    if (this.data.busy) return;
    this.stopQuestionAudio();
    this.setData({ view: 'dictionary', dictionaryQuery: this.data.card ? this.data.card.term : '', dictionaryOffset: 0 });
    this.renderVocabulary();
  },
  searchDictionary(event) {
    this.setData({ dictionaryQuery: event.detail.value, dictionaryOffset: 0 });
    this.renderVocabulary();
  },
  moreDictionary() {
    if ((this.data.dictionaryOffset || 0) + 40 >= this.data.dictionaryTotal) return;
    this.setData({ dictionaryOffset: (this.data.dictionaryOffset || 0) + 40 });
    this.renderVocabulary();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  previousDictionary() {
    this.setData({ dictionaryOffset: Math.max(0, (this.data.dictionaryOffset || 0) - 40) });
    this.renderVocabulary();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  practiseWord(event) {
    if (this.data.busy) return;
    const id = event.currentTarget.dataset.id;
    if (!bank.vocabularyCards.some(card => card.id === id && card.language === this.data.language)) return;
    this.setData({ view: 'words', wordScope: 'all', wordQuery: '' });
    this.nextCard(id);
  },
  changeForecastDate(event) { this.setData({ forecastDate: event.detail.value }); this.updateForecast(); },
  updateForecast() {
    if (!this.data.card || !this.wordMemory || !this.data.forecastDate) return;
    const date = new Date(`${this.data.forecastDate}T23:59:59`);
    if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now()) { this.setData({ future: null }); return; }
    const prediction = vocabulary.forecast(this.wordMemory, this.wordSelection.card, date.toISOString(), this.data.vocabMode);
    const best = outcomes.reduce((a, b) => prediction.probabilities[b] > prediction.probabilities[a] ? b : a);
    this.setData({ future: { outcome: best, hasTimedHistory: prediction.hasTimedHistory,
      forgotten: Math.round(prediction.probabilities.forgotten * 100), approximate: Math.round(prediction.probabilities.approximate * 100), remembered: Math.round(prediction.probabilities.remembered * 100) } });
  },
  toggleModel() { this.setData({ showModel: !this.data.showModel }); },
  exportWordReviews() {
    const language = this.data.language;
    const content = JSON.stringify({ version: 1, language, exportedAt: new Date().toISOString(), reviews: this.wordMemory.reviews.filter(item => item.language === language) }, null, 2);
    const filePath = `${wx.env.USER_DATA_PATH}/pikku-${language}-learning-${localDate()}.json`;
    wx.getFileSystemManager().writeFile({ filePath, data: content, encoding: 'utf8',
      success: () => {
        if (typeof wx.shareFileMessage === 'function') wx.shareFileMessage({ filePath, fileName: filePath.split('/').pop(), fail: () => wx.showToast({ title: this.data.t.exportSaved, icon: 'none' }) });
        else wx.showToast({ title: this.data.t.exportSaved, icon: 'none' });
      }, fail: () => wx.showToast({ title: this.data.t.exportFailed, icon: 'none' }) });
  },
  toggleSupport() { this.setData({ showSupport: !this.data.showSupport }); },
  previewSupport() { wx.previewImage({ current: '/assets/support-author.png', urls: ['/assets/support-author.png'] }); },
};
module.exports = { vocabularyActions };
