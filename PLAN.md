# pi-footer-kit

A lightweight Pi coding-agent extension that keeps Pi's native footer appearance and behavior as much as possible, while allowing users to customize individual footer components.

The goal is **not** to create another custom status bar, Powerline footer, or redesigned TUI.

The goal is:

> Keep the Pi native footer, but make each component configurable.

---

# 1. Project Goal

`pi-footer-kit` should provide fine-grained control over Pi's footer components.

Users should be able to customize things such as:

- color
- visibility
- display format
- shortening
- labels
- ordering, if practical
- component-specific formatting

Example:

Pi `1.0.0` may display:

```text
~/Documents/FHY/paseo (main)
↑97k ↓23k 46.6%/272k                                      gpt-5.6-sol
```

With `pi-footer-kit`:

```text
paseo (main)
↑97k ↓23k 46.6%                                           gpt-5.6-sol
```

while preserving Pi's native multi-line layout and responsive behavior.

The extension should avoid adding:

- Powerline separators
- unnecessary icons
- additional panels
- extra footer lines
- custom dashboards
- unrelated UI features

---

# 2. Design Philosophy

The extension should follow these principles.

## Preserve native Pi behavior

Where possible, copy Pi's native footer behavior exactly:

- spacing
- truncation
- responsive rendering
- terminal width handling
- token formatting
- context formatting
- git branch display
- model display
- extension statuses

Only customize the parts explicitly configured by the user.

## Native first

Default configuration should look almost identical to the normal Pi footer.

Installing the extension should not immediately make Pi look completely different.

## Semantic theme colors

Do not hard-code colors by default.

Use Pi theme roles such as:

```text
text
dim
muted
accent
success
warning
error
thinkingLow
thinkingMedium
thinkingHigh
```

For example:

```ts
theme.fg("accent", modelName);
```

This means changing the Pi theme automatically changes the footer colors.

## Minimal implementation

Avoid introducing a large UI framework.

Prefer:

```text
Pi native footer logic
        +
small customization layer
        =
pi-footer-kit
```

---

# 3. Main Features

## 3.1 Per-component colors

Allow each footer component to use a different Pi theme color.

Example:

```json
{
  "path": {
    "color": "dim"
  },
  "git": {
    "color": "success"
  },
  "model": {
    "color": "accent"
  },
  "context": {
    "color": "warning"
  }
}
```

Example result:

```text
paseo    main    ↑97k ↓23k    46.6%    gpt-5.6-sol
dim      green     muted       yellow      accent
```

---

# 4. Footer Components

Start with components already present in Pi's native footer.

As of Pi `1.0.0`, the native footer is not one flat status line. It renders:

```text
line 1: path + git branch + optional session name
line 2: token/cache/cost/context stats + provider/model/thinking/routing
line 3: optional extension statuses from ctx.ui.setStatus()
```

Use logical components within that native line structure:

```text
path
git
sessionName
tokens
cacheHitRate
context
cost
model
provider
thinking
routedModel
experimentalIndicator
extensionStatus
```

Tokens may later support subcomponents:

```text
tokens.input
tokens.output
tokens.cacheRead
tokens.cacheWrite
```

`separator` is layout behavior, not a user-visible V1 component. Do not over-engineer this initially or flatten Pi's responsive layout into a different footer.

---

# 5. Path Customization

Path customization is one of the main features.

Original:

```text
~/Documents/FHY/paseo
```

Users should be able to choose different display modes.

## Full (absolute path)

```text
/Users/fhy/Documents/FHY/paseo
```

Configuration:

```json
{
  "path": {
    "display": "full"
  }
}
```

`native` retains Pi's home-abbreviated form, such as `~/Documents/FHY/paseo`.

## Basename

```text
paseo
```

Configuration:

```json
{
  "path": {
    "display": "basename"
  }
}
```

## Last N segments

For:

```text
~/Documents/FHY/paseo
```

With:

```json
{
  "path": {
    "display": "segments",
    "segments": 2
  }
}
```

Display:

```text
FHY/paseo
```

## Home-relative

Potential future option:

```text
~/Documents/FHY/paseo
```

instead of:

```text
/Users/fhy/Documents/FHY/paseo
```

---

# 6. Visibility

Each component should support:

```json
{
  "visible": true
}
```

