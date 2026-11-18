import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, TOKEN_ITEMS } from "../src/config.ts";
import { showFooterSettings } from "../src/settings-ui.ts";
import { initTheme } from "@earendil-works/pi-coding-agent";

test("settings toggles preview and save each token metric", async () => {
  initTheme("dark", false);
  const root = await mkdtemp(join(tmpdir(), "footer-settings-"));
  try {
    const config = structuredClone(DEFAULT_CONFIG);
    const filePath = join(root, "config.json");
    const notifications = [];
    const ctx = {
      mode: "tui",
      ui: {
        notify: (message, level) => notifications.push({ message, level }),
        custom: async (factory) => {
          let closed = false;
          const theme = { fg: (_color, text) => text, bold: (text) => text };
          const screen = factory({ requestRender() {} }, theme, {}, () => { closed = true; });
          // Path has three controls, git/session have two each, then Tokens visibility.
          for (let i = 0; i < 8; i++) screen.handleInput("\x1b[B");
          for (const field of Object.keys(TOKEN_ITEMS)) {
            assert.ok(screen.render(160).join("\n").includes(TOKEN_ITEMS[field]));
            screen.handleInput("\r");
            screen.handleInput("\x1b[B");
            screen.handleInput("\r");
            assert.equal(config.tokens[field], false, `${field} previews immediately`);
            screen.handleInput("\x1b[B");
          }
          screen.handleInput("\x1b");
          assert.equal(closed, true);
        },
      },
    };
    assert.equal(await showFooterSettings(ctx, config, filePath), true);
    const saved = JSON.parse(await readFile(filePath, "utf8"));
    for (const field of Object.keys(TOKEN_ITEMS)) assert.equal(saved.tokens[field], false);
    assert.ok(notifications.every(({ level }) => level === "info"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
