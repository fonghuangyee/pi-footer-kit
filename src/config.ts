import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ThemeColor } from "@earendil-works/pi-coding-agent";

export const THEME_COLORS = [
  "accent",
  "border",
  "borderAccent",
  "borderMuted",
  "success",
  "error",
  "warning",
  "muted",
  "dim",
  "text",
  "thinkingText",
  "scrollbarTrack",
  "scrollbarThumb",
  "searchMatchText",
  "userMessageText",
  "customMessageText",
  "customMessageLabel",
  "toolTitle",
  "toolOutput",
  "mdHeading",
  "mdLink",
  "mdLinkUrl",
  "mdCode",
  "mdCodeBlock",
  "mdCodeBlockBorder",
  "mdQuote",
  "mdQuoteBorder",
  "mdHr",
  "mdListBullet",
  "toolDiffAdded",
  "toolDiffRemoved",
  "toolDiffContext",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxType",
  "syntaxOperator",
  "syntaxPunctuation",
  "thinkingOff",
  "thinkingMinimal",
  "thinkingLow",
  "thinkingMedium",
  "thinkingHigh",
  "thinkingXhigh",
  "thinkingMax",
  "bashMode",
] as const satisfies readonly ThemeColor[];

export type FooterColor = ThemeColor | "native" | "auto";
export type ComponentName =
  | "path"
  | "git"
  | "sessionName"
  | "tokens"
  | "cost"
  | "context"
  | "model"
  | "provider"
  | "thinking"
  | "extensionStatus";

export interface ComponentConfig {
  visible?: boolean;
  color?: FooterColor;
  display?: string;
  segments?: number;
}

export interface ExtensionStatusConfig extends ComponentConfig {
  colors?: Record<string, Exclude<FooterColor, "auto">>;
}

export interface FooterConfig {
  path: ComponentConfig;
  git: ComponentConfig;
  sessionName: ComponentConfig;
  tokens: ComponentConfig;
  cost: ComponentConfig;
  context: ComponentConfig;
  model: ComponentConfig;
  provider: ComponentConfig;
  thinking: ComponentConfig;
  extensionStatus: ExtensionStatusConfig;
}

export const DEFAULT_CONFIG: FooterConfig = {
  path: { visible: true, display: "native", color: "accent", segments: 2 },
  git: { visible: true, color: "success" },
  sessionName: { visible: true, color: "muted" },
  tokens: { visible: true, display: "native", color: "warning" },
  cost: { visible: true, color: "muted" },
  context: { visible: true, display: "native", color: "native" },
  model: { visible: true, display: "native", color: "accent" },
  provider: { visible: true, color: "muted" },
  thinking: { visible: true, color: "auto" },
  extensionStatus: { visible: true, color: "native", colors: {} },
};

export const COMPONENT_NAMES: ComponentName[] = [
  "path",
  "git",
  "sessionName",
  "tokens",
  "cost",
  "context",
  "model",
  "provider",
  "thinking",
  "extensionStatus",
];
const VALID_COLORS = new Set<string>(THEME_COLORS);
export const ALLOWED_DISPLAYS: Partial<Record<ComponentName, readonly string[]>> = {
  path: ["native", "full", "basename", "segments"],
  tokens: ["native"],
  context: ["native", "percentage", "used", "used-total", "percentage-total"],
  model: ["native"],
};

export interface ConfigPaths {
  user: string;
  project: string;
}

export interface LoadedConfig {
  config: FooterConfig;
  paths: ConfigPaths;
  sources: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getConfigPaths(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  home = homedir(),
): ConfigPaths {
  const configuredAgentDir = env.PI_CODING_AGENT_DIR;
  const agentDir = configuredAgentDir
    ? resolve(configuredAgentDir.replace(/^~(?=$|[/\\])/, home))
    : join(home, ".pi", "agent");
  return {
    user: join(agentDir, "pi-footer-kit.json"),
    project: join(cwd, ".pi", "pi-footer-kit.json"),
  };
}

function parseColor(
  value: unknown,
  component: ComponentName,
  field: string,
  source: string,
  warnings: string[],
): FooterColor | undefined {
  if (typeof value !== "string") {
    warnings.push(`${source}: ${component}.${field} must be a theme color name`);
    return undefined;
  }
  if (value === "native") return value;
  if (value === "auto" && component === "thinking" && field === "color") return value;
  if (VALID_COLORS.has(value)) return value as ThemeColor;
  warnings.push(`${source}: unknown color "${value}" for ${component}.${field}; using the default`);
  return undefined;
}

function parsePartialConfig(
  input: unknown,
  source: string,
  warnings: string[],
): Partial<FooterConfig> {
  if (!isRecord(input)) {
    warnings.push(`${source}: expected a JSON object; using defaults`);
    return {};
  }

  const partial: Partial<FooterConfig> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!COMPONENT_NAMES.includes(key as ComponentName)) {
      warnings.push(`${source}: unknown component "${key}"; ignored`);
      continue;
    }
    const component = key as ComponentName;
    if (!isRecord(value)) {
      warnings.push(`${source}: ${component} must be an object; ignored`);
      continue;
    }

