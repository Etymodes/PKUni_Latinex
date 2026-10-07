const api = require('./api');
const config = require('./config');
const bank = require('../data/bank');
const shared = require('../data/shared');
const { contentText, localizeQuestion } = require('../data/content-locale');

const questionCategories = ['all', 'vocabulary', 'morphology', 'syntax', 'sentencePattern', 'classics', 'translation', 'reading', 'listening'];
const is1992Question = question => shared.questionInCollection(question, 'jlpt-1992-1');

function displayQuestion(question, locale) {
  const display = localizeQuestion(question, locale);
  return display.occurrences ? { ...display, occurrences: display.occurrences.map(item => ({ ...item, label: contentText(item.label, locale) })) } : display;
}

function questionScope(all, state, record) {
  const fullPaper = Boolean(state.fullPaper);
  const collectionId = state.selectedPaper || 'jlpt-1992-1';
  let range = all.filter(q => fullPaper ? shared.questionInCollection(q, collectionId) : shared.matchesLevel(q, state.level));
  if (fullPaper) range = range.sort((a, b) => shared.collectionOrder(a, collectionId) - shared.collectionOrder(b, collectionId)).map(q => shared.questionForCollection(q, collectionId));
  const query = (state.search || '').trim().toLowerCase();
  const filtered = range.filter(q => {
    const english = localizeQuestion(q, 'en');
    return (state.filter === 'all' || (state.filter === 'wrong'
    ? record.progress[q.id] === 'wrong' || record.progress[q.id] === 'review' : record.bookmarks.includes(q.id)))
    && (state.category === 'all' || q.category === state.category)
    && (!query || [q.prompt, q.explanation, q.text, q.latin, q.context, q.id, q.originalNumber, q.passage, ...(q.tags || []), english.prompt, english.context, english.explanation, ...(english.tags || [])].filter(Boolean).join(' ').toLowerCase().includes(query));
  });
  const paperQuestions = fullPaper ? filtered.map(q => ({ id: q.id, label: `${q.originalNumber || q.id} · ${shared.normalizePikkuLevel(q.language || 'la', q.level)}` })) : [];
  return { fullPaper, range, filtered, paperQuestions, paperQuestionIndex: Math.max(0, paperQuestions.findIndex(q => state.question && q.id === state.question.id)) };
}

