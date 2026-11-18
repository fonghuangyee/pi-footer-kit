import test from "node:test";
import assert from "node:assert/strict";
import { resolveRelease, sha256, unifiedDiff } from "../scripts/upstream-lib.mjs";

const commit = "b4afdddf44e059c67ccf5097e5317d913521b470";
const registryUrl = "https://registry.npmjs.org/@earendil-works%2Fpi-coding-agent";
const tagUrl = "https://api.github.com/repos/earendil-works/pi/commits/v1.5.2";

test("release lookup uses npm gitHead without requesting GitHub", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, `${registryUrl}/1.0.1`);
    return Response.json({ name: "pi", version: "1.0.1", gitHead: commit });
  });
  assert.deepEqual(await resolveRelease("1.0.1"), {
    name: "pi", version: "1.0.1", commit, registryUrl: `${registryUrl}/1.0.1`,
  });
});

test("release lookup resolves the published version's tag when npm omits gitHead", async (t) => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(url);
    if (url === `${registryUrl}/latest`) return Response.json({ name: "pi", version: "1.5.2" });
    assert.equal(url, tagUrl);
    return Response.json({ sha: commit });
  });
  assert.deepEqual(await resolveRelease(), {
    name: "pi", version: "1.5.2", commit, registryUrl: `${registryUrl}/latest`,
  });
  assert.deepEqual(urls, [`${registryUrl}/latest`, tagUrl]);
});

test("release lookup rejects missing or invalid npm versions", async (t) => {
  for (const version of [undefined, "../main", 152]) {
    t.mock.method(globalThis, "fetch", async (url) => {
      assert.equal(url, `${registryUrl}/latest`);
      return Response.json({ version });
    });
    await assert.rejects(resolveRelease(), /missing or invalid version/);
  }
});

test("release lookup rejects invalid commits from npm or GitHub", async (t) => {
  for (const gitHead of ["invalid", undefined]) {
    t.mock.method(globalThis, "fetch", async (url) => {
      if (url === `${registryUrl}/latest`) return Response.json({ version: "1.5.2", gitHead });
      assert.equal(url, tagUrl);
      return Response.json({ sha: "invalid" });
    });
    await assert.rejects(resolveRelease(), /Unexpected Pi commit/);
  }
});

test("release lookup reports GitHub errors instead of using another ref", async (t) => {
  for (const status of [404, 403]) {
    t.mock.method(globalThis, "fetch", async (url) => {
      if (url === `${registryUrl}/latest`) return Response.json({ version: "1.5.2" });
      assert.equal(url, tagUrl);
      return new Response("", { status });
    });
    await assert.rejects(resolveRelease(), new RegExp(`HTTP ${status}`));
  }
});

test("upstream hashes are deterministic", () => {
  assert.equal(
    sha256("footer"),
    "0301844ccd8e9ca705291e7aacd1053a4cf9987d4843d6d5c91985df9c3f96ab",
  );
});

test("upstream diff reports additions and removals", () => {
  const diff = unifiedDiff("one\ntwo\n", "one\nthree\n", "footer.ts");
  assert.match(diff, /^--- a\/footer\.ts/m);
  assert.match(diff, /^\+\+\+ b\/footer\.ts/m);
  assert.match(diff, /^-two$/m);
  assert.match(diff, /^\+three$/m);
});
