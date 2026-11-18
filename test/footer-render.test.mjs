import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.ts";

let NativeFooter;
let visibleWidth;
try {
  ({ NativeFooter } = await import("../src/footer/native-footer.ts"));
  ({ visibleWidth } = await import("@earendil-works/pi-tui"));
} catch {
  // Pi provides these peer modules when the extension runs; standalone tests may omit them.
}

test("custom footer preserves native layout and can recolor third-party statuses", {
  skip: !NativeFooter ? "Pi footer peer dependency is not installed" : false,
}, () => {
  const ansiByColor = {
    dim: 90,
    success: 32,
    warning: 33,
    error: 31,
    accent: 35,
    thinkingOff: 90,
    thinkingMinimal: 37,
    thinkingLow: 36,
    thinkingMedium: 34,
    thinkingHigh: 35,
    thinkingXhigh: 35,
    thinkingMax: 35,
    thinkingText: 90,
  };
  const theme = {
    fg: (color, text) => `\x1b[${ansiByColor[color] ?? 37}m${text}\x1b[0m`,
  };
  const usage = {
    input: 1_200,
    output: 980,
    cacheRead: 100,
    cacheWrite: 20,
    cost: { total: 0.01 },
  };
  const context = {
    cwd: "/Users/test/Documents/project",
    model: { id: "model-x", provider: "provider-x", contextWindow: 200_000, reasoning: true },
    thinkingLevel: "high",
    getContextUsage: () => ({ tokens: 1_234, contextWindow: 200_000, percent: 73 }),
    sessionManager: {
      getCwd: () => "/Users/test/Documents/project",
      getSessionName: () => undefined,
      getSessionId: () => "session",
      getLeafId: () => "leaf",
      getEntries: () => [{ type: "message", message: { role: "assistant", usage } }],
    },
  };
  const footerData = {
    getGitBranch: () => "main",
    getAvailableProviderCount: () => 2,
    getExtensionStatuses: () => new Map([
      ["caffeinate", "\x1b[31m☕ caffeinated\x1b[0m"],
      ["other", "ready"],
    ]),
    onBranchChange: () => () => {},
  };
  const config = structuredClone(DEFAULT_CONFIG);
  config.path.display = "basename";
  config.context.display = "percentage";
  config.extensionStatus.colors.caffeinate = "accent";

  const footer = new NativeFooter({ requestRender() {} }, theme, context, footerData, config);
  const lines = footer.render(80);
  assert.equal(lines.length, 3);
  assert.ok(lines.every((line) => visibleWidth(line) <= 80));
  assert.match(lines[0], /\x1b\[35mproject/);
  assert.match(lines[0], /\x1b\[32m\(main\)/);
  assert.match(lines[1], /\x1b\[33m↑1\.2k/);
  assert.match(lines[1], /73\.0%/);
  assert.match(lines[2], /\x1b\[35m☕ caffeinated\x1b\[0m/);
  assert.doesNotMatch(lines[2], /\x1b\[31m/);

  config.path.visible = false;
  config.git.visible = false;
  context.sessionManager.getSessionName = () => "session-name";
  const hiddenComponents = footer.render(80);
  assert.match(hiddenComponents[0], /session-name/);
  assert.doesNotMatch(hiddenComponents[0], /•/);
  const metrics = {
    input: "↑1.2k",
    output: "↓980",
    cacheRead: "R100",
    cacheWrite: "W20",
    cacheHitRate: "CH7.6%",
  };
  for (const [field, text] of Object.entries(metrics)) {
    config.tokens[field] = false;
    const stats = footer.render(160)[1];
    assert.ok(!stats.includes(text), `${field} should be hidden`);
    for (const [otherField, otherText] of Object.entries(metrics)) {
      if (otherField !== field) assert.ok(stats.includes(otherText), `${otherField} should stay shown`);
    }
    assert.ok(stats.includes("73.0%"), "context stays shown independently");
    config.tokens[field] = true;
    assert.ok(footer.render(160)[1].includes(text), `${field} should show again`);
  }

  config.tokens.visible = false;
  const hiddenTokens = footer.render(160)[1];
  for (const text of Object.values(metrics)) assert.ok(!hiddenTokens.includes(text));
  assert.ok(hiddenTokens.includes("73.0%"));

  config.tokens.visible = true;
  config.context.visible = false;
  const hiddenContext = footer.render(160)[1];
  assert.ok(!hiddenContext.includes("73.0%"));
  for (const text of Object.values(metrics)) assert.ok(hiddenContext.includes(text));

  for (const field of Object.keys(metrics)) config.tokens[field] = false;
  assert.ok(!/↑|↓|R100|W20|CH|73\.0%/.test(footer.render(160)[1]));
  assert.ok(footer.render(20).every((line) => visibleWidth(line) <= 20));

  config.tokens = { visible: true };
  for (const text of Object.values(metrics)) assert.ok(footer.render(160)[1].includes(text));
  footer.dispose();
});
