import assert from "node:assert/strict";
import test from "node:test";
import {
  storyNodesForPace,
  storyPaces,
  storyScore,
  xiangshanLatinStory,
} from "../data/story.ts";
import { lexiconSeed } from "../data/resources.ts";
import { shuffle } from "../lib/shuffle.ts";

test("the standard story keeps the complete six-stage learning loop", () => {
  const nodes = storyNodesForPace("standard");
  assert.deepEqual(nodes.map((node) => node.stage), ["hook", "explore", "negotiate", "act", "notice", "echo"]);
  assert.equal(storyNodesForPace("deep").length, 6);
  assert.equal(storyPaces.standard.duration, "8–12 分钟");
  assert.equal(storyPaces.deep.duration, "约 20 分钟");
});

test("the quick route is a short retrieval path rather than a second chapter", () => {
  assert.deepEqual(storyNodesForPace("quick").map((node) => node.id), ["explore", "act", "notice", "echo"]);
  assert.equal(storyPaces.quick.duration, "约 3 分钟");
});

test("every decision has one answer and an explicit repair path", () => {
  const decisions = xiangshanLatinStory.nodes.filter((node) => node.choices?.length);
  assert.ok(decisions.length >= 3);
  for (const node of decisions) {
    assert.equal(node.choices?.filter((choice) => choice.correct).length, 1, `${node.id} must have one best answer`);
    assert.ok(node.repairPrompt, `${node.id} must have a repair prompt`);
  }
});

test("story scoring only counts answered decisions", () => {
  const nodes = storyNodesForPace("quick");
  assert.deepEqual(storyScore({ explore: "a", act: "b", notice: "a" }, nodes), { correct: 2, total: 4 });
  assert.deepEqual(storyScore({}, nodes), { correct: 0, total: 4 });
});

test("answer choices can move without changing their answer identity", () => {
  const choices = xiangshanLatinStory.nodes.find((node) => node.id === "explore")?.choices ?? [];
  const shuffled = shuffle(choices, () => 0);
  assert.deepEqual(shuffled.map((choice) => choice.id), ["b", "c", "a"]);
  assert.equal(shuffled.findIndex((choice) => choice.correct), 2);
  assert.deepEqual(choices.map((choice) => choice.id), ["a", "b", "c"]);
  assert.deepEqual(storyScore({ explore: shuffled[2].id }, storyNodesForPace("standard")), { correct: 1, total: 5 });
});

test("the prototype is clearly labeled as original training content", () => {
  assert.equal(xiangshanLatinStory.sourceStatus, "original-training");
  assert.equal(xiangshanLatinStory.contentReviewStatus, "draft");
  assert.match(xiangshanLatinStory.setting, /当代北京/);
});

test("every story target can continue into the existing Latin lexicon", () => {
  const latinLemmas = new Set(lexiconSeed.filter((entry) => entry.language === "la").map((entry) => entry.lemma));
  for (const lemma of xiangshanLatinStory.targetItems) assert.ok(latinLemmas.has(lemma), `${lemma} must exist in the Latin lexicon`);
});
