# pi-footer-kit

`pi-footer-kit` keeps Pi's native footer layout while applying a modest semantic color palette by default. No config file is needed on first install. You can also shorten paths, hide fields, customize colors, and style status items from other extensions without replacing the footer with a different statusline.

The initial renderer is based on Pi `1.0.1` (the footer source is identical to Pi `1.0.0`). It uses public extension APIs and preserves the native multi-line layout. A few details rely on private Pi state and are intentionally omitted: routed-model display, the auto-compaction label, the experimental-feature marker, and subscription badges beyond Kimi Coding.

## Install

```sh
pi install npm:pi-footer-kit
```

Or load the extension locally during development:

```sh
pi --extension ./src/index.ts
```

## Configuration

The default palette uses Pi theme roles out of the box: accent path/model, success git branch, warning-colored tokens, context colors based on usage, and automatic thinking-level colors. To customize it, create `<agent-dir>/pi-footer-kit.json` (normally `~/.pi/agent/pi-footer-kit.json`):

```json
{
  "path": { "display": "basename", "color": "dim" },
  "git": { "color": "success" },
  "context": { "display": "percentage", "color": "warning" },
  "model": { "color": "accent" },
  "extensionStatus": {
    "color": "native",
    "colors": {
      "caffeinate": "accent"
    }
  }
}
```

A trusted project may add `.pi/pi-footer-kit.json`; project values override user values component-by-component. Pi loads project configuration only after project trust is granted.

Supported component options:

- Components: `path`, `git`, `sessionName`, `tokens`, `cost`, `context`, `model`, `provider`, `thinking`, and `extensionStatus`.
- `visible`: `true` or `false` for every component.
- `color`: `native` or any Pi theme color (`accent`, `success`, `warning`, `muted`, `dim`, and the full theme palette). `auto` is also available for `thinking`.
- `path.display`: `native`, `full`, `basename`, or `segments`; `segments` accepts an integer from 1 to 50.
- `context.display`: `native`, `percentage`, `used`, `used-total`, or `percentage-total`. `tokens.display` and `model.display` accept `native` only.
- `extensionStatus.color`: fallback color for third-party statuses. `native` (the default) preserves the extension's own styling.
- `extensionStatus.colors`: optional status-key overrides. For example, `"caffeinate": "accent"` colors Pi Caffeinated's `☕ caffeinated` status.

Run `/footer-kit` (or `/footer-kit settings`) to open the interactive settings view. It always saves to your global user config; each change is saved immediately and previewed in the footer without reloading. You can also set a value directly, for example `/footer-kit set path.color warning` or `/footer-kit set path.display basename`; add `user` or `project` after `set` to choose the destination directly. Use `/footer-kit config` to inspect the merged config and all available values. Manual JSON edits still require Pi's native `/reload`.

## Status items from other extensions

Third-party extensions that call `ctx.ui.setStatus(key, text)` continue to appear in the footer. By default their ANSI/theme styling is kept. Set a global or per-key color override to replace that styling with a Pi semantic theme color.

An extension that calls `ctx.ui.setFooter()` replaces the same footer singleton. Pi currently has no footer composition API, so two custom-footer extensions cannot both own the footer reliably. Widgets and overlays use separate APIs and are unaffected.

The settings screen mutates the active footer configuration and requests a render as you change values. It does not call `/reload`: reloading would close the settings view and is unnecessary for live preview.

## Upstream maintenance

Compare the latest published Pi footer sources with the committed baseline:

```sh
npm run upstream:check
```

To fetch the latest release for side-by-side comparison with `src/footer/native-footer.ts`:

```sh
npm run upstream:fetch
```

To inspect a specific release:

```sh
npm run upstream:check -- --version 1.0.1
npm run upstream:fetch -- --version 1.0.1
```

The fetch command stores pristine, versioned sources under `upstream/pi/<version>/` and records the npm release's immutable git commit and file hashes. It never overwrites the adapted renderer. See [CONTRIBUTING.md](CONTRIBUTING.md) before updating the baseline or porting changes.

## Development

```sh
npm test
```

Pi supplies `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` when loading the extension.