Example:

```json
{
  "cost": {
    "visible": false
  }
}
```

This allows users to remove information they do not care about.

Example:

```text
paseo    main    46.6%    gpt-5.6-sol
```

instead of:

```text
paseo    main    ↑97k ↓23k    $1.82    46.6%    gpt-5.6-sol
```

---

# 7. Formatting

Individual components should support simple formatting options.

Avoid implementing an arbitrary templating language in the first release.

Prefer predefined display modes.

Example:

```json
{
  "context": {
    "display": "percentage"
  }
}
```

Could display:

```text
46.6%
```

Instead of:

```text
46.6%/272k
```

Other possible modes:

```text
percentage
used
used-total
percentage-total
native
```

The exact supported modes should depend on the data already available from Pi.

---

# 8. Model Customization

Possible model configuration:

```json
{
  "model": {
    "visible": true,
    "color": "accent",
    "display": "native"
  }
}
```

Future display options may include:

```text
native
name
short
```

Example:

```text
anthropic/claude-sonnet-5
```

could potentially become:

```text
sonnet-5
```

This should be added only if model/provider parsing can be implemented reliably.

Do not maintain a large hard-coded list of model aliases.

---

# 9. Git Component

Git branch configuration:

```json
{
  "git": {
    "visible": true,
    "color": "success"
  }
}
```

Example:

```text
main
```

Possible future formatting:

```text
main
git:main
[main]
```

Initial version should remain native:

```text
main
```

---

# 10. Thinking Level

Thinking level should also use Pi theme colors.

Example:

```json
{
  "thinking": {
    "visible": true,
    "color": "thinkingMedium"
  }
}
```

Eventually it may support automatic colors:

```json
{
  "thinking": {
    "color": "auto"
  }
}
```

Where:

```text
low    → thinkingLow
medium → thinkingMedium
high   → thinkingHigh
```

If Pi already performs this mapping internally, reuse the same logic.

---

# 11. Suggested Configuration

Prefer one simple configuration object.

Example:

```json
{
  "path": {
    "visible": true,
    "display": "basename",
    "color": "dim"
  },

  "git": {
    "visible": true,
    "color": "success"
  },

  "tokens": {
    "visible": true,
    "display": "native",
    "color": "muted"
  },

  "cost": {
    "visible": false,
    "color": "muted"
  },

  "context": {
    "visible": true,
    "display": "percentage",
    "color": "warning"
  },

  "model": {
    "visible": true,
    "display": "native",
    "color": "accent"
  },

  "provider": {
    "visible": false,
    "color": "dim"
  },

  "thinking": {
    "visible": true,
    "color": "auto"
  },

  "extensionStatus": {
    "visible": true,
    "color": "native",
    "colors": {
      "caffeinate": "accent"
    }
  }
}
```

`extensionStatus.color` is the fallback for all third-party status entries. `extensionStatus.colors` optionally overrides a specific `ctx.ui.setStatus(key, text)` key. The default `"native"` preserves colors supplied by the producing extension.

---

# 12. Configuration Location

Use extension-owned JSON rather than adding unknown keys to Pi's `settings.json`:

```text
<agent-dir>/pi-footer-kit.json
<project>/.pi/pi-footer-kit.json
```

The agent directory defaults to `~/.pi/agent` and may be changed by `PI_CODING_AGENT_DIR`. Project configuration is optional, applies only after Pi grants project trust, and merges over user configuration.

Read configuration when the extension runtime starts. Manual JSON edits use Pi's native `/reload`; the `/footer-kit settings` command writes extension-owned JSON and applies changes to the active footer immediately, without a file watcher or reload.

Confirm the final project-file discovery and merge behavior with tests before release. Do not write to Pi's own `settings.json` unless Pi later provides a standard namespace for extension settings.

---

# 13. Commands

Do **not** add a separate reload command. Pi's native `/reload` reloads extensions and their configuration, so `/footer-kit reload` would duplicate host behavior and create ambiguous lifecycle semantics.

The footer-kit command opens the interactive settings view by default, and also supports configuration inspection and direct setting updates:

```text
/footer-kit
/footer-kit config
/footer-kit settings
/footer-kit set [user|project] <setting> <value>
```

