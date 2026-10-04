#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASELINE_FILE,
  fetchReleaseFiles,
  REPO_ROOT,
  resolveRelease,
  sha256,
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
    console.log("Usage: npm run upstream:fetch [-- --version <pi-version>]\nFetch the latest (or selected) pristine footer source from its npm release's immutable git commit.");
    return;
  }
  if (args.version && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(args.version)) {
    throw new Error("--version must be an exact semantic Pi version, e.g. --version 1.0.0");
  }

  const release = await resolveRelease(args.version);
  if (args.version && release.version !== args.version) {
    throw new Error(`Requested Pi ${args.version}, but npm resolved ${release.version}`);
  }
  const fetched = await fetchReleaseFiles(release);
  const outputDir = resolve(REPO_ROOT, "upstream", "pi", release.version);
  const metadataPath = join(outputDir, "metadata.json");
  const sourceFiles = Object.fromEntries(
    UPSTREAM_FILES.map((sourcePath) => [basename(sourcePath), {
      sourcePath,
      sourceUrl: fetched[sourcePath].url,
      sha256: sha256(fetched[sourcePath].content),
    }]),
  );
  const metadata = {
    package: release.name,
    version: release.version,
    gitHead: release.commit,
    tag: `v${release.version}`,
    fetchedAt: new Date().toISOString(),
    files: sourceFiles,
  };

  try {
    const oldMetadata = JSON.parse(await readFile(metadataPath, "utf8"));
    let identical = oldMetadata.gitHead === metadata.gitHead;
    for (const [fileName, info] of Object.entries(sourceFiles)) {
      const old = await readFile(join(outputDir, fileName), "utf8").catch(() => undefined);
      if (old === undefined || sha256(old) !== info.sha256) identical = false;
    }
    if (identical) {
      console.log(`Pi ${release.version} snapshot already exists and matches ${release.commit}.`);
      console.log(`Compare it with ${resolve(REPO_ROOT, "src/footer/native-footer.ts")} before updating the baseline.`);
      return;
    }
    throw new Error(`Snapshot ${outputDir} already exists but differs. Preserve the old snapshot; investigate before replacing it.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const parent = dirname(outputDir);
  await mkdir(parent, { recursive: true });
  const tempDir = await mkdtemp(join(parent, `.${release.version}-`));
  try {
    for (const [fileName, info] of Object.entries(sourceFiles)) {
      await writeFile(join(tempDir, fileName), fetched[info.sourcePath].content, "utf8");
    }
    await writeFile(join(tempDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    await rename(tempDir, outputDir);
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  try {
    await readFile(fileURLToPath(BASELINE_FILE), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(dirname(fileURLToPath(BASELINE_FILE)), { recursive: true });
    await writeFile(
      fileURLToPath(BASELINE_FILE),
      `${JSON.stringify({ version: release.version }, null, 2)}\n`,
      "utf8",
    );
    console.log(`Initialized upstream baseline pointer to Pi ${release.version}.`);
  }

  console.log(`Fetched pristine Pi ${release.version} footer sources from commit ${release.commit}:`);
  console.log("Compare this snapshot with src/footer/native-footer.ts before updating the baseline.");
  for (const [fileName, info] of Object.entries(sourceFiles)) {
    console.log(`  upstream/pi/${release.version}/${fileName}  sha256:${info.sha256}`);
  }
}

main().catch((error) => {
  console.error(`upstream:fetch failed: ${error.message}`);
  process.exitCode = 1;
});
