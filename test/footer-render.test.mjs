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
  footer.dispose();
});
