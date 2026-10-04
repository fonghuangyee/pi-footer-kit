import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  ALLOWED_DISPLAYS,
  COMPONENT_NAMES,
  loadConfig,
  THEME_COLORS,
  writeConfigValue,
  type ComponentName,
  type FooterConfig,
  type LoadedConfig,
} from "./config.ts";
import { NativeFooter } from "./footer/native-footer.ts";
import { showFooterSettings } from "./settings-ui.ts";

type ConfigScope = "user" | "project";

function selectedConfigPath(current: LoadedConfig, scope: ConfigScope): string {
  return scope === "user" ? current.paths.user : current.paths.project;
}

function markSourceLoaded(current: LoadedConfig, scope: ConfigScope): void {
  const path = selectedConfigPath(current, scope);
  if (!current.sources.includes(path)) current.sources.push(path);
  current.sources.sort((left, right) => {
    const rank = (source: string) => source === current.paths.user ? 0 : source === current.paths.project ? 1 : 2;
    return rank(left) - rank(right);
  });
}

async function chooseConfigScope(
  ctx: ExtensionCommandContext,
  current: LoadedConfig,
  scope?: ConfigScope,
): Promise<ConfigScope | undefined> {
  if (scope) {
    if (scope === "project" && !ctx.isProjectTrusted()) {
      ctx.ui.notify("Project footer settings are unavailable until Pi trusts this project.", "warning");
      return undefined;
    }
    return scope;
  }
  if (ctx.mode !== "tui") {
    ctx.ui.notify("Specify a config scope in non-interactive mode: user or project.", "error");
    return undefined;
  }

  const projectLoaded = current.sources.includes(current.paths.project);
  const scopes: ConfigScope[] = ctx.isProjectTrusted() ? ["user", "project"] : ["user"];
  if (projectLoaded) scopes.reverse();
  const labels = scopes.map((value) => {
    const hasProjectConfig = current.sources.includes(current.paths.project);
    const overrideHint = hasProjectConfig
      ? value === "project"
        ? " (overrides user values)"
        : " (may be overridden by project values)"
      : "";
    return `${value === "user" ? "User" : "Project"}${overrideHint} · ${selectedConfigPath(current, value)}`;
  });
  const selected = await ctx.ui.select("Save footer settings to", labels);
  return selected ? scopes[labels.indexOf(selected)] : undefined;
}

