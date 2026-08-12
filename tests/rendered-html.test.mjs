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
  assert.doesNotMatch(client, /安心提示/);
  assert.doesNotMatch(client, /brand-mark/);
  assert.match(client, /localStorage/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Permissions-Policy/);
});

test("official draw archive is complete, ordered, and internally valid", async () => {
  const records = JSON.parse(await readFile(new URL("public/data/results.json", root), "utf8"));
  assert.ok(records.length > 4_000);
  assert.equal(records.at(-1).issue, "1993001");
  for (const record of records) {
    assert.match(record.issue, /^\d{7}$/);
    assert.match(record.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(record.numbers.length, 6);
    assert.equal(new Set([...record.numbers, record.special]).size, 7);
    for (const value of [...record.numbers, record.special]) assert.ok(value >= 1 && value <= 49);
  }
  for (let index = 1; index < records.length; index += 1) {
    assert.ok(records[index - 1].date >= records[index].date);
  }
});

test("live results are refreshed from the same origin without stale caching", async () => {
  const [page, client, serviceWorker, caddy] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("public/service-worker.js", root), "utf8"),
    readFile(new URL("deploy/caddy/mark6.norliva.top.caddy", root), "utf8"),
  ]);
  assert.match(page, /results\.json/);
  assert.match(client, /fetch\("\/data\/results\.json"/);
  assert.match(client, /cache: "no-store"/);
  assert.match(client, /service-worker\.js\?v=2/);
  assert.match(client, /updateViaCache: "none"/);
  assert.match(serviceWorker, /safemark6-v2/);
  assert.match(caddy, /@results path \/data\/results\.json/);
  assert.match(caddy, /no-store/);
});