The settings view always writes to the global user config; direct `set` updates may target user or trusted project config. The settings view exposes component visibility, available colors and display modes, path segment count, and existing per-status color overrides. It saves each change immediately and requests a footer render so the footer below the view acts as a live preview. Do not call `/reload` from the view; that would destroy the preview interaction. Manual JSON edits still use Pi's native `/reload`.

---

# 14. Architecture

The architecture should stay very small.

```text
Pi Footer Data
      │
      ▼
Native-compatible footer renderer
      │
      ▼
Component Formatter
      │
      ├── Path formatter
      ├── Token formatter
      ├── Context formatter
      ├── Model formatter
      └── Git formatter
      │
      ▼
Theme Color Mapper
      │
      ▼
Pi TUI
```

---

# 15. Important Pi API Limitation

Pi currently allows an extension to replace the footer through something similar to:

```ts
ctx.ui.setFooter(...)
```

but does not expose something like:

```ts
ctx.ui.setFooterStyle(...)
```

Therefore `pi-footer-kit` cannot simply mutate the existing native footer.

The implementation will probably need to provide its own footer renderer.

However, the renderer should be based closely on Pi's existing native footer implementation.

---

# 16. Study Pi Native Footer First

Before implementing anything, inspect the current Pi source.

The current native footer implementation is:

```text
packages/coding-agent/src/modes/interactive/components/footer.ts
```

The public data bridge used by custom footers is:

```text
packages/coding-agent/src/core/footer-data-provider.ts
```

The implementation baseline is Pi `1.0.1`; its native footer and footer-data provider sources are identical to the inspected Pi `1.0.0` versions.

Study:

- footer data sources
- rendering order
- responsive layout
- terminal width handling
- path rendering
- token rendering
- context rendering
- git branch
- model name
- thinking level
- cost
- extension statuses
- ANSI width calculation
- truncation logic
- theme calls

Also inspect Pi's official custom footer extension example.

Look for something similar to:

```text
examples/extensions/custom-footer.ts
```

The implementation should use official Pi extension APIs wherever possible.

---

# 17. Implementation Strategy

## Phase 1 — Clone native behavior

First reproduce Pi's current footer with no customization.

Goal:

```text
Pi native footer
```

and:

```text
pi-footer-kit default footer
```

should look visually identical or extremely close.

Do not add customization yet.

This gives us a reliable baseline.

---

# 18. Phase 2 — Component abstraction

Break the native footer into logical components.

Example:

```ts
interface FooterComponentConfig {
  visible?: boolean;
  color?: ThemeColor;
}
```

Then extend only components that need extra formatting.

Example:

```ts
interface PathConfig extends FooterComponentConfig {
  display?: "native" | "full" | "basename" | "segments";
  segments?: number;
}
```

Context:

```ts
interface ContextConfig extends FooterComponentConfig {
  display?:
    | "native"
    | "percentage"
    | "used"
    | "used-total";
}
```

Avoid one giant generic configuration object containing unrelated properties.

---

# 19. Phase 3 — Theme Colors

Add semantic color mapping.

Example:

```ts
renderComponent(
  text,
  config.color ?? defaultColor
)
```

Internally:

```ts
theme.fg(color, text);
```

Validate theme color names.

If an invalid color is configured:

```text
unknownColor
```

fallback to the native/default color.

The extension should never fail to render the footer because of an invalid color.

---

# 20. Phase 4 — Path Formatting

Implement:

```text
native
full
basename
segments
```

Examples:

Input:

```text
~/Documents/FHY/paseo
```

Native:

```text
~/Documents/FHY/paseo
```

Basename:

```text
paseo
```

Segments 2:

```text
FHY/paseo
```

Segments 3:

```text
Documents/FHY/paseo
```

Make sure Windows paths are handled if Pi supports Windows.

Prefer Node's `path` utilities instead of manually splitting `/`.

---

# 21. Phase 5 — Visibility

Add:

```text
visible: false
```

for supported components.

Removing a component must also remove unnecessary separators and spaces.

Bad:

```text
paseo      |      | gpt-5.6
```

Good:

```text
paseo    gpt-5.6
```

---

# 22. Phase 6 — Formatting

Add formatting one component at a time.

Priority:

1. path
2. context
3. model
4. tokens
5. thinking
6. git

Avoid trying to support everything immediately.

---

