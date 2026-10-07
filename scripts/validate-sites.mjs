import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const workerPath = resolve(root, "dist", "server", "index.js");
const manifestPath = resolve(root, "dist", ".openai", "hosting.json");

const [source, manifest] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);

JSON.parse(manifest);
const moduleUrl = pathToFileURL(workerPath).href;
const worker = await import(moduleUrl);
assert.equal(typeof worker.default?.fetch, "function");

console.log("Validated Sites Worker artifact");
