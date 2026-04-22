import { loadKaomojiDB } from "../src/data/loader.js";
import type { KaomojiEntry } from "../src/data/loader.js";

const FULLWIDTH_RANGE = /[\uFF01-\uFF5E\u3000-\u303F\u3040-\u309F\u30A0-\u30FF]/u;
const SPECIAL_UNICODE = /[✧✦❁❀♪♫→←↑↓☆★♥♡●○◎□■◇◆∇♠♣♦⊂⊃∪∩∧∨⊕⊗]/u;
const ZWJ = /\u200D/u;
const VARIANT_SELECTOR = /[\uFE00-\uFE0F]/u;
const ALLOWED_CHARSET = /^[\x20-\x7Eω▽∀≧≦Oo]+$/u;

interface ValidationError {
  sceneId: string;
  index: number;
  text: string;
  rule: string;
  detail: string;
}

interface ValidationReport {
  total: number;
  passed: number;
  failed: number;
  errors: ValidationError[];
}

function validateCliSafe(entry: KaomojiEntry, sceneId: string, index: number): ValidationError | null {
  const text = entry.text;

  if (!text || text.trim().length === 0) {
    return { sceneId, index, text, rule: "empty_text", detail: "Kaomoji text is empty." };
  }
  if (FULLWIDTH_RANGE.test(text)) {
    return { sceneId, index, text, rule: "fullwidth_chars", detail: "Contains fullwidth characters." };
  }
  if (SPECIAL_UNICODE.test(text)) {
    return { sceneId, index, text, rule: "special_unicode", detail: "Contains blocked Unicode symbols." };
  }
  if (ZWJ.test(text)) {
    return { sceneId, index, text, rule: "zwj", detail: "Contains a zero-width joiner." };
  }
  if (VARIANT_SELECTOR.test(text)) {
    return { sceneId, index, text, rule: "variant_selector", detail: "Contains a variant selector." };
  }
  if (!ALLOWED_CHARSET.test(text)) {
    return { sceneId, index, text, rule: "disallowed_chars", detail: "Contains characters outside the allowed CLI-safe set." };
  }
  if (entry.cli_safe !== true) {
    return { sceneId, index, text, rule: "cli_safe_flag", detail: "cli_safe must be true." };
  }
  if (!entry.fallback || entry.fallback.trim().length === 0) {
    return { sceneId, index, text, rule: "missing_fallback", detail: "fallback must be a non-empty string." };
  }

  return null;
}

function validateStructure(entry: KaomojiEntry, sceneId: string, index: number): ValidationError | null {
  if (!entry.tags || !Array.isArray(entry.tags.en) || !Array.isArray(entry.tags.zh)) {
    return { sceneId, index, text: entry.text, rule: "invalid_tags", detail: "tags must contain en and zh string arrays." };
  }

  return null;
}

function main(): void {
  console.log("Loading kaomoji database...");
  const db = loadKaomojiDB();

  const report: ValidationReport = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  console.log(`Database version: ${db.version}`);
  console.log(`Scenes: ${db.scenes.length}`);

  for (const scene of db.scenes) {
    console.log(`Checking scene ${scene.id} (${scene.kaomoji.length} entries)...`);

    scene.kaomoji.forEach((entry, index) => {
      report.total += 1;

      const cliError = validateCliSafe(entry, scene.id, index);
      if (cliError) {
        report.failed += 1;
        report.errors.push(cliError);
        return;
      }

      const structureError = validateStructure(entry, scene.id, index);
      if (structureError) {
        report.failed += 1;
        report.errors.push(structureError);
        return;
      }

      report.passed += 1;
    });
  }

  console.log("");
  console.log("Validation summary");
  console.log(`  Total:  ${report.total}`);
  console.log(`  Passed: ${report.passed}`);
  console.log(`  Failed: ${report.failed}`);

  if (report.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const error of report.errors) {
      console.log(`  [${error.sceneId}#${error.index}] ${error.rule}: ${error.text} - ${error.detail}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("All entries passed CLI-safe validation.");
}

main();