# 23. Native Defaults

Defaults should preserve Pi's native layout and formatting while applying a modest semantic palette on first install. No config file should be required to see the extension's color customization.

Current defaults:

```text
path          accent
git           success
tokens        warning
cost          muted
context       native severity colors (dim/warning/error)
model         accent
provider      muted
thinking      automatic thinking-level theme color
extension     preserve producer styling
```

Pi's active theme determines the actual color values. Context keeps Pi's native warning/error thresholds; thinking maps its level to the corresponding Pi theme role.

---

# 24. Pi Version Compatibility

This is the biggest maintenance risk.

Because `pi-footer-kit` recreates Pi's footer renderer, Pi may change the native footer in future releases. Keep the adapted renderer isolated from formatters and configuration.

```text
src/
  index.ts

  footer/
    native-footer.ts
    renderer.ts
    components.ts

  config/
    config.ts
    defaults.ts

  formatters/
    path.ts
    context.ts
    model.ts
```

`native-footer.ts` should contain only the smallest practical adaptation of Pi's layout and behavior. Customization hooks should delegate to code outside that file.

---

# 25. Upstream Baseline and Version Marker

Keep a pristine upstream snapshot separate from adapted code:

```text
upstream/
  pi/
    1.0.1/
      footer.ts
      footer-data-provider.ts
      metadata.json
    baseline.json
```

`metadata.json` should record the Pi npm version, git ref/commit, source URL, fetch date, and SHA-256. Preserve Pi's license notice and document any adapted code.

Also mark `src/footer/native-footer.ts` with the synchronized Pi version and commit. Do not add version-dependent runtime branches unless a real compatibility issue requires them.

---

# 26. Automated Upstream Comparison

Add a repository maintenance script, not a Pi slash command:

```text
npm run upstream:check
npm run upstream:fetch                  # latest release
npm run upstream:fetch -- --version 1.1.0
```

Suggested implementation:

```text
scripts/fetch-upstream-footer.mjs
scripts/check-upstream-footer.mjs
```

Behavior:

1. Resolve the requested version; default both commands to the latest published `@earendil-works/pi-coding-agent` npm version.
2. Resolve the npm release's immutable `gitHead` commit (and record its corresponding tag, for example `v1.0.1`); never silently use a moving `main` snapshot.
3. Fetch `packages/coding-agent/src/modes/interactive/components/footer.ts` and, when relevant, `src/core/footer-data-provider.ts`.
4. Verify HTTP failures, record source metadata and SHA-256, and write only under `upstream/pi/<version>/` when explicitly fetching.
5. Diff the fetched source against the currently recorded pristine baseline. Exit non-zero when upstream changed so the command is CI-friendly.
6. Never overwrite `src/footer/native-footer.ts`; port changes manually so customization hooks are reviewed.

When Pi changes the footer:

1. run `npm run upstream:check`
2. review the upstream-to-upstream diff printed by `upstream:check`
3. fetch the release, then compare `upstream/pi/<version>/footer.ts` side-by-side with `src/footer/native-footer.ts`
4. commit the new pristine snapshot after review
5. port relevant changes into `native-footer.ts`
6. retain customization hooks
7. update the synchronization marker
8. run footer snapshot and compatibility tests

Document this workflow in `CONTRIBUTING.md` in V1, and optionally run `upstream:check` on a scheduled CI job. Tests and releases must remain reproducible and must not require network access.

---

# 27. Repository Structure

Suggested initial structure:

```text
pi-footer-kit/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── src/
│   ├── index.ts
│   │
│   ├── footer/
│   │   ├── renderer.ts
│   │   ├── components.ts
│   │   └── native-footer.ts
│   │
│   ├── config/
│   │   ├── config.ts
│   │   ├── defaults.ts
│   │   └── schema.ts
│   │
│   └── formatters/
│       ├── path.ts
│       ├── context.ts
│       └── model.ts
│
├── test/
│   ├── path.test.ts
│   ├── context.test.ts
│   └── renderer.test.ts
│
└── examples/
    └── config.json
```

Keep it smaller if Pi extensions normally use a simpler structure.

Do not create folders purely for architectural purity.

---

# 28. Testing

Testing should focus heavily on rendering compatibility.

## Path tests

Test:

```text
~/Documents/FHY/paseo
```

