// Native footer behavior synchronized with Pi 1.0.1 (commit a7229ddc21810d6245105978033b7df645ecc2f7).
import {
  stripTerminalSequences,
  truncateToWidth,
  visibleWidth,
  type Component,
  type TUI,
} from "@earendil-works/pi-tui";
import type {
  ExtensionContext,
  ReadonlyFooterDataProvider,
  SessionEntry,
  Theme,
  ThemeColor,
} from "@earendil-works/pi-coding-agent";
import type { ComponentName, FooterColor, FooterConfig } from "../config.ts";
import {
  formatPath,
  formatTokens,
  sanitizeStatusText,
  styleStatusText,
} from "../formatters.ts";

interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

interface SessionStats {
  key: string;
  totals: UsageTotals;
  latestCacheHitRate?: number;
}

const THINKING_COLORS: Record<string, ThemeColor> = {
  off: "thinkingOff",
  minimal: "thinkingMinimal",
  low: "thinkingLow",
  medium: "thinkingMedium",
  high: "thinkingHigh",
  xhigh: "thinkingXhigh",
  max: "thinkingMax",
};

function isUsage(value: unknown): value is {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: { total: number };
} {
  if (typeof value !== "object" || value === null) return false;
  const usage = value as Record<string, unknown>;
  return (
    typeof usage.input === "number" &&
    typeof usage.output === "number" &&
    typeof usage.cacheRead === "number" &&
    typeof usage.cacheWrite === "number" &&
    typeof usage.cost === "object" &&
    usage.cost !== null &&
    typeof (usage.cost as Record<string, unknown>).total === "number"
  );
}

function addUsage(totals: UsageTotals, usage: unknown): void {
  if (!isUsage(usage)) return;
  totals.input += usage.input;
  totals.output += usage.output;
  totals.cacheRead += usage.cacheRead;
  totals.cacheWrite += usage.cacheWrite;
  totals.cost += usage.cost.total;
}

function usageForEntry(entry: SessionEntry): unknown {
  if (entry.type === "usage") return entry.usage;
  if (entry.type === "message") {
    if (entry.message.role === "assistant") return entry.message.usage;
    if (entry.message.role === "toolResult") return entry.message.usage;
  }
  if (entry.type === "branch_summary" || entry.type === "compaction") return entry.usage;
  return undefined;
}

function latestPromptCacheRate(entry: SessionEntry): number | undefined {
  if (entry.type !== "message" || entry.message.role !== "assistant") return undefined;
  const usage = entry.message.usage;
  const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
  return promptTokens > 0 ? (usage.cacheRead / promptTokens) * 100 : undefined;
}

function isVisible(config: FooterConfig, component: ComponentName): boolean {
  return config[component].visible !== false;
}

function formatContext(
  display: string | undefined,
  percent: number | null | undefined,
  tokens: number | null | undefined,
  contextWindow: number,
): string {
  const percentText = percent === null || percent === undefined ? "?" : `${percent.toFixed(1)}%`;
  const usedText = tokens === null || tokens === undefined ? "?" : formatTokens(tokens);
  switch (display) {
    case "percentage":
      return percentText;
    case "used":
      return usedText;
    case "used-total":
      return `${usedText}/${formatTokens(contextWindow)}`;
    case "percentage-total":
      return `${percentText}/${formatTokens(contextWindow)}`;
    default:
      return `${percentText}/${formatTokens(contextWindow)}`;
  }
}

export class NativeFooter implements Component {
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly context: ExtensionContext;
  private readonly footerData: ReadonlyFooterDataProvider;
  private readonly config: FooterConfig;
  private readonly unsubscribeBranchChange: () => void;
  private cachedStats?: SessionStats;

  constructor(
    tui: TUI,
    theme: Theme,
    context: ExtensionContext,
    footerData: ReadonlyFooterDataProvider,
    config: FooterConfig,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.context = context;
    this.footerData = footerData;
    this.config = config;
    this.unsubscribeBranchChange = footerData.onBranchChange(() => tui.requestRender());
  }

  invalidate(): void {
    // Usage and context are read from the current session when Pi renders the footer.
  }

  dispose(): void {
    this.unsubscribeBranchChange();
  }

  private colorFor(component: Exclude<ComponentName, "extensionStatus">, fallback: ThemeColor): ThemeColor {
    const configured = this.config[component].color;
    if (!configured || configured === "native" || configured === "auto") return fallback;
    return configured as ThemeColor;
  }

  private styleComponent(
    component: Exclude<ComponentName, "extensionStatus">,
    text: string,
    fallback: ThemeColor = "dim",
  ): string {
    if (!text) return text;
    return this.theme.fg(this.colorFor(component, fallback), text);
  }

  private styleThinking(text: string, level: string): string {
    const configured: FooterColor | undefined = this.config.thinking.color;
    const fallback = THINKING_COLORS[level.toLowerCase()] ?? "thinkingText";
    const color = configured === "auto" ? fallback : this.colorFor("thinking", "dim");
    return this.theme.fg(color, text);
  }

  private getSessionStats(): SessionStats {
    const manager = this.context.sessionManager;
    const entries = manager.getEntries();
    const key = `${manager.getSessionId()}:${manager.getLeafId() ?? ""}:${entries.length}`;
    if (this.cachedStats?.key === key) return this.cachedStats;

    const totals: UsageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
    let cacheHitRate: number | undefined;
    for (const entry of entries) {
      addUsage(totals, usageForEntry(entry));
      const nextRate = latestPromptCacheRate(entry);
      if (entry.type === "message" && entry.message.role === "assistant") {
        cacheHitRate = nextRate;
      }
    }
    this.cachedStats = { key, totals, latestCacheHitRate: cacheHitRate };
    return this.cachedStats;
  }

