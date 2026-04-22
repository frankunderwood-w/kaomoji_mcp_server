import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FULLWIDTH_RANGE = /[\uFF01-\uFF5E\u3000-\u303F\u3040-\u309F\u30A0-\u30FF]/u;
const SPECIAL_UNICODE = /[✧✦❁❀♪♫→←↑↓☆★♥♡●○◎□■◇◆∇♠♣♦⊂⊃∪∩∧∨⊕⊗]/u;
const ZWJ = /\u200D/u;
const VARIANT_SELECTOR = /[\uFE00-\uFE0F]/u;
const ALLOWED_CHARSET = /^[\x20-\x7Eω▽∀≧≦Oo]+$/u;
const FACE_MARKER = /[()\\/\[\]{}<>^;:._~|?!*+-]/;

interface CandidateEntry {
  text: string;
  fallback: string;
  cli_safe: true;
  tags: { en: string[]; zh: string[] };
}

interface CandidateOutput {
  version: string;
  count: number;
  kaomoji: CandidateEntry[];
}

function looksLikeKaomoji(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 32) {
    return false;
  }
  if (!FACE_MARKER.test(trimmed)) {
    return false;
  }
  if (/^[A-Za-z0-9\s]+$/.test(trimmed)) {
    return false;
  }
  return true;
}

function isCliSafe(text: string): boolean {
  return (
    !FULLWIDTH_RANGE.test(text) &&
    !SPECIAL_UNICODE.test(text) &&
    !ZWJ.test(text) &&
    !VARIANT_SELECTOR.test(text) &&
    ALLOWED_CHARSET.test(text)
  );
}

function extractFallback(text: string): string {
  const ascii = text.replace(/[^\x20-\x7E]/g, "");
  const normalized = ascii.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "...";
}

function collectKaomojiStrings(value: unknown, seen: Set<string>): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (looksLikeKaomoji(trimmed)) {
      seen.add(trimmed);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectKaomojiStrings(item, seen);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      collectKaomojiStrings(nestedValue, seen);
    }
  }
}

async function loadCollection(): Promise<string[]> {
  const packageName = "kaomoji-collection";

  try {
    const collectionModule = (await import(packageName)) as Record<string, unknown>;
    const rootValue = collectionModule.default ?? collectionModule;
    const seen = new Set<string>();

    collectKaomojiStrings(rootValue, seen);

    return [...seen];
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to load ${packageName}. Install it with \"npm install -D ${packageName}\" before running this script. ${reason}`
    );
  }
}

function buildCandidates(entries: string[]): CandidateEntry[] {
  return entries
    .filter((text) => isCliSafe(text))
    .map((text) => ({
      text,
      fallback: extractFallback(text),
      cli_safe: true as const,
      tags: { en: [], zh: [] },
    }))
    .sort((left, right) => left.text.length - right.text.length || left.text.localeCompare(right.text));
}

function writeOutput(output: CandidateOutput): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const outputPath = join(currentDir, "..", "data", "generated", "cli-safe-candidates.json");

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

  return outputPath;
}

async function main(): Promise<void> {
  console.log("Loading kaomoji-collection...");
  const allEntries = await loadCollection();

  console.log(`Loaded ${allEntries.length} raw entries.`);

  const candidates = buildCandidates(allEntries);
  const output: CandidateOutput = {
    version: new Date().toISOString(),
    count: candidates.length,
    kaomoji: candidates,
  };

  const outputPath = writeOutput(output);
  const rate = allEntries.length === 0 ? "0.00" : ((candidates.length / allEntries.length) * 100).toFixed(2);

  console.log(`Kept ${candidates.length} CLI-safe candidates (${rate}%).`);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(reason);
  process.exit(1);
});