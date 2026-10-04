import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import type { FooterColor, THEME_COLORS } from "./config.ts";

type ThemeColorName = (typeof THEME_COLORS)[number];

export interface ThemeForeground {
  fg(color: ThemeColorName, text: string): string;
}

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}

export function formatCwdForFooter(cwd: string, home: string | undefined): string {
  if (!home) return cwd;

  const resolvedCwd = resolve(cwd);
  const resolvedHome = resolve(home);
  const relativeToHome = relative(resolvedHome, resolvedCwd);
  const isInsideHome =
    relativeToHome === "" ||
    (relativeToHome !== ".." &&
      !relativeToHome.startsWith(`..${sep}`) &&
      !isAbsolute(relativeToHome));

  if (!isInsideHome) return cwd;
  return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

export function formatPath(
  cwd: string,
  home: string | undefined,
  display: string | undefined = "native",
  segments = 2,
): string {
  if (display === "full") return cwd;
  const homeRelative = formatCwdForFooter(cwd, home);
  if (display === "basename") return basename(cwd) || cwd;
  if (display !== "segments") return homeRelative;

  const pieces = homeRelative.split(sep).filter(Boolean);
  const count = Math.max(1, Math.floor(segments));
  const shortened = pieces.slice(-count).join(sep);
  if (shortened) return shortened;
  return homeRelative.startsWith(sep) ? sep : homeRelative;
}

export function sanitizeStatusText(text: string): string {
  return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

export function styleStatusText(
  text: string,
  color: FooterColor | undefined,
  theme: ThemeForeground,
  stripTerminalSequences: (value: string) => string,
): string {
  if (color === undefined || color === "native") return text;
  if (color === "auto") return text;
  return theme.fg(color, stripTerminalSequences(text));
}
