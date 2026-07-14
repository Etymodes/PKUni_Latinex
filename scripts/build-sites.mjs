import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { force: true, recursive: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });
await cp(resolve(root, "out"), resolve(dist, "client"), { recursive: true });
await cp(
  resolve(root, ".openai", "hosting.json"),
  resolve(dist, ".openai", "hosting.json"),
);

await cp(resolve(root, "worker", "index.js"), resolve(dist, "server", "index.js"));

const manifest = JSON.parse(
  await readFile(resolve(dist, ".openai", "hosting.json"), "utf8"),
);
if (!manifest.project_id) throw new Error("Missing Sites project_id");

console.log("Prepared Sites artifact in dist/");
