import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

const worker = `export default {
  async fetch(request, env, ctx) {
    void ctx;
    const url = new URL(request.url);
    const pathname = url.pathname.endsWith("/")
      ? url.pathname + "index.html"
      : url.pathname;
    const assetUrl = new URL(pathname, request.url);
    let response = await env.ASSETS.fetch(new Request(assetUrl, request));

    if (response.status === 404 && !url.pathname.split("/").pop()?.includes(".")) {
      response = await env.ASSETS.fetch(
        new Request(new URL("/index.html", request.url), request),
      );
    }

    return response;
  },
};
`;

await writeFile(resolve(dist, "server", "index.js"), worker, "utf8");

const manifest = JSON.parse(
  await readFile(resolve(dist, ".openai", "hosting.json"), "utf8"),
);
if (!manifest.project_id) throw new Error("Missing Sites project_id");

console.log("Prepared Sites artifact in dist/");
