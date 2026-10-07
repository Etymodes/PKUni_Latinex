import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/vocabulary-model.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { makePrediction, completeVocabularyReview, trainVocabularyModel,
  sanitizeVocabularyReviews, isVocabularyReviewEvent, VOCABULARY_MODEL_VERSION } =
  await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
const at = (day, hour = 0) => new Date(Date.UTC(2026, 0, day, hour)).toISOString();
const event = (id, changes = {}) => ({
  id, language: "ja", lemma: "学ぶ", predictedAt: at(1), targetAt: at(1), answeredAt: at(1, 1),
  outcome: "remembered", probability: 0.5, probabilities: { forgotten: 0.25, approximate: 0.25, remembered: 0.5 }, features: [1, 0, 0, 0, 0, 0],
  modelVersion: VOCABULARY_MODEL_VERSION, mode: "word", ...changes,
});

test("cold start is uncertain and before-answer evidence stays frozen after feedback", () => {
  const prediction = makePrediction([], "ja", "学ぶ", at(2), "word", undefined, at(2));
  assert.equal(prediction.probability, 1 / 3);
  assert.deepEqual(prediction.probabilities, { forgotten: 1 / 3, approximate: 1 / 3, remembered: 1 / 3 });
  assert.equal(prediction.historyCount, 0);
  assert.equal(prediction.hasTimedHistory, false);
  assert.ok(Object.isFrozen(prediction) && Object.isFrozen(prediction.features));
  const completed = completeVocabularyReview(prediction, "approximate", at(2, 1), "first");
  assert.deepEqual(completed.features, prediction.features);
  assert.equal(completed.probability, prediction.probability);
  assert.equal(completed.outcome, "approximate");
  assert.deepEqual(completed.probabilities, prediction.probabilities);
  assert.ok(Object.isFrozen(completed.probabilities));
  assert.throws(() => { completed.probabilities.approximate = 0.9; }, TypeError);
  assert.ok(Object.isFrozen(completed) && Object.isFrozen(completed.features));
  assert.throws(() => { completed.features[0] = 0; }, TypeError);
  assert.throws(() => { prediction.probability = 0.9; }, TypeError);
});

test("date forecasts decay from the last known review, without future label leakage", () => {
  const past = event("past");
  const unseen = event("future", { answeredAt: at(20), outcome: "forgotten" });
  const current = makePrediction([past], "ja", "学ぶ", at(3), "word", undefined, at(3));
  const future = makePrediction([past, unseen], "ja", "学ぶ", at(30), "word", undefined, at(3));
  const sameForecastWithoutFuture = makePrediction([past], "ja", "学ぶ", at(30), "word", undefined, at(3));
  assert.deepEqual(future, sameForecastWithoutFuture);
  assert.ok(future.probability < current.probability);
  assert.ok(future.features[1] > current.features[1]);
  assert.equal(future.historyCount, 1);
  assert.equal(trainVocabularyModel([past, unseen], "ja", at(3)).sampleCount, 1);
  assert.throws(() => completeVocabularyReview(future, "remembered", at(3, 1), "too-early"), RangeError);
});

