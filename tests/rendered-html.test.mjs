import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("SafeMark6 product UI replaces the starter preview", async () => {
  const [page, layout, client, manifest, worker] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.match(layout, /天天好彩/);
  assert.match(client, /最新开奖记录|今日参考资料|十二生肖号码表/);
  assert.match(client, /localStorage/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Permissions-Policy/);
});

test("draw examples are internally valid", async () => {
  const records = JSON.parse(await readFile(new URL("public/data/results.json", root), "utf8"));
  for (const record of records) {
    assert.equal(record.numbers.length, 6);
    assert.equal(new Set([...record.numbers, record.special]).size, 7);
    for (const value of [...record.numbers, record.special]) assert.ok(value >= 1 && value <= 49);
  }
});
