#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  fetchReleaseFiles,
  readBaseline,
  REPO_ROOT,
  resolveRelease,
  sha256,
  unifiedDiff,
  UPSTREAM_FILES,
} from "./upstream-lib.mjs";

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--version") result.version = args[++i];
    else if (args[i] === "--help" || args[i] === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: npm run upstream:check [-- --version <pi-version>]\nCompare a published Pi footer against upstream/pi/baseline.json. Exits 1 when source differs.");
    return;
  }
  if (args.version && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(args.version)) {
    throw new Error("--version must be an exact semantic Pi version, e.g. 1.0.0");
  }

  const baseline = await readBaseline();
  const target = await resolveRelease(args.version);
  if (args.version && target.version !== args.version) {
    throw new Error(`Requested Pi ${args.version}, but npm resolved ${target.version}`);
  }
  const baselineDir = resolve(REPO_ROOT, "upstream", "pi", baseline.version);
  const fetched = await fetchReleaseFiles(target);
  let changed = false;

  console.log(`Comparing Pi ${target.version} (${target.commit}) against baseline Pi ${baseline.version}.`);
  for (const sourcePath of UPSTREAM_FILES) {
    const fileName = basename(sourcePath);
    const baselineText = await readFile(resolve(baselineDir, fileName), "utf8");
    const upstreamText = fetched[sourcePath].content;
    if (sha256(baselineText) === sha256(upstreamText)) {
      console.log(`UNCHANGED ${fileName}`);
      continue;
    }
    changed = true;
    console.log(`CHANGED ${fileName} (baseline sha256:${sha256(baselineText)}; upstream sha256:${sha256(upstreamText)})`);
    console.log(unifiedDiff(baselineText, upstreamText, fileName));
  }

  if (changed) {
    console.error("Upstream footer source differs. Review the diff, fetch the versioned snapshot, then port changes manually.");
    process.exitCode = 1;
  } else if (target.version !== baseline.version) {
    console.log(`No source differences since Pi ${baseline.version}; the published version is now ${target.version}.`);
  } else {
    console.log("Upstream footer source matches the recorded baseline.");
  }
}

main().catch((error) => {
  console.error(`upstream:check failed: ${error.message}`);
  process.exitCode = 1;
});
