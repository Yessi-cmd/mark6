import { writeFile } from "node:fs/promises";
import worker from "../dist/server/index.js";

const response = await worker.fetch(
  new Request("https://mark6.norliva.top/", { headers: { accept: "text/html" } }),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  {
    waitUntil() {},
    passThroughOnException() {},
  },
);

if (!response.ok) {
  throw new Error(`Static export failed with HTTP ${response.status}`);
}

await writeFile(new URL("../dist/client/index.html", import.meta.url), await response.text(), "utf8");
console.log("Generated dist/client/index.html for mark6.norliva.top");
