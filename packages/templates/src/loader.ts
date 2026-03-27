import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { AttackTemplate, ScanDepth } from "@nightfang/shared";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES_DIR_CANDIDATES = [
  join(__dirname, "..", "attacks"),
  join(__dirname, "attacks"),
];

function resolveTemplatesDir(): string {
  for (const candidate of TEMPLATES_DIR_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return TEMPLATES_DIR_CANDIDATES[0];
}

export function loadTemplates(depth?: ScanDepth): AttackTemplate[] {
  const templates: AttackTemplate[] = [];
  const dir = resolveTemplatesDir();

  for (const category of readdirSync(dir, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryDir = join(dir, category.name);

    for (const file of readdirSync(categoryDir)) {
      if (extname(file) !== ".yaml" && extname(file) !== ".yml") continue;
      const raw = readFileSync(join(categoryDir, file), "utf-8");
      const parsed = parseYaml(raw) as AttackTemplate;
      if (depth && !parsed.depth.includes(depth)) continue;
      templates.push(parsed);
    }
  }

  return templates;
}

export function loadTemplateById(id: string): AttackTemplate | undefined {
  const all = loadTemplates();
  return all.find((t) => t.id === id);
}
