const vocabulary = require('./vocabulary');
const shared = require('../data/shared');
const bank = require('../data/bank');
const dictionary = require('../data/dictionary');
const { contentText, localizeVocabularyCard } = require('../data/content-locale');
const outcomes = ['forgotten', 'approximate', 'remembered'];
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
    this.setData({ card: null, wordRevealed: false, dictionaryQuery: '', dictionaryOffset: 0, dictionaryEntryId: '', dictionaryField: 'all', dictionaryOrder: '', dictionaryIndex: 'all', dictionaryLevel: 'all', dictionaryPartOfSpeech: 'all', roundTotal: 0, roundApproximate: 0, roundRemembered: 0 });
  },
  renderVocabulary() {
    if (!this.wordMemory) return;
    const { language, locale } = this.data;
    const card = this.data.card && this.wordSelection ? this.wordSelection.card : null;
    const order = this.data.dictionaryOrder || (language === 'ja' ? 'reading' : 'headword');
    const entries = this.data.view === 'dictionary' ? dictionary.searchDictionary(bank.vocabularyCards, { language, locale, query: this.data.dictionaryQuery || '', field: this.data.dictionaryField || 'all', order, index: this.data.dictionaryIndex || 'all', level: this.data.dictionaryLevel || 'all', partOfSpeech: this.data.dictionaryPartOfSpeech || 'all' }) : [];
    const facets = dictionary.dictionaryFacets(bank.vocabularyCards, language, order);
    const selected = this.data.dictionaryEntryId && bank.vocabularyCards.find(item => item.id === this.data.dictionaryEntryId && item.language === language);
    const entry = selected ? dictionary.dictionaryEntry(selected, locale) : null;
    if (entry) entry.references = entry.references.map(reference => ({ ...reference, key: reference.name + '|' + reference.url }));
    const dictionaryFields = ['all', 'headword', 'reading', 'meaning'].map(id => ({ id, label: this.data.t['dictionaryField_' + id] }));
    const dictionaryOrders = ['headword', 'reading'].map(id => ({ id, label: this.data.t['dictionaryOrder_' + id] }));
    const dictionaryIndices = [{ id: 'all', label: this.data.t.allIndices }, ...facets.indices.map(id => ({ id, label: id === '漢字' && locale === 'en' ? 'Han characters' : id }))];
    const dictionaryLevels = [{ id: 'all', label: this.data.t.allLevels }, ...['C', 'F', 'G', 'M'].map(id => ({ id, label: id }))];
    const dictionaryParts = [{ id: 'all', label: this.data.t.allPartsOfSpeech }, ...facets.partsOfSpeech.map(id => ({ id, label: contentText(id, locale) }))];
    const eligible = vocabulary.entries({ language, locale, level: this.data.level, query: this.data.wordQuery || '' });
    const personal = vocabulary.model(this.wordMemory, language);
    const wordStat = card ? vocabulary.wordStats(this.wordMemory, card) : null;
    this.setData({
      eligibleWords: eligible.length, focusedWord: Boolean(card && !shared.vocabularyMatchesLevel(card, this.data.level)),
      dictionaryTotal: entries.length, dictionaryFirst: entries.length ? (this.data.dictionaryOffset || 0) + 1 : 0, dictionaryLast: Math.min((this.data.dictionaryOffset || 0) + 40, entries.length), dictionaryCount: vocabulary.entries({ language }).length,
      dictionaryOrder: order, dictionaryFields, dictionaryOrders, dictionaryIndices, dictionaryLevels, dictionaryParts,
      dictionaryFieldIndex: Math.max(0, dictionaryFields.findIndex(item => item.id === this.data.dictionaryField)), dictionaryOrderIndex: dictionaryOrders.findIndex(item => item.id === order),
      dictionaryIndexIndex: Math.max(0, dictionaryIndices.findIndex(item => item.id === this.data.dictionaryIndex)), dictionaryLevelIndex: Math.max(0, dictionaryLevels.findIndex(item => item.id === this.data.dictionaryLevel)), dictionaryPartIndex: Math.max(0, dictionaryParts.findIndex(item => item.id === this.data.dictionaryPartOfSpeech)),
      dictionaryRows: this.data.view === 'dictionary' ? entries.slice(this.data.dictionaryOffset || 0, (this.data.dictionaryOffset || 0) + 40).map(item => {
        const display = localizeVocabularyCard(item, locale);
        return { id: item.id, card: { id: item.id, language: item.language, term: display.term, reading: display.reading || display.sourceReading || '', meaning: display.meaning, level: display.level, partOfSpeech: display.partOfSpeech } };
      }) : [],
      dictionaryDetail: this.data.view === 'dictionary' && selected ? { ...entry, stat: vocabulary.wordStats(this.wordMemory, selected) } : null,
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
      language: this.data.language, locale: this.data.locale, level: this.data.level, query: this.data.wordQuery || '',
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
  changeWordQuery(event) {
    if (this.data.busy) return;
    this.setData({ wordQuery: event.detail.value });
    this.nextCard();
  },
  openDictionary() {
    if (this.data.busy) return;
    this.stopQuestionAudio();
    this.setData({ view: 'dictionary', dictionaryQuery: this.data.card ? this.data.card.term : '', dictionaryEntryId: this.data.card ? this.data.card.id : '', dictionaryOffset: 0, dictionaryField: 'all', dictionaryIndex: 'all', dictionaryLevel: 'all', dictionaryPartOfSpeech: 'all' });
    this.renderVocabulary();
  },
  searchDictionary(event) {
    this.setData({ dictionaryQuery: event.detail.value, dictionaryOffset: 0, dictionaryEntryId: '' });
    this.renderVocabulary();
  },
  changeDictionaryFilter(event) {
    const field = event.currentTarget.dataset.filter;
    const mapping = { field: ['dictionaryFields', 'dictionaryField'], order: ['dictionaryOrders', 'dictionaryOrder'], index: ['dictionaryIndices', 'dictionaryIndex'], level: ['dictionaryLevels', 'dictionaryLevel'], part: ['dictionaryParts', 'dictionaryPartOfSpeech'] }[field];
    if (!mapping) return;
    const value = this.data[mapping[0]][Number(event.detail.value)];
    if (!value) return;
    const update = { [mapping[1]]: value.id, dictionaryOffset: 0, dictionaryEntryId: '' };
    if (field === 'order') update.dictionaryIndex = 'all';
    this.setData(update); this.renderVocabulary();
  },
  openDictionaryEntry(event) {
    const id = event.currentTarget.dataset.id;
    if (!bank.vocabularyCards.some(card => card.id === id && card.language === this.data.language)) return;
    this.setData({ view: 'dictionary', dictionaryEntryId: id }); this.renderVocabulary();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  closeDictionaryEntry() { this.setData({ dictionaryEntryId: '' }); this.renderVocabulary(); },
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
    this.setData({ view: 'words', wordQuery: '' });
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
