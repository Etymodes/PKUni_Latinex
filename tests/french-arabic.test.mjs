import assert from 'node:assert/strict';
import test from 'node:test';
import { frenchArabicQuestions, frenchArabicVocabulary, frenchArabicEnglish } from '../data/french-arabic.ts';
import { studyQuestions } from '../data/study-questions.ts';
import { vocabularyCards, vocabularyKey } from '../data/vocabulary.ts';
import { makePrediction, completeVocabularyReview, isVocabularyReviewEvent } from '../lib/vocabulary-model.ts';
test('French and Modern Standard Arabic supply real tiered bilingual starter content with stable unique keys', () => {
  assert.equal(frenchArabicQuestions.length, 48);
  assert.equal(frenchArabicVocabulary.length, 32);
  assert.equal(new Set(studyQuestions.map(q => q.id)).size, studyQuestions.length);
  assert.equal(new Set(vocabularyCards.map(card => vocabularyKey(card.language, card.term))).size, vocabularyCards.length);
  for (const language of ['fr', 'ar']) for (const level of ['C','F','G','M']) {
    assert.equal(frenchArabicQuestions.filter(q => q.language === language && q.level === level).length, {C:6,F:7,G:11,M:0}[level]);
    assert.equal(frenchArabicVocabulary.filter(q => q.language === language && q.level === level).length, {C:4,F:4,G:8,M:0}[level]);
  }
  for (const q of frenchArabicQuestions) {
    assert.equal(new Set(q.options).size, 4);
    assert.ok(q.options[q.answer]);
    assert.ok(q.targetLang && q.text);
    assert.ok(frenchArabicEnglish[q.prompt]);
    assert.ok(frenchArabicEnglish[q.explanation]);
    for (const option of q.options) if (/[\u3400-\u9fff]/.test(option)) assert.ok(frenchArabicEnglish[option]);
    assert.equal(q.sourceStatus, 'original');
    assert.equal(q.reviewStatus, 'draft');
    assert.ok(studyQuestions.some(item => item.id === q.id));
  }
  for (const card of frenchArabicVocabulary) {
    assert.ok(frenchArabicEnglish[card.meaning]);
    assert.ok(card.context);
    assert.equal(card.term, card.term.normalize('NFC'));
    assert.equal(card.term, card.term.trim());
    assert.equal(card.dictionaryReferences, undefined, 'No unverified dictionary endorsement.');
    assert.ok(vocabularyCards.some(item => item.id === card.id));
    const now='2026-10-07T12:00:00.000Z';
    const prediction=makePrediction([],card.language,card.term,now,'word',undefined,now);
    const event=completeVocabularyReview(prediction,'approximate',now,'test-'+card.id);
    assert.equal(isVocabularyReviewEvent(event),true);
    assert.equal(event.lemma,card.term);
  }
});
