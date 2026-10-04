import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCwdForFooter,
  formatPath,
  formatTokens,
  sanitizeStatusText,
  styleStatusText,
} from "../src/formatters.ts";

const fakeTheme = { fg: (color, text) => `<${color}>${text}</color>` };
const stripSgr = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");

test("native path formatting is home-relative and respects path boundaries", () => {
  assert.equal(formatCwdForFooter("/Users/me/Work/repo", "/Users/me"), "~/Work/repo");
  assert.equal(formatCwdForFooter("/Users/meteor/repo", "/Users/me"), "/Users/meteor/repo");
  assert.equal(formatCwdForFooter("/", "/Users/me"), "/");
});

test("path display supports basename, segments, full, and native", () => {
  const cwd = "/Users/me/Documents/FHY/project";
  assert.equal(formatPath(cwd, "/Users/me", "native"), "~/Documents/FHY/project");
  assert.equal(formatPath(cwd, "/Users/me", "full"), cwd);
  assert.equal(formatPath(cwd, "/Users/me", "basename"), "project");
  assert.equal(formatPath(cwd, "/Users/me", "segments", 2), "FHY/project");
  assert.equal(formatPath("/", "/Users/me", "basename"), "/");
});

test("token counts use Pi's compact footer formatting", () => {
  assert.equal(formatTokens(999), "999");
  assert.equal(formatTokens(1200), "1.2k");
  assert.equal(formatTokens(10500), "11k");
  assert.equal(formatTokens(1_250_000), "1.3M");
});

test("status sanitization removes line breaks and collapses spaces", () => {
  assert.equal(sanitizeStatusText("  ☕\tcaffeinated\n now  "), "☕ caffeinated now");
});

test("native status colors preserve extension ANSI; explicit colors replace them", () => {
  const extensionText = "\x1b[31m☕ caffeinated\x1b[0m";
  assert.equal(styleStatusText(extensionText, "native", fakeTheme, stripSgr), extensionText);
  assert.equal(
    styleStatusText(extensionText, "accent", fakeTheme, stripSgr),
    "<accent>☕ caffeinated</color>",
  );
});