Expected basename:

```text
paseo
```

Expected segments=2:

```text
FHY/paseo
```

Also test:

```text
/
~/project
/a/b/c
```

and Windows paths if supported.

---

# 29. Width Tests

The footer must work with different terminal widths.

Test examples:

```text
40 columns
60 columns
80 columns
120 columns
160 columns
```

Ensure:

- no broken ANSI sequences
- no visual overflow
- no incorrect truncation
- no unnecessary wrapping

Pi's native behavior should remain the reference.

---

# 30. Theme and Extension Status Tests

Test multiple Pi themes.

For example:

```text
dark theme
light theme
custom theme
```

Semantic colors should follow the active Pi theme automatically. Avoid assumptions such as `warning = yellow` or `success = green`; the theme owns the actual color.

Also test third-party status entries obtained from `footerData.getExtensionStatuses()`:

- plain text such as `pi-caffeinated`'s `☕ caffeinated`
- producer-supplied ANSI/theme colors
- multiple statuses sorted by key, matching native Pi
- newlines, tabs, carriage returns, and repeated spaces normalized like native Pi
- truncation by visible terminal width
- global fallback color and per-key color override

Default `"native"` behavior must preserve producer styling. A configured override must deliberately remove existing SGR styling before applying the selected semantic color; otherwise nested reset codes can defeat the override. Use a proven ANSI utility rather than an incomplete regular expression.

---

# 31. Invalid Configuration Tests

Examples:

```json
{
  "path": {
    "color": "doesNotExist"
  }
}
```

Footer should still render.

Fallback to default.

Similarly:

```json
{
  "path": {
    "display": "invalidMode"
  }
}
```

Fallback to:

```text
native
```

Configuration errors should never break Pi's interactive UI.

---

# 32. Acceptance Criteria

V1 is complete when all of the following work.

## Native behavior

With no custom configuration, `pi-footer-kit` preserves Pi's native layout and data formatting while applying its documented semantic default palette. No config file is required for visible color changes.

## Path shortening

Given:

```text
~/Documents/FHY/paseo
```

configuration:

```json
{
  "path": {
    "display": "basename"
  }
}
```

shows:

```text
paseo
```

## Component colors

Configuration:

```json
{
  "path": {
    "color": "dim"
  },
  "git": {
    "color": "success"
  },
  "model": {
    "color": "accent"
  },
  "context": {
    "color": "warning"
  }
}
```

must render each component using those Pi theme roles.

## Visibility

Configuration:

```json
{
  "cost": {
    "visible": false
  }
}
```

removes cost cleanly without leaving spacing artifacts.

## Theme switching

Changing Pi theme should automatically change footer colors.

No restart should be necessary if Pi provides theme-change events dynamically.

## Third-party extension statuses

Statuses added through `ctx.ui.setStatus()`, including `pi-caffeinated`, remain visible. Their producer styling is preserved by default, and an optional global or per-status-key semantic color override works without corrupting ANSI width or truncation.

---

# 33. V1 Scope

Keep V1 deliberately small.

V1 should support:

```text
per-component color
per-component visibility
path formatting
context formatting
native-compatible rendering
third-party extension statuses
native/preserved status color
optional global and per-status-key color overrides
```

Supporting status colors in V1 is practical because the public footer API already exposes a `ReadonlyMap<string, string>` from `footerData.getExtensionStatuses()`. `pi-caffeinated` uses the public `ctx.ui.setStatus("caffeinate", "☕ caffeinated")` path, so no extension-specific integration is needed.

Compatibility boundary:

- Extensions using `ctx.ui.setStatus()` are supported in V1, including preserved producer colors and optional per-key overrides.
- An extension that calls `ctx.ui.setFooter()` is replacing the same singleton footer as `pi-footer-kit`. Pi does not expose footer composition, so load order decides which replacement wins. Do not claim compatibility with competing custom-footer extensions.
- Widgets and overlays are separate APIs and should continue to work without special integration.

Potentially add model formatting if it is simple.

---

# 34. V1 Non-Goals

Do not add:

- Powerline
- custom icons everywhere
- multiple footer rows
- dashboards
- custom prompts
- token graphs
- quota APIs
- external provider usage APIs
- model pricing lookup
- notifications
- terminal title changes
- session management
- unrelated Pi TUI changes

