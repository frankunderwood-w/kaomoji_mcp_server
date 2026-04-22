import { describe, expect, it } from "vitest";
import { loadKaomojiDB } from "../../src/data/loader.js";

const CLI_SAFE_PATTERNS = {
  fullwidthRange: /[\uFF01-\uFF5E\uFF61-\uFF9F\u3000-\u303F\u3040-\u309F\u30A0-\u30FF]/,
  specialUnicode: /[✧✦❁❀♪♫→←↑↓☆★♥♡]/,
  zwj: /\u200D/,
  variantSelector: /[\uFE00-\uFE0F]/,
};

function getViolationReasons(text: string): string[] {
  const reasons: string[] = [];

  if (CLI_SAFE_PATTERNS.fullwidthRange.test(text)) {
    reasons.push("contains fullwidth characters");
  }

  if (CLI_SAFE_PATTERNS.specialUnicode.test(text)) {
    reasons.push("contains decorative unicode");
  }

  if (CLI_SAFE_PATTERNS.zwj.test(text)) {
    reasons.push("contains zwj");
  }

  if (CLI_SAFE_PATTERNS.variantSelector.test(text)) {
    reasons.push("contains variant selector");
  }

  return reasons;
}

function isCliSafe(text: string): boolean {
  return getViolationReasons(text).length === 0;
}

describe("CLI-safe rules", () => {
  it("rejects fullwidth characters", () => {
    expect(isCliSafe("(｡◕‿◕｡)")).toBe(false);
    expect(isCliSafe("（＾▽＾）")).toBe(false);
    expect(isCliSafe("｡･ﾟ･")).toBe(false);
  });

  it("rejects decorative unicode symbols", () => {
    expect(isCliSafe("✧٩(ˊωˋ*)و✧")).toBe(false);
    expect(isCliSafe("❁´◡`❁")).toBe(false);
    expect(isCliSafe("♪(^∇^*)")).toBe(false);
  });

  it("rejects zero-width joiners and variant selectors", () => {
    expect(isCliSafe("👨‍💻")).toBe(false);
    expect(isCliSafe("🏳️‍🌈")).toBe(false);

    const withVariantSelector = String.fromCodePoint(0x1f600, 0xfe0f);
    expect(isCliSafe(withVariantSelector)).toBe(false);
  });

  it("accepts known halfwidth-compatible kaomoji", () => {
    expect(isCliSafe("(^-^)")).toBe(true);
    expect(isCliSafe("(^ω^)")).toBe(true);
    expect(isCliSafe("\\(^∀^)/")).toBe(true);
    expect(isCliSafe("(o_O)?")).toBe(true);
  });
});

describe("database CLI-safe validation", () => {
  it("keeps every stored kaomoji CLI-safe", () => {
    const db = loadKaomojiDB();
    const violations = db.scenes.flatMap((scene) =>
      scene.kaomoji.flatMap((entry) => {
        const reasons = getViolationReasons(entry.text);

        return reasons.length === 0
          ? []
          : [
              {
                sceneId: scene.id,
                kaomoji: entry.text,
                reasons,
              },
            ];
      })
    );

    expect(violations).toEqual([]);
  });
});