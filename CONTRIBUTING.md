# Maintaining the Pi footer baseline

Pi may change native footer layout, formatting, or status behavior between releases. Keep upstream snapshots pristine and separate from `src/footer/native-footer.ts`.

## Check for changes

```sh
npm run upstream:check
```

The check resolves the latest published `@earendil-works/pi-coding-agent` version and its npm `gitHead`, fetches the footer and footer-data provider from that immutable commit, and compares them with the version selected in `upstream/pi/baseline.json`. It exits with status 1 when source differs, making it suitable for CI. It does not change repository files.

To compare a particular published version:

```sh
npm run upstream:check -- --version 1.0.1
```

## Fetch and review a release

```sh
npm run upstream:fetch
# or select one exact release:
npm run upstream:fetch -- --version 1.0.1
```

Without `--version`, this fetches the latest published release. It writes a new pristine snapshot under `upstream/pi/<version>/` and prints its hashes. Compare that source with `src/footer/native-footer.ts`. Existing snapshots are immutable; if the recorded files unexpectedly differ, investigate rather than overwriting them.

Review the diff between the current baseline and fetched sources. Then:

1. Port relevant behavior into `src/footer/native-footer.ts` while keeping configuration hooks separate.
2. Run `npm test` and visually compare default rendering against the Pi version being targeted.
3. Update the synchronization marker in `src/index.ts` and `README.md`.
4. Change `upstream/pi/baseline.json` to the reviewed version and commit both the snapshot and the baseline-pointer change.

The check needs network access; rendering and tests do not. Do not fetch upstream sources as part of package installation or normal footer rendering.

## Attribution

The upstream files are MIT-licensed Pi source snapshots. Keep their license headers intact. The adapted renderer is independently organized and uses public Pi extension APIs; review source and licensing implications whenever upstream code is copied or materially adapted.