test("online learning changes predictions, remains bounded, and separates languages and modes", () => {
  const remembered = Array.from({ length: 160 }, (_, index) => event(`yes-${index}`, {
    predictedAt: at(index + 1), targetAt: at(index + 1), answeredAt: at(index + 1, 1),
  }));
  const forgotten = remembered.map((row) => ({ ...row, outcome: "forgotten" }));
  const cutoff = at(170);
  const known = makePrediction(remembered, "ja", "new-word", cutoff, "word", undefined, cutoff);
  const struggling = makePrediction(forgotten, "ja", "new-word", cutoff, "word", undefined, cutoff);
  assert.ok(known.probability > 0.7 && struggling.probability < 0.3);
  assert.equal(makePrediction(remembered, "la", "new-word", cutoff, "word", undefined, cutoff).probability, 1 / 3);
  const contextRows = remembered.map((row) => ({ ...row, mode: "context", features: [1, 0, 0, 0, 0, 1] }));
  const context = makePrediction(contextRows, "ja", "new-word", cutoff, "context", undefined, cutoff);
  const isolated = makePrediction(contextRows, "ja", "new-word", cutoff, "word", undefined, cutoff);
  assert.ok(context.probability > isolated.probability);
  for (const prediction of [known, struggling, context, isolated]) {
    assert.ok(prediction.probability >= 0.02 && prediction.probability <= 0.96);
    assert.equal(prediction.probability, prediction.probabilities.remembered);
    assert.ok(Object.values(prediction.probabilities).every(value => value >= 0.02 && value <= 0.96));
    assert.ok(Math.abs(Object.values(prediction.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
    assert.ok(prediction.features.every((number) => Number.isFinite(number) && Math.abs(number) <= 1));
  }
});

test("saved prequential scores can be worse than baseline and never use fitted probabilities", () => {
  const rows = [event("bad", { probability: 0.9, probabilities: { forgotten: 0.05, approximate: 0.05, remembered: 0.9 }, outcome: "forgotten" })];
  const model = trainVocabularyModel(rows, "ja", at(3));
  assert.ok(Math.abs(model.metrics.brier - (0.95 ** 2 + 0.05 ** 2 + 0.9 ** 2)) < 1e-12);
  assert.ok(Math.abs(model.metrics.logLoss + Math.log(0.05)) < 1e-12);
  assert.equal(model.metrics.count, 1);
  assert.equal(model.metrics.baselineBrier, 2 / 3);
  assert.equal(model.metrics.baselineLogLoss, Math.log(3));
  assert.ok(model.metrics.brier > model.metrics.baselineBrier);
  const empty = trainVocabularyModel([], "ja", at(3));
  assert.equal(empty.metrics.count, 0);
  assert.equal(empty.metrics.brier, null);
  assert.equal(empty.metrics.baselineBrier, null);
});

test("chronological training is deterministic and valid duplicate IDs count once", () => {
  const a = event("a", { predictedAt: at(2), targetAt: at(2), answeredAt: at(2, 1) });
  const b = event("b", { outcome: "forgotten" });
  const first = trainVocabularyModel([a, b], "ja", at(4));
  const reordered = trainVocabularyModel([b, a, b], "ja", at(4));
  assert.deepEqual(first, reordered);
  assert.equal(first.sampleCount, 2);
  assert.equal(sanitizeVocabularyReviews([b, { ...b, outcome: "remembered" }])[0].outcome, "forgotten");
  const reused = makePrediction([a, b], "ja", "学ぶ", at(5), "word", undefined, at(4), first);
  assert.deepEqual(reused, makePrediction([a, b], "ja", "学ぶ", at(5), "word", undefined, at(4)));
  const laterModel = trainVocabularyModel([a, b], "ja", at(10));
  assert.deepEqual(makePrediction([a, b], "ja", "学ぶ", at(5), "word", undefined, at(4), laterModel), reused);
});

test("untrusted imports reject malformed records without mutating or retaining external arrays", () => {
  const good = event("good");
  const invalid = [null, {}, [], "event", { ...good, id: "" }, { ...good, modelVersion: "future-v9" },
    { ...good, probabilities: undefined }, { ...good, probabilities: [0.25, 0.25, 0.5] },
    { ...good, probabilities: { forgotten: 0.3, approximate: 0.3, remembered: 0.5 } },
    { ...good, probabilities: { forgotten: 0.25, approximate: NaN, remembered: 0.5 } },
    { ...good, probabilities: { forgotten: 0.49, approximate: 0.01, remembered: 0.5 } },
    { ...good, probabilities: { forgotten: 0.25, approximate: 0.25, remembered: 0.4 } },
    { ...good, probability: 0.4 }, { ...good, probability: NaN }, { ...good, probability: 1 }, { ...good, features: [1, 0] },
    { ...good, features: [1, Infinity, 0, 0, 0, 0] }, { ...good, features: [1, 0, 0, 0, 0.5, 0] },
    { ...good, mode: "context" }, { ...good, outcome: "correct" }, { ...good, language: "../ja" },
    { ...good, language: "de" }, { ...good, id: "with/slash" }, { ...good, lemma: "x".repeat(161) },
    { ...good, answeredAt: "2026-02-30T00:00:00.000Z" }, { ...good, targetAt: at(4) },
    { ...good, predictedAt: at(4) }, { ...good, targetAt: "2026-01-01T24:00:00.000Z" },
  ];
  invalid.forEach((row) => assert.equal(isVocabularyReviewEvent(row), false));
  assert.deepEqual(sanitizeVocabularyReviews({ reviews: [good] }), []);
  const rows = sanitizeVocabularyReviews([...invalid, good]);
  assert.equal(rows.length, 1);
  good.features[2] = 0.8;
  assert.equal(rows[0].features[2], 0);
  good.probabilities.approximate = 0.8;
  assert.equal(rows[0].probabilities.approximate, 0.25);
  assert.throws(() => makePrediction([], "ja", "word", at(1), "word", undefined, at(3)), RangeError);
});

test("legacy counts require an as-of timestamp and never double-count timed reviews", () => {
  const base = makePrediction([], "ja", "学ぶ", at(5), "word", undefined, at(4));
  const untrusted = makePrediction([], "ja", "学ぶ", at(5), "word", { seen: 100, correct: 100 }, at(4));
  const tooLate = makePrediction([], "ja", "学ぶ", at(5), "word", { seen: 100, correct: 100, asOf: at(8) }, at(4));
  assert.deepEqual(untrusted, base);
  assert.deepEqual(tooLate, base);
  const legacy = makePrediction([], "ja", "学ぶ", at(5), "word", { seen: 100, correct: 90, asOf: at(3) }, at(4));
  assert.ok(legacy.probability > base.probability);
  assert.equal(legacy.hasTimedHistory, false);
  assert.equal(legacy.features[1], 0);
  const rows = [event("old")];
  assert.deepEqual(makePrediction(rows, "ja", "学ぶ", at(5), "word", { seen: 100, correct: 90, asOf: at(3) }, at(4)),
    makePrediction(rows, "ja", "学ぶ", at(5), "word", undefined, at(4)));
});


test("approximate is a learned third class and contributes the midpoint to prior-history features", () => {
  const rows = Array.from({ length: 160 }, (_, index) => event(`partial-${index}`, {
    outcome: "approximate", predictedAt: at(index + 1), targetAt: at(index + 1), answeredAt: at(index + 1, 1),
  }));
  const cutoff = at(170);
  const learned = makePrediction(rows, "ja", "new-word", cutoff, "word", undefined, cutoff);
  assert.ok(learned.probabilities.approximate > 0.7);
  assert.ok(learned.probabilities.approximate > learned.probabilities.forgotten);
  assert.ok(learned.probabilities.approximate > learned.probabilities.remembered);
  const predictions = ["forgotten", "approximate", "remembered"].map(outcome => makePrediction([event(outcome, { outcome })], "ja", "学ぶ", at(3), "word", undefined, at(3)));
  assert.ok(predictions[0].features[3] < predictions[1].features[3] && predictions[1].features[3] < predictions[2].features[3]);
  assert.deepEqual(predictions.map(prediction => prediction.features[4]), [-1, 0, 1]);
  assert.equal(predictions[1].features[3], 0);
  assert.equal(trainVocabularyModel(rows, "ja", cutoff).metrics.count, rows.length);
});

test("legacy events retain their original binary evidence, train v2, and never fabricate three-class evaluation", () => {
  const legacy = { ...event("legacy"), modelVersion: "pikku-recall-v1", probability: 0.91 };
  delete legacy.probabilities;
  const normalized = sanitizeVocabularyReviews([legacy]);
  assert.deepEqual(normalized, [legacy]);
  assert.equal("probabilities" in normalized[0], false);
  assert.equal(isVocabularyReviewEvent({ ...legacy, outcome: "approximate" }), false);
  const legacyOnly = trainVocabularyModel(normalized, "ja", at(3));
  assert.equal(legacyOnly.modelVersion, "pikku-recall-v2");
  assert.equal(legacyOnly.weights.length, 18);
  assert.equal(legacyOnly.sampleCount, 1);
  assert.equal(legacyOnly.metrics.count, 0);
  assert.equal(legacyOnly.metrics.brier, null);
  assert.equal(legacyOnly.metrics.logLoss, null);
  assert.notDeepEqual(legacyOnly.weights, trainVocabularyModel([], "ja", at(3)).weights);
  const current = event("current", { outcome: "approximate", probability: 0.2, probabilities: { forgotten: 0.1, approximate: 0.7, remembered: 0.2 } });
  const combined = trainVocabularyModel([legacy, current], "ja", at(3));
  assert.equal(combined.sampleCount, 2); assert.equal(combined.metrics.count, 1);
  assert.ok(Math.abs(combined.metrics.brier - (0.1 ** 2 + 0.3 ** 2 + 0.2 ** 2)) < 1e-12);
  assert.ok(Math.abs(combined.metrics.logLoss + Math.log(0.7)) < 1e-12);
  assert.deepEqual(legacy, normalized[0], "training cannot replace the legacy snapshot with a v2 prediction");
});


test("equal-length approximate histories get intermediate review priority and forecasts remain normalized and monotonic with time", () => {
  const cutoff = at(20);
  const histories = ["forgotten", "approximate", "remembered"].map(outcome => Array.from({ length: 12 }, (_, index) => event(`${outcome}-${index}`, {
    outcome, predictedAt: at(index + 1), targetAt: at(index + 1), answeredAt: at(index + 1, 1),
  })));
  const retention = prediction => prediction.probabilities.remembered + 0.5 * prediction.probabilities.approximate;
  const predictions = histories.map(history => makePrediction(history, "ja", "学ぶ", cutoff, "word", undefined, cutoff));
  const priority = predictions.map(prediction => 1 - retention(prediction));
  assert.ok(priority[0] > priority[1] && priority[1] > priority[2], "approximate feedback is neither full forgetting nor full recall");
  for (const history of histories) {
    const future = [20, 30, 60, 400].map(day => makePrediction(history, "ja", "学ぶ", at(day), "word", undefined, cutoff));
    future.forEach((prediction, index) => {
      assert.ok(Math.abs(Object.values(prediction.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      assert.equal(prediction.historyCount, 12);
      if (index) {
        assert.ok(prediction.probability <= future[index - 1].probability, "complete recall cannot improve just by waiting");
        assert.ok(retention(prediction) <= retention(future[index - 1]), "partial-credit retention cannot improve just by waiting");
      }
    });
  }
});
