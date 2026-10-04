import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const PACKAGE_NAME = "@earendil-works/pi-coding-agent";
export const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const BASELINE_FILE = new URL("../upstream/pi/baseline.json", import.meta.url);

export const UPSTREAM_FILES = [
  "packages/coding-agent/src/modes/interactive/components/footer.ts",
  "packages/coding-agent/src/core/footer-data-provider.ts",
];

export async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "pi-footer-kit-upstream-check" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  return response.text();
}

export async function resolveRelease(version) {
  const suffix = version ? `/${encodeURIComponent(version)}` : "/latest";
  const registryUrl = `https://registry.npmjs.org/@earendil-works%2Fpi-coding-agent${suffix}`;
  const metadata = JSON.parse(await fetchText(registryUrl));
  if (!metadata.version || !metadata.gitHead) {
    throw new Error(`npm metadata for ${version ?? "latest"} is missing version or gitHead`);
  }
  if (!/^[0-9a-f]{40}$/i.test(metadata.gitHead)) {
    throw new Error(`Unexpected Pi gitHead for ${metadata.version}: ${metadata.gitHead}`);
  }
  return {
    name: metadata.name,
    version: metadata.version,
    commit: metadata.gitHead,
    registryUrl,
  };
}

export async function fetchReleaseFiles(release) {
  const files = {};
  for (const sourcePath of UPSTREAM_FILES) {
    const url = `https://raw.githubusercontent.com/earendil-works/pi/${release.commit}/${sourcePath}`;
    files[sourcePath] = {
      url,
      content: await fetchText(url),
    };
  }
  return files;
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function readBaseline() {
  let contents;
  try {
    contents = await readFile(BASELINE_FILE, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Missing ${BASELINE_FILE.pathname}; fetch and review a baseline first.`);
    }
    throw error;
  }
  const baseline = JSON.parse(contents);
  if (typeof baseline.version !== "string") {
    throw new Error(`${BASELINE_FILE.pathname} must contain a string "version"`);
  }
  return baseline;
}

export function unifiedDiff(beforeText, afterText, name) {
  const before = beforeText.split("\n");
  const after = afterText.split("\n");
  const rows = before.length + 1;
  const cols = after.length + 1;
  const lcs = Array.from({ length: rows }, () => new Uint32Array(cols));

  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lcs[i][j] = before[i] === after[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const diff = [`--- a/${name}`, `+++ b/${name}`, `@@ -1,${before.length} +1,${after.length} @@`];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      diff.push(` ${before[i]}`);
      i++;
      j++;
    } else if (i < before.length && (j === after.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      diff.push(`-${before[i++]}`);
    } else {
      diff.push(`+${after[j++]}`);
    }
  }
  return diff.join("\n");
}
