import assert from "node:assert/strict";
import test from "node:test";
import { questionOptionOrder } from "../data/questions.ts";

test("recording and image answer numbers remain stable for keyboard and button selection", () => {
  const question = { options: ["first", "second", "third", "fourth"], answer: 2, shuffleOptions: false };
  const order = questionOptionOrder(question, () => { throw new Error("Original numbered options must not be shuffled"); });
  assert.deepEqual(order, [0, 1, 2, 3]);
  const keyboardSelection = order[Number("3") - 1];
  const buttonSelection = order[2];
  assert.equal(keyboardSelection, question.answer);
  assert.equal(buttonSelection, question.answer);
  assert.equal(question.options[keyboardSelection], "third");
});

test("ordinary questions retain shuffled presentation with original answer indices", () => {
  const options = ["first", "second", "third", "fourth"];
  assert.deepEqual(questionOptionOrder({ options }, () => 0), [1, 2, 3, 0]);
  assert.deepEqual(options, ["first", "second", "third", "fourth"]);
  assert.deepEqual(questionOptionOrder({}), []);
});