function mediaUrl(src) {
  if (typeof src !== 'string') return '';
  if (src.startsWith('/media/')) return config.apiOrigin.replace(/\/$/, '') + src;
  return /^https:\/\/[^\s]+$/.test(src) ? src : '';
}
const timeLabel = seconds => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const questionActions = {
  changeFilter(event) {
    if (this.data.busy) return;
    this.stopQuestionAudio();
    this.setData({ filter: event.currentTarget.dataset.filter, question: null });
    this.render();
  },
  changeCategory(event) {
    if (this.data.busy) return;
    const category = questionCategories[Number(event.detail.value)];
    if (!category) return;
    this.stopQuestionAudio();
    this.setData({ category, question: null });
    this.render();
  },
  changeSearch(event) {
    if (this.data.busy) return;
    this.setData({ search: event.detail.value });
    this.render();
  },
  toggleBrowse() { this.setData({ browse: !this.data.browse }); },
  openQuestionBank() {
    if (this.data.busy) return;
    this.resetStudyModes();
    this.stopQuestionAudio();
    this.queue = [];
    this.activeQuestion = null;
    this.setData({ view: 'papers', paperSearch: '', question: null, fullPaper: false, category: 'all', search: '' });
    this.render();
  },
  searchPapers(event) {
    this.setData({ paperSearch: event.detail.value });
    this.render();
  },
  selectPaper(event) {
    const item = this.data.matchingPapers[Number(event.detail.value)];
    if (item) { this.setData({ selectedPaper: item.id }); this.render(); }
  },
  changePaper(event) {
    const item = this.data.paperItems[Number(event.detail.value)];
    if (item) this.openPaper({ currentTarget: { dataset: { collection: item.id } } });
  },
  openPaper(event) {
    if (this.data.busy) return;
    this.resetStudyModes();
    const dataset = event && event.currentTarget.dataset || {};
    const selectedPaper = dataset.collection || this.data.selectedPaper || 'jlpt-1992-1';
    if (!this.data.paperItems.some(item => item.id === selectedPaper)) return;
    const requested = dataset.category;
    const category = ['vocabulary', 'listening', 'reading', 'sentencePattern'].includes(requested) ? requested : 'all';
    this.stopQuestionAudio();
    this.setData({ fullPaper: true, selectedPaper, view: 'practice', filter: 'all', category, search: '', question: null, browse: false });
    this.render();
    this.queue = this.filtered.slice();
    this.setData({ questionIndex: 0, questionTotal: this.queue.length });
    this.showQuestion(this.queue[0]);
  },
  exitPaper() {
    if (this.data.busy) return;
    this.stopQuestionAudio();
    this.setData({ fullPaper: false, category: 'all', question: null });
    this.render();
  },
  jumpQuestion(event) {
    if (this.data.busy) return;
    const row = (this.data.paperQuestions || [])[Number(event.detail.value)];
    if (row) this.openQuestion({ currentTarget: { dataset: { id: row.id } } });
  },
  startPractice() {
    if (this.data.busy) return;
    this.resetStudyModes();
    if (this.data.view === 'home') {
      this.setData({ fullPaper: false, filter: 'all', category: 'all', search: '' });
      this.render();
    }
    this.queue = this.data.fullPaper ? this.filtered.slice() : shared.shuffle(this.filtered);
    this.setData({ view: 'practice', browse: false, questionIndex: 0, questionTotal: this.queue.length });
    this.showQuestion(this.queue[0]);
  },
  openQuestion(event) {
    if (this.data.busy) return;
    const index = this.filtered.findIndex(q => q.id === event.currentTarget.dataset.id);
    if (index < 0) return;
    this.queue = this.filtered.slice();
    this.setData({ questionIndex: index, questionTotal: this.queue.length, browse: false });
    this.showQuestion(this.queue[index]);
  },
  showQuestion(question) {
    this.destroyQuestionAudio();
    this.activeQuestion = question || null;
    const display = question ? displayQuestion(question, this.data.locale) : null;
    const choices = question ? shared.questionOptionOrder(question).map(index => ({ index, text: display.options[index], rtl: /[\u0600-\u06ff]/.test(display.options[index]) })) : [];
    const images = question ? (display.images || []).map(image => ({ ...image, src: mediaUrl(image.src) })).filter(image => image.src) : [];
    this.setData({ question: display, questionImages: images, questionAudioSource: question ? mediaUrl(question.audio && question.audio.src) : '',
      visibleTranscript: '', transcriptOpen: false, choices, revealed: false, submitted: false, selected: -1, answerCorrect: false,
      audioPlaying: false, audioError: '', audioCurrent: 0, audioDuration: 0, audioTime: '0:00', audioTotal: '0:00',
      paperQuestionIndex: Math.max(0, (this.data.paperQuestions || []).findIndex(item => question && item.id === question.id)),
      isBookmarked: question ? this.record.bookmarks.includes(question.id) : false });
  },
  renderQuestion() {
    if (!this.data.question || !this.activeQuestion) return;
    const question = displayQuestion(this.activeQuestion, this.data.locale);
    this.setData({ question, questionImages: (question.images || []).map(image => ({ ...image, src: mediaUrl(image.src) })).filter(image => image.src), choices: this.data.choices.map(choice => ({ index: choice.index, text: question.options[choice.index], rtl: /[\u0600-\u06ff]/.test(question.options[choice.index]) })),
      visibleTranscript: this.data.submitted ? question.transcript || '' : '' });
  },
  nextQuestion() {
    if (this.data.busy) return;
    const index = this.data.questionIndex + 1;
    if (this.data.examActive && index >= (this.queue || []).length) { this.finishExam(); return; }
    this.setData({ questionIndex: index });
    this.showQuestion(this.queue && this.queue[index]);
    if (!this.data.question) this.render();
  },
  async answer(event) {
    if (this.data.busy || this.data.submitted || !this.data.question) return;
    if (this.data.examActive && Date.now() >= this.examDeadline) { this.finishExam(); return; }
    const q = this.activeQuestion || this.data.question;
    const selected = Number(event.currentTarget.dataset.index);
    if (q.type === 'choice' && (!Number.isInteger(selected) || selected < 0 || selected >= (q.options || []).length)) return;
    const correct = q.type === 'choice' ? selected === q.answer : event.currentTarget.dataset.correct === 'yes';
    if (this.data.examActive) this.examAnswers[q.id] = correct;
    this.setData({ selected: q.type === 'choice' ? selected : -1, revealed: true, submitted: true, answerCorrect: correct, visibleTranscript: q.transcript || '' });
    return this.perform(async () => {
      const status = correct ? 'correct' : 'wrong';
      if (this.signedIn()) await api.request('/api/progress', 'POST', { questionId: q.id, language: q.language || 'la', level: q.level, category: q.category, status });
      this.record.progress[q.id] = status;
      this.persistGuest();
      this.render();
    });
  },
  revealAnswer() { if (this.data.question && this.data.question.type === 'self-check') this.setData({ revealed: true }); },
  toggleTranscript() { if (this.data.submitted) this.setData({ transcriptOpen: !this.data.transcriptOpen }); },
  previewQuestionImage(event) {
    const urls = (this.data.questionImages || []).map(image => image.src);
    const current = urls[Number(event.currentTarget.dataset.index)];
    if (current) wx.previewImage({ current, urls });
  },
  destroyQuestionAudio() {
    const audio = this.questionAudio;
    this.questionAudio = null;
    if (audio) { audio.stop(); audio.destroy(); }
  },
  stopQuestionAudio() {
    this.destroyQuestionAudio();
    if (this.alive) this.setData({ audioPlaying: false, audioCurrent: 0, audioTime: '0:00' });
  },
  toggleQuestionAudio() {
    if (this.data.view !== 'practice' || !this.data.questionAudioSource) return;
    if (!this.questionAudio) {
      const audio = wx.createInnerAudioContext();
      this.questionAudio = audio;
      audio.autoplay = false;
      audio.obeyMuteSwitch = false;
      const active = () => this.alive && this.questionAudio === audio;
      const updateTime = () => {
        if (!active()) return;
        const current = Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0;
        const duration = Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : 0;
        this.setData({ audioCurrent: current, audioDuration: duration, audioTime: timeLabel(current), audioTotal: timeLabel(duration) });
      };
      audio.onPlay(() => { if (active()) this.setData({ audioPlaying: true, audioError: '' }); });
      audio.onPause(() => { if (active()) this.setData({ audioPlaying: false }); });
      audio.onEnded(() => { if (active()) this.setData({ audioPlaying: false }); });
      audio.onStop(() => { if (active()) this.setData({ audioPlaying: false, audioCurrent: 0, audioTime: '0:00' }); });
      audio.onCanplay(updateTime);
      audio.onTimeUpdate(updateTime);
      audio.onError(() => { if (active()) this.setData({ audioPlaying: false, audioError: this.data.t.audioError }); });
      audio.src = this.data.questionAudioSource;
    }
    if (this.data.audioPlaying) this.questionAudio.pause();
    else {
      if (this.data.audioDuration && this.data.audioCurrent >= this.data.audioDuration) this.questionAudio.seek(0);
      this.questionAudio.play();
    }
  },
  restartQuestionAudio() {
    this.stopQuestionAudio();
    this.toggleQuestionAudio();
  },
  seekQuestionAudio(event) {
    const position = Number(event.detail.value);
    if (this.questionAudio && Number.isFinite(position)) this.questionAudio.seek(Math.max(0, Math.min(position, this.data.audioDuration)));
  },
};
module.exports = { questionCategories, is1992Question, questionScope, mediaUrl, questionActions };