    const parsed: ComponentConfig & { colors?: Record<string, Exclude<FooterColor, "auto">> } = {};
    if ("visible" in value) {
      if (typeof value.visible === "boolean") parsed.visible = value.visible;
      else warnings.push(`${source}: ${component}.visible must be a boolean; using the default`);
    }
    if ("color" in value) {
      const color = parseColor(value.color, component, "color", source, warnings);
      if (color !== undefined) parsed.color = color;
    }
    if ("display" in value) {
      const allowed = ALLOWED_DISPLAYS[component];
      if (typeof value.display === "string" && allowed?.includes(value.display)) {
        parsed.display = value.display;
      } else {
        warnings.push(`${source}: unsupported display mode for ${component}; using the default`);
      }
    }
    if ("segments" in value) {
      if (component === "path" && Number.isInteger(value.segments) && Number(value.segments) > 0) {
        parsed.segments = Math.min(Number(value.segments), 50);
      } else {
        warnings.push(`${source}: path.segments must be a positive integer; using the default`);
      }
    }

    if (component === "extensionStatus" && "colors" in value) {
      if (!isRecord(value.colors)) {
        warnings.push(`${source}: extensionStatus.colors must be an object; using the default`);
      } else {
        parsed.colors = {};
        for (const [statusKey, statusColor] of Object.entries(value.colors)) {
          if (!statusKey.trim()) {
            warnings.push(`${source}: extensionStatus.colors contains an empty status key; ignored`);
            continue;
          }
          const color = parseColor(statusColor, component, `colors.${statusKey}`, source, warnings);
          if (color && color !== "auto") parsed.colors[statusKey] = color;
        }
      }
    }

    partial[component] = parsed as FooterConfig[ComponentName];
  }
  return partial;
}

function mergeConfig(base: FooterConfig, partial: Partial<FooterConfig>): FooterConfig {
  const result = structuredClone(base);
  for (const component of COMPONENT_NAMES) {
    const override = partial[component];
    if (!override) continue;
    const target = result[component] as ComponentConfig & { colors?: Record<string, Exclude<FooterColor, "auto">> };
    const source = override as ComponentConfig & { colors?: Record<string, Exclude<FooterColor, "auto">> };
    const previousColors = target.colors;
    Object.assign(target, source);
    if (component === "extensionStatus" && source.colors) {
      target.colors = { ...(previousColors ?? {}), ...source.colors };
    }
  }
  return result;
}

async function readConfigFile(
  filePath: string,
  warnings: string[],
): Promise<unknown | undefined> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    warnings.push(`${filePath}: could not read configuration (${String(error)})`);
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    warnings.push(`${filePath}: invalid JSON (${String(error)}); using the previous configuration`);
    return undefined;
  }
}

export async function writeConfigValue(
  filePath: string,
  keyPath: readonly string[],
  value: unknown,
): Promise<void> {
  if (keyPath.length === 0) throw new Error("A configuration key is required");

  let config: Record<string, unknown> = {};
  try {
    const content = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) throw new Error("configuration root must be a JSON object");
    config = parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Cannot update ${filePath}: ${String(error)}`);
    }
  }

  let target = config;
  for (const key of keyPath.slice(0, -1)) {
    const existing = target[key];
    if (existing === undefined) {
      target[key] = {};
    } else if (!isRecord(existing)) {
      throw new Error(`Cannot update ${filePath}: ${key} must be an object`);
    }
    target = target[key] as Record<string, unknown>;
  }
  target[keyPath[keyPath.length - 1]!] = value;

  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function loadConfig(options: {
  cwd: string;
  projectTrusted: boolean;
  env?: NodeJS.ProcessEnv;
  home?: string;
}): Promise<LoadedConfig> {
  const paths = getConfigPaths(options.cwd, options.env, options.home);
  const warnings: string[] = [];
  const sources: string[] = [];
  let config = structuredClone(DEFAULT_CONFIG);
  const files = [paths.user, ...(options.projectTrusted ? [paths.project] : [])];

  for (const filePath of files) {
    const raw = await readConfigFile(filePath, warnings);
    if (raw === undefined) continue;
    const partial = parsePartialConfig(raw, filePath, warnings);
    config = mergeConfig(config, partial);
    sources.push(filePath);
  }

  return { config, paths, sources, warnings };
}
