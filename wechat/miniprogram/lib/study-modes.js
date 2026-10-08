const bank = require('../data/bank');
const shared = require('../data/shared');
const jlpt = require('../data/jlpt-exam');
const vocabulary = require('./vocabulary');
const { localizeVocabularyCard } = require('../data/content-locale');
let sequence = 0;
const studyActions = {
  stopExamClock() { if (this.examTimer) clearTimeout(this.examTimer); this.examTimer = null; },
  resetStudyModes() {
    this.stopExamClock();
    this.examAnswers = {};
    this.examPlan = null;
    this.examSections = [];
    this.examSectionIndex = 0; this.examSectionStart = 0; this.examSectionEnd = 0;
    this.measurement = null;
    this.setData({ examActive: false, examFinished: false, examIsJlpt: false, examSectionTitle: '', examQuestionType: '', examSectionResults: [], measurementItems: [], measurementDone: false, measurementReady: false, measurementIndex: 0 });
  },
  renderStudyModes() {
    const questions = this.questions.filter(q => (q.language || 'la') === this.data.language);
    const cards = bank.vocabularyCards.filter(card => card.language === this.data.language);
    this.setData({ courseLevels: ['C', 'F', 'G', 'M'].map(level => ({ level, questions: questions.filter(q => shared.matchesLevel(q, level)).length, words: cards.filter(card => shared.vocabularyMatchesLevel(card, level)).length })) });
    const locale = this.data.locale === 'en' ? 'en' : 'zh';
    if (this.data.language === 'ja' && this.data.view === 'exam') {
      const profileId = this.data.examProfile || ({ C: 'n3', F: 'n2' }[this.data.level] || 'n1');
      const preview = jlpt.buildJlptExam(questions, profileId, () => 0);
      this.setData({ examProfile: profileId, jlptProfiles: jlpt.jlptExamProfiles.map(profile => ({ id: profile.id, label: `${profile.id.toUpperCase()} (${profile.level})` })),
        jlptComplete: preview.complete, jlptTotalSelected: preview.totalSelected, jlptTotalRequired: preview.totalRequired,
        jlptSections: preview.sections.map(section => ({ id: section.id, label: section.label[locale], minutes: section.minutes,
          selected: section.questions.length, types: preview.coverage.filter(item => item.sectionId === section.id).map(item => ({ ...item, label: item.label[locale] })) })) });
    }
    this.renderExamSection();
    if (this.measurement) {
      const translate = meaning => localizeVocabularyCard({ meaning }, this.data.locale).meaning;
      const item = this.measurement.items[this.data.measurementIndex];
      this.setData({ measurementTotal: this.measurement.items.length, measurementPool: this.measurement.pool,
        measurementItem: item ? { ...item, options: item.options.map((text, index) => ({ index, text: translate(text) })) } : null });
    }
  },
  async openCourseLevel(event) {
    await this.preference({ level: event.currentTarget.dataset.level });
    if (this.data.busy || this.data.level !== event.currentTarget.dataset.level) return;
    this.openOrderedPractice();
  },
  openOrderedPractice() {
    if (this.data.busy) return;
    this.stopQuestionAudio();
    this.resetStudyModes();
    this.setData({ view: 'practice', reviewScope: false, fullPaper: false, filter: 'all', category: 'all', search: '', question: null, browse: true, browseLimit: 40 });
    this.render();
  },
  startOrderedPractice() {
    if (this.data.busy) return;
    this.queue = this.filtered.slice();
    this.setData({ view: 'practice', browse: false, questionIndex: 0, questionTotal: this.queue.length });
    this.showQuestion(this.queue[0]);
  },
  moreQuestions() { this.setData({ browseLimit: (this.data.browseLimit || 40) + 40 }); this.render(); },
  changeExamMixed(event) { if (!this.data.examActive) this.setData({ examMixed: event.detail.value === true }); },
  changeExamFormat(event) {
    if (this.data.busy || this.data.examActive) return;
    const format = event.currentTarget.dataset.format;
    if (!['quick', 'jlpt'].includes(format)) return;
    this.resetStudyModes();
    this.setData({ examFormat: format, examEmpty: false }); this.renderStudyModes();
  },
  changeExamProfile(event) {
    if (this.data.busy || this.data.examActive) return;
    const profile = event.currentTarget.dataset.profile;
    if (!jlpt.jlptExamProfiles.some(item => item.id === profile)) return;
    this.resetStudyModes();
    this.setData({ examProfile: profile, examEmpty: false }); this.renderStudyModes();
  },
  startExam() {
    if (this.data.busy) return;
    this.stopQuestionAudio();
    this.resetStudyModes();
    const questions = this.questions.filter(q => (q.language || 'la') === this.data.language);
    if (this.data.language === 'ja' && this.data.examFormat === 'jlpt') {
      this.examPlan = jlpt.buildJlptExam(questions, this.data.examProfile || ({ C: 'n3', F: 'n2' }[this.data.level] || 'n1'));
      this.examSections = this.examPlan.sections.filter(section => section.questions.length);
      this.queue = this.examPlan.questions;
      this.setData({ examIsJlpt: true });
    } else this.queue = shared.buildRandomExam(questions, this.data.level, this.data.examMixed);
    if (!this.queue.length) { this.setData({ examEmpty: true }); return; }
    this.setData({ view: 'practice', examActive: true, examEmpty: false, reviewScope: false, fullPaper: false, browse: false, questionIndex: 0, questionTotal: this.queue.length });
    if (this.examPlan) { this.beginExamSection(0); return; }
    this.examDeadline = Date.now() + 20 * 60 * 1000;
    this.showQuestion(this.queue[0]); this.tickExamClock();
  },
  beginExamSection(index) {
    const section = this.examSections[index];
    if (!section) { this.finishExam(); return; }
    this.examSectionIndex = index;
    this.examSectionStart = this.examSections.slice(0, index).reduce((total, item) => total + item.questions.length, 0);
    this.examSectionEnd = this.examSectionStart + section.questions.length;
    this.examDeadline = Date.now() + section.minutes * 60 * 1000;
    this.setData({ questionIndex: this.examSectionStart });
    this.showQuestion(this.queue[this.examSectionStart]); this.tickExamClock();
  },
  renderExamSection() {
    if (!this.examPlan) return;
    const locale = this.data.locale === 'en' ? 'en' : 'zh';
    const section = this.examSections[this.examSectionIndex];
    const type = this.activeQuestion && this.examPlan.questionTypes[this.activeQuestion.id];
    this.setData({ examProfileLabel: `${this.examPlan.profile.id.toUpperCase()} (${this.examPlan.profile.level})`,
      examSectionTitle: section ? section.label[locale] : '', examQuestionType: type ? type.label[locale] : '',
      examSectionNumber: section ? this.examSectionIndex + 1 : 0, examSectionCount: this.examSections.length,
      examSectionQuestion: section ? this.data.questionIndex - this.examSectionStart + 1 : 0, examSectionTotal: section ? section.questions.length : 0,
      examSectionResults: this.examPlan.sections.map(item => ({ id: item.id, label: item.label[locale], total: item.questions.length,
        answered: item.questions.filter(q => Object.prototype.hasOwnProperty.call(this.examAnswers || {}, q.id)).length,
        correct: item.questions.filter(q => (this.examAnswers || {})[q.id] === true).length })) });
  },
  nextExamSection() { if (!this.data.busy && this.data.examActive && this.examPlan) this.beginExamSection(this.examSectionIndex + 1); },
  expireExamSection() { if (this.examPlan) this.beginExamSection(this.examSectionIndex + 1); else this.finishExam(); },
  tickExamClock() {
    this.stopExamClock();
    if (!this.data.examActive) return;
    const remaining = Math.max(0, Math.ceil((this.examDeadline - Date.now()) / 1000));
    this.setData({ examTime: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` });
    if (!remaining) { this.expireExamSection(); return; }
    if (this.visible) this.examTimer = setTimeout(() => this.tickExamClock(), 1000);
  },
  finishExam() {
    if (!this.data.examActive) return;
    this.stopExamClock(); this.stopQuestionAudio();
    this.setData({ view: 'exam', examActive: false, examFinished: true, question: null, examAnswered: Object.keys(this.examAnswers || {}).length, examCorrect: Object.values(this.examAnswers || {}).filter(Boolean).length, examTotal: (this.queue || []).length });
    this.renderStudyModes();
  },
  startMeasurement() {
    if (this.data.busy) return;
    const cards = bank.vocabularyCards.filter(card => card.language === this.data.language);
    const items = shared.buildVocabularyMeasurement(cards, this.data.level);
    this.measurement = { id: `mini-measure-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}`, owner: this.owner, language: this.data.language, items, answers: {}, pool: cards.filter(card => shared.vocabularyMatchesLevel(card, this.data.level)).length };
    this.setData({ view: 'measurement', measurementIndex: 0, measurementDone: false, measurementReady: false, measurementItems: items, measurementEmpty: !items.length });
    this.renderStudyModes();
  },
  answerMeasurement(event) {
    if (!this.measurement || this.data.measurementDone || this.data.measurementReady || this.data.busy || this.owner !== this.measurement.owner) return;
    const index = Number(event.currentTarget.dataset.index), item = this.measurement.items[this.data.measurementIndex];
    if (!item || !Number.isInteger(index) || !item.options[index]) return;
    this.measurement.answers[item.id] = index;
    const next = this.data.measurementIndex + 1;
    this.setData(next < this.measurement.items.length ? { measurementIndex: next } : { measurementReady: true });
    this.renderStudyModes();
  },
  async finishMeasurement() {
    const test = this.measurement;
    if (!test || !test.items.length || this.data.measurementDone || !this.data.measurementReady || this.owner !== test.owner || test.items.some(item => !Object.prototype.hasOwnProperty.call(test.answers, item.id))) return;
    return this.perform(async () => {
      this.signedIn();
      const answers = test.items.map(item => ({ lemma: item.lemma, correct: item.options[test.answers[item.id]] === item.gloss }));
      this.wordMemory = vocabulary.recordMeasurement(this.wordMemory, test.language, test.id, answers);
      this.record.vocab = this.wordMemory.stats;
      this.persistGuest();
      const score = answers.filter(item => item.correct).length;
      this.setData({ measurementDone: true, measurementScore: score, measurementEstimate: Math.round(score / answers.length * test.pool) });
      this.render();
      if (this.owner) {
        const result = await vocabulary.sync(this.owner);
        if (!this.alive || this.owner !== test.owner) return;
        this.wordMemory = result.memory;
        this.record.vocab = result.memory.stats;
        this.setData({ sync: 'synced' });
        this.render();
      }
    });
  },
};
module.exports = { studyActions };
