import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

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

await cp(resolve(root, "worker"), resolve(dist, "server"), { recursive: true });
// Sites receives plain JavaScript; share the same avatar validator as both clients.
await mkdir(resolve(dist, "lib"), { recursive: true });
const avatar = await readFile(resolve(root, "lib/community-avatar.ts"), "utf8");
await writeFile(resolve(dist, "lib/community-avatar.js"), ts.transpileModule(avatar, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const communityPath = resolve(dist, "server/community.js");
await writeFile(communityPath, (await readFile(communityPath, "utf8")).replace("../lib/community-avatar.ts", "../lib/community-avatar.js"));


const manifest = JSON.parse(
  await readFile(resolve(dist, ".openai", "hosting.json"), "utf8"),
);
if (!manifest.project_id) throw new Error("Missing Sites project_id");

console.log("Prepared Sites artifact in dist/");