function setEffectiveValue(config: FooterConfig, keyPath: readonly string[], value: unknown): void {
  let target = config as unknown as Record<string, unknown>;
  for (const key of keyPath.slice(0, -1)) {
    if (target[key] === undefined) target[key] = {};
    target = target[key] as Record<string, unknown>;
  }
  Object.defineProperty(target, keyPath[keyPath.length - 1]!, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function parseSetValue(setting: string, rawValue: string): { keyPath: string[]; value: unknown } | { error: string } {
  const pieces = setting.split(".");
  const component = pieces[0] as ComponentName;
  if (!COMPONENT_NAMES.includes(component)) return { error: `Unknown footer component "${pieces[0]}".` };

  if (component === "extensionStatus" && pieces[1] === "colors" && pieces.length >= 3) {
    const key = pieces.slice(2).join(".");
    if (!key.trim()) return { error: "An extension status key is required." };
    if (rawValue !== "native" && !THEME_COLORS.some((color) => color === rawValue)) {
      return { error: `Status colors must be native or one of: ${THEME_COLORS.join(", ")}.` };
    }
    return { keyPath: [component, "colors", key], value: rawValue };
  }

  if (pieces.length !== 2) return { error: "Use a component setting such as path.color or context.display." };
  const field = pieces[1]!;
  if (field === "visible") {
    if (["true", "shown"].includes(rawValue)) return { keyPath: [component, field], value: true };
    if (["false", "hidden"].includes(rawValue)) return { keyPath: [component, field], value: false };
    return { error: "Visibility must be true/shown or false/hidden." };
  }
  if (field === "color") {
    const validColor = rawValue === "native" || THEME_COLORS.some((color) => color === rawValue);
    const validAuto = component === "thinking" && rawValue === "auto";
    if (!validColor && !validAuto) {
      return { error: `Choose native${component === "thinking" ? " or auto" : ""}, or a Pi theme color: ${THEME_COLORS.join(", ")}.` };
    }
    return { keyPath: [component, field], value: rawValue };
  }
  const displayOptions = ALLOWED_DISPLAYS[component];
  if (field === "display" && displayOptions?.includes(rawValue)) {
    return { keyPath: [component, field], value: rawValue };
  }
  if (field === "segments" && component === "path") {
    const segments = Number(rawValue);
    if (Number.isInteger(segments) && segments >= 1 && segments <= 50) {
      return { keyPath: [component, field], value: segments };
    }
    return { error: "path.segments must be an integer from 1 to 50." };
  }
  if (field === "display" && displayOptions) {
    return { error: `${component}.display options: ${displayOptions.join(", ")}.` };
  }
  return { error: `Unsupported setting "${setting}". Run /footer-kit config to see available options.` };
}

function configHelp(current: LoadedConfig): string {
  return [
    `Active merged configuration (${current.sources.length ? current.sources.join(" + ") : "defaults"}):`,
    JSON.stringify(current.config, null, 2),
    "",
    `Components: ${COMPONENT_NAMES.join(", ")}`,
    `Colors: native, ${THEME_COLORS.join(", ")}; thinking.color also accepts auto.`,
    "Visibility: true/false (or shown/hidden).",
    `path.display: ${ALLOWED_DISPLAYS.path?.join(", ")}; path.segments: integer 1-50.`,
    `context.display: ${ALLOWED_DISPLAYS.context?.join(", ")}.`,
    `tokens.display / model.display: native only.`,
    `extensionStatus.colors.<key>: native or any Pi theme color.`,
    "",
    "Examples:",
    "/footer-kit settings — interactive live-preview settings",
    "/footer-kit set path.color warning",
    "/footer-kit set path.display basename",
    "/footer-kit set context.display percentage",
    "/footer-kit set extensionStatus.colors.caffeinate accent",
    "/footer-kit — open settings; /footer-kit config — inspect configuration",
  ].join("\n");
}

async function getLoadedConfig(ctx: ExtensionCommandContext): Promise<LoadedConfig> {
  return loadConfig({ cwd: ctx.cwd, projectTrusted: ctx.isProjectTrusted() });
}

export default function piFooterKit(pi: ExtensionAPI): void {
  let loaded: LoadedConfig | undefined;

  pi.on("session_start", async (_event, ctx) => {
    loaded = await loadConfig({
      cwd: ctx.cwd,
      projectTrusted: ctx.isProjectTrusted(),
    });
    if (ctx.mode !== "tui") return;

    ctx.ui.setFooter((tui, theme, footerData) =>
      new NativeFooter(tui, theme, ctx, footerData, loaded!.config),
    );
  });

  pi.registerCommand("footer-kit", {
    description: "Configure, preview, or inspect the pi-footer-kit footer",
    handler: async (args, ctx) => {
      const current = loaded ?? await getLoadedConfig(ctx);
      loaded = current;
      const words = args.trim().split(/\s+/).filter(Boolean);
      const action = words[0];

      if (action === "settings" || !action) {
        if (words.length > 1) {
          ctx.ui.notify("Usage: /footer-kit settings", "error");
          return;
        }
        const saved = await showFooterSettings(ctx, current.config, current.paths.user);
        if (saved) markSourceLoaded(current, "user");
        return;
      }

      if (action === "set") {
        let scope: ConfigScope | undefined;
        let settingIndex = 1;
        if (words[1] === "user" || words[1] === "project") {
          scope = words[1];
          settingIndex = 2;
        }
        const setting = words[settingIndex];
        const rawValue = words[settingIndex + 1];
        if (!setting || rawValue === undefined || words[settingIndex + 2] !== undefined) {
          ctx.ui.notify("Usage: /footer-kit set [user|project] <setting> <value>", "error");
          return;
        }
        const parsed = parseSetValue(setting, rawValue);
        if ("error" in parsed) {
          ctx.ui.notify(parsed.error, "error");
          return;
        }
        const targetScope = await chooseConfigScope(ctx, current, scope);
        if (!targetScope) return;
        const path = selectedConfigPath(current, targetScope);
        try {
          await writeConfigValue(path, parsed.keyPath, parsed.value);
          setEffectiveValue(current.config, parsed.keyPath, parsed.value);
          markSourceLoaded(current, targetScope);
          ctx.ui.notify(`Saved ${setting} to ${path}. The footer update is applied without /reload.`, "info");
        } catch (error) {
          ctx.ui.notify(`Could not save footer setting: ${String(error)}`, "error");
        }
        return;
      }

      if (action === "config" || action === "options") {
        ctx.ui.notify(configHelp(current), "info");
        return;
      }

      if (action) {
        ctx.ui.notify("Usage: /footer-kit [settings | set [user|project] <setting> <value> | config]", "error");
        return;
      }

      const lines = [
        `pi-footer-kit config: ${current.paths.user}`,
        current.sources.length
          ? `Loaded: ${current.sources.join(", ")}`
          : "Loaded: defaults (no configuration file found)",
        "Footer baseline: Pi 1.0.1 (see upstream/pi/baseline.json)",
        "Commands: /footer-kit settings · /footer-kit set <setting> <value> · /footer-kit config",
      ];
      if (!ctx.isProjectTrusted()) {
        lines.push(`Project config (not loaded until trusted): ${current.paths.project}`);
      }
      if (current.warnings.length > 0) {
        lines.push("Configuration warnings:", ...current.warnings);
      }
      ctx.ui.notify(lines.join("\n"), current.warnings.length > 0 ? "warning" : "info");
    },
  });
}