  render(width: number): string[] {
    if (width <= 0) return [];
    const config = this.config;
    const manager = this.context.sessionManager;
    const lines: string[] = [];

    const pathText = isVisible(config, "path")
      ? formatPath(
          manager.getCwd() || this.context.cwd,
          process.env.HOME || process.env.USERPROFILE,
          config.path.display,
          config.path.segments,
        )
      : "";
    const branch = isVisible(config, "git") ? this.footerData.getGitBranch() : null;
    const sessionName = isVisible(config, "sessionName") ? manager.getSessionName() : undefined;
    const pathParts: string[] = [];
    if (pathText) pathParts.push(this.styleComponent("path", pathText));
    if (branch) {
      pathParts.push(this.styleComponent("git", pathParts.length > 0 ? `(${branch})` : branch));
    }
    if (sessionName) {
      const prefix = pathParts.length > 0 ? "• " : "";
      pathParts.push(this.styleComponent("sessionName", `${prefix}${sessionName}`));
    }
    if (pathParts.length > 0) {
      const pathLine = pathParts.join(" ");
      lines.push(
        truncateToWidth(
          pathLine,
          width,
          this.theme.fg(this.colorFor("path", "dim"), "..."),
        ),
      );
    }

    const { totals, latestCacheHitRate } = this.getSessionStats();
    const usageParts: string[] = [];
    if (isVisible(config, "tokens")) {
      if (totals.input) usageParts.push(this.styleComponent("tokens", `↑${formatTokens(totals.input)}`));
      if (totals.output) usageParts.push(this.styleComponent("tokens", `↓${formatTokens(totals.output)}`));
      if (totals.cacheRead) usageParts.push(this.styleComponent("tokens", `R${formatTokens(totals.cacheRead)}`));
      if (totals.cacheWrite) usageParts.push(this.styleComponent("tokens", `W${formatTokens(totals.cacheWrite)}`));
      if ((totals.cacheRead > 0 || totals.cacheWrite > 0) && latestCacheHitRate !== undefined) {
        usageParts.push(this.styleComponent("tokens", `CH${latestCacheHitRate.toFixed(1)}%`));
      }
    }

    const model = this.context.model;
    const isSubscription = model?.provider === "kimi-coding";
    if (isVisible(config, "cost") && (totals.cost || isSubscription)) {
      const cost = `$${totals.cost.toFixed(3)}${isSubscription ? " (sub)" : ""}`;
      usageParts.push(this.styleComponent("cost", cost));
    }

    const contextUsage = this.context.getContextUsage();
    const contextWindow = contextUsage?.contextWindow ?? model?.contextWindow ?? 0;
    const percent = contextUsage?.percent;
    const contextText = formatContext(
      config.context.display,
      percent,
      contextUsage?.tokens,
      contextWindow,
    );
    if (isVisible(config, "context")) {
      let fallback: ThemeColor = "dim";
      if (percent !== null && percent !== undefined && percent > 90) fallback = "error";
      else if (percent !== null && percent !== undefined && percent > 70) fallback = "warning";
      usageParts.push(this.styleComponent("context", contextText, fallback));
    }

    const statsLeft = usageParts.join(" ");
    const modelName = model?.id || "no-model";
    let rightSide = "";
    if (isVisible(config, "model")) {
      rightSide = this.styleComponent("model", modelName);
      if (isVisible(config, "thinking") && model?.reasoning) {
        const level = this.context.thinkingLevel || "off";
        const thinkingText = level === "off" ? "thinking off" : level;
        rightSide += ` ${this.theme.fg("dim", "•")} ${this.styleThinking(thinkingText, level)}`;
      }
    }

    if (
      rightSide &&
      model &&
      isVisible(config, "provider") &&
      this.footerData.getAvailableProviderCount() > 1
    ) {
      const providerLabel = this.styleComponent("provider", `(${model.provider})`);
      const withProvider = `${providerLabel} ${rightSide}`;
      if (visibleWidth(statsLeft) + 2 + visibleWidth(withProvider) <= width) rightSide = withProvider;
    }

    const statsLeftWidth = visibleWidth(statsLeft);
    let statsLine: string;
    if (!rightSide) {
      statsLine = statsLeft;
    } else if (statsLeftWidth + 2 + visibleWidth(rightSide) <= width) {
      const padding = " ".repeat(Math.max(0, width - statsLeftWidth - visibleWidth(rightSide)));
      statsLine = statsLeft + padding + rightSide;
    } else {
      const availableForRight = width - statsLeftWidth - 2;
      if (availableForRight > 0) {
        const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
        const padding = " ".repeat(Math.max(0, width - statsLeftWidth - visibleWidth(truncatedRight)));
        statsLine = statsLeft + padding + truncatedRight;
      } else {
        statsLine = statsLeft;
      }
    }

    if (visibleWidth(statsLine) > width) {
      statsLine = truncateToWidth(statsLine, width, this.theme.fg("dim", "..."));
    }
    lines.push(statsLine);

    if (isVisible(config, "extensionStatus")) {
      const statuses = Array.from(this.footerData.getExtensionStatuses().entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, rawText]) => {
          const text = sanitizeStatusText(rawText);
          const color = config.extensionStatus.colors?.[key] ?? config.extensionStatus.color ?? "native";
          return styleStatusText(text, color, this.theme, stripTerminalSequences);
        });
      if (statuses.length > 0) {
        lines.push(
          truncateToWidth(statuses.join(" "), width, this.theme.fg("dim", "...")),
        );
      }
    }

    return lines;
  }
}
