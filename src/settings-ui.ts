import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getSelectListTheme, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import {
  Container,
  SelectList,
  SettingsList,
  Text,
  type Component,
  type SelectItem,
  type SettingItem,
  type TUI,
} from "@earendil-works/pi-tui";
import {
  ALLOWED_DISPLAYS,
  COMPONENT_NAMES,
  THEME_COLORS,
  writeConfigValue,
  type ComponentName,
  type FooterConfig,
} from "./config.ts";

interface SettingControl {
  item: SettingItem;
  keyPath: string[];
  decode(value: string): unknown;
}

const COMPONENT_LABELS: Record<ComponentName, string> = {
  path: "Path",
  git: "Git branch",
  sessionName: "Session name",
  tokens: "Tokens",
  cost: "Cost",
  context: "Context usage",
  model: "Model",
  provider: "Provider",
  thinking: "Thinking level",
  extensionStatus: "Extension statuses",
};

function applyConfigValue(config: FooterConfig, keyPath: readonly string[], value: unknown): void {
  let target = config as unknown as Record<string, unknown>;
  for (const key of keyPath.slice(0, -1)) {
    target = target[key] as Record<string, unknown>;
  }
  Object.defineProperty(target, keyPath[keyPath.length - 1]!, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function formatValue(value: unknown, fallback: string): string {
  return value === undefined ? fallback : String(value);
}

function makeChoiceComponent(
  options: string[],
  currentValue: string,
  theme: Theme,
  tui: TUI,
  done: (value?: string) => void,
): Component {
  const container = new Container();
  container.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
  container.addChild(new Text(theme.fg("accent", theme.bold("Choose a value"))));
  const choices = options.includes(currentValue) ? options : [currentValue, ...options];
  const items: SelectItem[] = choices.map((value) => ({
    value,
    label: THEME_COLORS.includes(value as (typeof THEME_COLORS)[number])
      ? theme.fg(value as (typeof THEME_COLORS)[number], value)
      : value,
  }));
  const list = new SelectList(items, Math.min(items.length, 12), getSelectListTheme());
  const selectedIndex = choices.indexOf(currentValue);
  if (selectedIndex >= 0) list.setSelectedIndex(selectedIndex);
  list.onSelect = (item) => done(item.value);
  list.onCancel = () => done();
  container.addChild(list);
  container.addChild(new Text(theme.fg("dim", "↑↓ navigate · Enter select · Esc back")));
  container.addChild(new DynamicBorder((text) => theme.fg("accent", text)));

  return {
    render(width: number) {
      return container.render(width);
    },
    invalidate() {
      container.invalidate();
    },
    handleInput(data: string) {
      list.handleInput(data);
      tui.requestRender();
    },
  };
}

function makeSettings(config: FooterConfig, theme: Theme, tui: TUI): SettingControl[] {
  const controls: SettingControl[] = [];
  const colors = ["native", ...THEME_COLORS];
  const displays: Partial<Record<ComponentName, readonly string[]>> = ALLOWED_DISPLAYS;

  const addChoice = (
    keyPath: string[],
    label: string,
    currentValue: string,
    options: string[],
    description: string,
    decode: (value: string) => unknown = (value) => value,
  ) => {
    const item: SettingItem = {
      id: JSON.stringify(keyPath),
      label,
      description,
      currentValue,
      submenu: (current, done) => makeChoiceComponent(options, current, theme, tui, (value) => done(value)),
    };
    controls.push({ item, keyPath, decode });
  };

  for (const component of COMPONENT_NAMES) {
    const prefix = COMPONENT_LABELS[component];
    const configPart = config[component];
    addChoice(
      [component, "visible"],
      `${prefix} · visibility`,
      configPart.visible === false ? "hidden" : "shown",
      ["shown", "hidden"],
      "Show or hide this footer component.",
      (value) => value === "shown",
    );

    const componentColors = component === "thinking" ? [...colors, "auto"] : colors;
    addChoice(
      [component, "color"],
      `${prefix} · color`,
      formatValue(configPart.color, "native"),
      componentColors,
      component === "extensionStatus"
        ? "Fallback color for extension statuses; native preserves each extension's styling."
        : "Choose any Pi semantic theme color, native, or (for thinking) automatic by level.",
    );

    const displayOptions = displays[component];
    if (displayOptions) {
      addChoice(
        [component, "display"],
        `${prefix} · display`,
        formatValue(configPart.display, "native"),
        [...displayOptions],
        `Available display modes: ${displayOptions.join(", ")}.`,
      );
    }
  }

  addChoice(
    ["path", "segments"],
    "Path · segment count",
    formatValue(config.path.segments, "2"),
    Array.from({ length: 50 }, (_, index) => String(index + 1)),
    "Used when Path · display is segments. Choose any integer from 1 to 50.",
    Number,
  );

  for (const [key, color] of Object.entries(config.extensionStatus.colors ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    addChoice(
      ["extensionStatus", "colors", key],
      `Status · ${key}`,
      color,
      colors,
      `Color override for the extension status key "${key}". Use /footer-kit set extensionStatus.colors.<key> <color> to add another key.`,
    );
  }

  return controls;
}

export async function showFooterSettings(
  ctx: ExtensionCommandContext,
  config: FooterConfig,
  filePath: string,
): Promise<boolean> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("/footer-kit settings requires Pi's interactive TUI mode", "error");
    return false;
  }

  let writes = Promise.resolve();
  let writeError: string | undefined;
  let changed = false;
  let writeSucceeded = false;

  await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
    const controls = makeSettings(config, theme, tui);
    const container = new Container();
    container.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
    container.addChild(new Text(theme.fg("accent", theme.bold("Footer Kit Settings"))));
    container.addChild(new Text(theme.fg("dim", `Saving to ${filePath}`)));

    const settingsList = new SettingsList(
      controls.map((control) => control.item),
      Math.min(controls.length, 13),
      getSettingsListTheme(),
      (id, selectedValue) => {
        const control = controls.find((entry) => entry.item.id === id);
        if (!control) return;
        const value = control.decode(selectedValue);
        applyConfigValue(config, control.keyPath, value);
        changed = true;
        tui.requestRender();
        writes = writes.then(async () => {
          await writeConfigValue(filePath, control.keyPath, value);
          writeSucceeded = true;
        }).catch((error: unknown) => {
          writeError = String(error);
          ctx.ui.notify(`Footer setting preview is active but could not be saved: ${writeError}`, "error");
        });
      },
      () => done(),
    );
    container.addChild(settingsList);
    container.addChild(new Text(theme.fg("dim", "Footer preview updates live · changes save immediately · Esc closes")));
    container.addChild(new DynamicBorder((text) => theme.fg("accent", text)));

    return {
      render(width: number) {
        return container.render(width);
      },
      invalidate() {
        container.invalidate();
      },
      handleInput(data: string) {
        settingsList.handleInput(data);
        tui.requestRender();
      },
    };
  });

  await writes;
  if (changed) {
    ctx.ui.notify(
      writeError
        ? "Settings preview is active, but at least one change was not saved. Fix the config file and run /reload to recover."
        : `Footer settings saved to ${filePath}. The preview is already applied; no /reload is needed.`,
      writeError ? "warning" : "info",
    );
  }
  return changed && writeSucceeded;
}