Those belong in other extensions.

---

# 35. Future Features

Possible later features:

## Component ordering

Example:

```json
{
  "order": [
    "path",
    "git",
    "model",
    "context"
  ]
}
```

Do not implement unless users actually need it.

## Prefixes

Example:

```json
{
  "git": {
    "prefix": "git:"
  }
}
```

## Suffixes

Example:

```json
{
  "context": {
    "suffix": " ctx"
  }
}
```

## Custom separators

Example:

```json
{
  "separator": {
    "text": " · ",
    "color": "dim"
  }
}
```

Again, this should not turn `pi-footer-kit` into a Powerline extension.

## Config UI

Implemented as `/footer-kit` (also available as `/footer-kit settings`). It uses Pi's TUI settings list, saves to the global user config immediately, and previews changes against the live footer without reloading the extension.

## Footer composition interoperability

Track Pi API changes that might eventually allow multiple extensions to contribute structured footer components. Today `setStatus()` exposes only keyed rendered strings and `setFooter()` replaces the whole footer, so safe composition with another custom-footer extension is not possible.

If Pi later exposes structured status metadata or footer middleware, consider richer per-extension formatting and ordering in Phase 2. Do not invent a private cross-extension protocol in V1.

---

# 36. README Positioning

The README should make the philosophy immediately clear.

Suggested introduction:

> `pi-footer-kit` keeps Pi's native footer but makes its individual components configurable.
>
> Change colors, shorten paths, hide fields, and adjust formatting without replacing Pi's footer with a completely different statusline.

Example:

```text
Before

~/Documents/FHY/paseo (main)
↑97k ↓23k 46.6%/272k                               gpt-5.6-sol

After

paseo (main)
↑97k ↓23k 46.6%                                    gpt-5.6-sol
```

Same Pi feel.

Just more control.

---

# 37. First Development Task

The first coding task should **not** be path customization.

Start by reproducing Pi's native footer.

Steps:

1. clone/study current Pi source
2. locate native footer implementation
3. locate official custom-footer extension example
4. determine all data available through `setFooter`
5. identify data available only through internal Pi components
6. build minimal Pi extension
7. replace footer with a renderer matching native Pi
8. compare visually against native Pi
9. only then add component customization

This prevents us from designing configuration around information that the extension API cannot access.

---

# 38. Important Investigation

Before implementation, verify whether `ctx.ui.setFooter()` exposes enough data to reproduce everything in Pi's native footer.

The public APIs verified against Pi `1.0.1` provide:

```text
working directory          ctx.cwd / ctx.sessionManager
git branch                footerData.getGitBranch()
usage and cost            ctx.sessionManager entries
context usage             ctx.getContextUsage()
model/provider            ctx.model
thinking level            ctx.thinkingLevel
themed rendering          setFooter factory theme
extension statuses        footerData.getExtensionStatuses()
status keys and text      ReadonlyMap<string, string>
provider count            footerData.getAvailableProviderCount()
```

Continue investigating native-only details such as routed-model display and how to trigger renders for every state change before declaring full parity. Reproduce usage aggregation and cache-hit behavior from public session entries. If information is unavailable, prefer a documented graceful omission over an unstable internal import.

Avoid importing unstable Pi internal modules unless absolutely necessary.

Preferred priority:

```text
official extension API
        ↓
exported Pi package APIs
        ↓
internal Pi implementation
```

Internal imports should be the last option.

---

# 39. Key Technical Decision

Decision for V1:

## Selected: public API reimplementation with a small adapted baseline

Use `ctx.ui.setFooter()`, the supplied `footerData`, public session/context APIs, and public TUI width utilities. Adapt only the small formatting/layout portions required for native parity.

Do not import `dist/modes/interactive/components/footer.*` or other Pi internals: the package root does not export them as a stable extension API. Keep pristine source snapshots, attribution, and synchronization metadata so adapted logic can be audited and updated.

If a native detail is not available publicly, document and test the difference rather than coupling V1 to an internal module.

---

# 40. Project Principle

Whenever there is a choice between:

```text
more features
```

and:

```text
staying native
```

prefer:

```text
staying native
```

The value of `pi-footer-kit` is not that it creates another fancy footer.

Its value is:

> **Pi's footer, your way.**
