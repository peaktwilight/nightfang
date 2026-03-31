import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

function expandUserPath(target: string): string {
  if (target === "~") return homedir();
  if (target.startsWith("~/")) return resolve(homedir(), target.slice(2));
  return target;
}

function isExistingLocalPath(target: string): boolean {
  const expanded = expandUserPath(target);
  return existsSync(resolve(expanded));
}

export function detectAndRoute(target: string): string[] | null {
  if (target.startsWith("mcp://")) {
    return ["scan", "--target", target];
  }

  if (
    target === "." ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    target.startsWith("/") ||
    target.startsWith("~/") ||
    target === "~" ||
    isExistingLocalPath(target)
  ) {
    return ["review", expandUserPath(target)];
  }

  if (target.startsWith("https://github.com/") || target.startsWith("git@")) {
    return ["review", target];
  }

  if (target.startsWith("http://") || target.startsWith("https://")) {
    return ["scan", "--target", target];
  }

  if (/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*(@.*)?$/.test(target)) {
    return ["audit", target];
  }

  return null;
}
