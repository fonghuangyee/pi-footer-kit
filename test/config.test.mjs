import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, getConfigPaths, loadConfig, writeConfigValue } from "../src/config.ts";

async function withTempDir(run) {
  const directory = await mkdtemp(join(tmpdir(), "pi-footer-kit-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("default config applies a semantic palette without requiring a file", () => {
  assert.equal(DEFAULT_CONFIG.path.color, "accent");
  assert.equal(DEFAULT_CONFIG.path.segments, 2);
  assert.equal(DEFAULT_CONFIG.git.color, "success");
  assert.equal(DEFAULT_CONFIG.tokens.color, "warning");
  assert.equal(DEFAULT_CONFIG.context.color, "native");
  assert.equal(DEFAULT_CONFIG.model.color, "accent");
  assert.equal(DEFAULT_CONFIG.thinking.color, "auto");
});

test("config paths follow Pi agent dir and project conventions", () => {
  const paths = getConfigPaths("/work/project", { PI_CODING_AGENT_DIR: "~/custom-agent" }, "/Users/test");
  assert.equal(paths.user, "/Users/test/custom-agent/pi-footer-kit.json");
  assert.equal(paths.project, "/work/project/.pi/pi-footer-kit.json");
});

test("project config merges over user config only when trusted", async () => {
  await withTempDir(async (root) => {
    const home = join(root, "home");
    const cwd = join(root, "project");
    const agentDir = join(home, ".pi", "agent");
    await mkdir(agentDir, { recursive: true });
    await mkdir(join(cwd, ".pi"), { recursive: true });
    await writeFile(join(agentDir, "pi-footer-kit.json"), JSON.stringify({
      path: { display: "basename" },
      git: { color: "success" },
      extensionStatus: { colors: { caffeinate: "accent" } },
    }));
    await writeFile(join(cwd, ".pi", "pi-footer-kit.json"), JSON.stringify({
      path: { color: "warning" },
      extensionStatus: { colors: { other: "error" } },
    }));
    const env = { PI_CODING_AGENT_DIR: agentDir };

    const trusted = await loadConfig({ cwd, projectTrusted: true, env, home });
    assert.equal(trusted.config.path.display, "basename");
    assert.equal(trusted.config.path.color, "warning");
    assert.equal(trusted.config.git.color, "success");
    assert.deepEqual(trusted.config.extensionStatus.colors, {
      caffeinate: "accent",
      other: "error",
    });
    assert.equal(trusted.sources.length, 2);

    const untrusted = await loadConfig({ cwd, projectTrusted: false, env, home });
    assert.equal(untrusted.config.path.color, "accent");
    assert.equal(untrusted.config.path.display, "basename");
    assert.deepEqual(untrusted.config.extensionStatus.colors, { caffeinate: "accent" });
    assert.equal(untrusted.sources.length, 1);
  });
});

test("invalid config fields produce warnings and keep safe defaults", async () => {
  await withTempDir(async (root) => {
    const agentDir = join(root, "agent");
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, "pi-footer-kit.json"), JSON.stringify({
      path: { visible: "no", color: "not-a-theme", display: "unknown" },
      cost: { visible: false },
      extensionStatus: { colors: { caffeinate: "also-invalid" } },
      unrecognized: { visible: true },
    }));
    const loaded = await loadConfig({
      cwd: root,
      projectTrusted: false,
      env: { PI_CODING_AGENT_DIR: agentDir },
    });
    assert.equal(loaded.config.path.visible, DEFAULT_CONFIG.path.visible);
    assert.equal(loaded.config.path.color, DEFAULT_CONFIG.path.color);
    assert.equal(loaded.config.path.display, DEFAULT_CONFIG.path.display);
    assert.equal(loaded.config.cost.visible, false);
    assert.deepEqual(loaded.config.extensionStatus.colors, {});
    assert.equal(loaded.warnings.length, 5);
  });
});

test("command setting writes preserve other values and support dotted status keys", async () => {
  await withTempDir(async (root) => {
    const filePath = join(root, "nested", "pi-footer-kit.json");
    await mkdir(join(root, "nested"), { recursive: true });
    await writeFile(filePath, JSON.stringify({ path: { display: "native" }, extensionStatus: { color: "native" } }));
    await writeConfigValue(filePath, ["path", "color"], "warning");
    await writeConfigValue(filePath, ["extensionStatus", "colors", "my.extension"], "accent");

    const saved = JSON.parse(await readFile(filePath, "utf8"));
    assert.deepEqual(saved, {
      path: { display: "native", color: "warning" },
      extensionStatus: { color: "native", colors: { "my.extension": "accent" } },
    });
  });
});

test("writing settings refuses to overwrite malformed config", async () => {
  await withTempDir(async (root) => {
    const filePath = join(root, "pi-footer-kit.json");
    await writeFile(filePath, "{ invalid");
    await assert.rejects(writeConfigValue(filePath, ["path", "color"], "warning"), /Cannot update/);
    assert.equal(await readFile(filePath, "utf8"), "{ invalid");
  });
});

test("malformed JSON is reported without breaking config loading", async () => {
  await withTempDir(async (root) => {
    const agentDir = join(root, "agent");
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, "pi-footer-kit.json"), "{ bad json");
    const loaded = await loadConfig({
      cwd: root,
      projectTrusted: false,
      env: { PI_CODING_AGENT_DIR: agentDir },
    });
    assert.equal(loaded.config.path.display, "native");
    assert.equal(loaded.sources.length, 0);
    assert.match(loaded.warnings[0], /invalid JSON/);
  });
});
