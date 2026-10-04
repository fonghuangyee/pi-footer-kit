import test from "node:test";
import assert from "node:assert/strict";
import { sha256, unifiedDiff } from "../scripts/upstream-lib.mjs";

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
