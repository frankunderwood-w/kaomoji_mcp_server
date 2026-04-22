import { describe, expect, it } from "vitest";
import { loadKaomojiDB } from "../../src/data/loader.js";

const EXPECTED_SCENE_IDS = ["apologize", "celebrate", "thinking"];
const EXPECTED_INTENSITIES = ["intense", "moderate", "subtle"];
const EXPECTED_STATES = ["confused", "effort", "thinking"];
const EXPECTED_REASONS = ["dissatisfied", "error", "not_found"];

function getAllEntries() {
  const db = loadKaomojiDB();

  return db.scenes.flatMap((scene) =>
    scene.kaomoji.map((entry) => ({ sceneId: scene.id, entry }))
  );
}

describe("loadKaomojiDB", () => {
  it("loads the database with the expected top-level shape", () => {
    const db = loadKaomojiDB();

    expect(db.version).toBe("1.0.0");
    expect(db.scenes).toHaveLength(3);
    expect(db.scenes.map((scene) => scene.id).sort()).toEqual(EXPECTED_SCENE_IDS);
  });

  it("covers all celebrate intensity levels", () => {
    const db = loadKaomojiDB();
    const celebrateScene = db.scenes.find((scene) => scene.id === "celebrate");

    expect(celebrateScene).toBeDefined();
    expect(
      [...new Set(celebrateScene?.kaomoji.map((entry) => entry.intensity))]
        .filter((value): value is string => typeof value === "string")
        .sort()
    ).toEqual(EXPECTED_INTENSITIES);
  });

  it("covers all thinking states and apologize reasons", () => {
    const db = loadKaomojiDB();
    const thinkingScene = db.scenes.find((scene) => scene.id === "thinking");
    const apologizeScene = db.scenes.find((scene) => scene.id === "apologize");

    expect(thinkingScene).toBeDefined();
    expect(apologizeScene).toBeDefined();

    expect(
      [...new Set(thinkingScene?.kaomoji.map((entry) => entry.state))]
        .filter((value): value is string => typeof value === "string")
        .sort()
    ).toEqual(EXPECTED_STATES);

    expect(
      [
        ...new Set(
          apologizeScene?.kaomoji.flatMap((entry) => entry.reason ?? []) ?? []
        ),
      ].sort()
    ).toEqual(EXPECTED_REASONS);
  });

  it("contains at least 61 kaomoji entries", () => {
    expect(getAllEntries().length).toBeGreaterThanOrEqual(61);
  });

  it("marks every entry as cli_safe and provides a fallback", () => {
    for (const { entry } of getAllEntries()) {
      expect(entry.cli_safe).toBe(true);
      expect(entry.fallback).toBeTruthy();
      expect(typeof entry.fallback).toBe("string");
      expect(entry.tags.en.length).toBeGreaterThan(0);
      expect(entry.tags.zh.length).toBeGreaterThan(0);
    }
  });

  it("returns the same cached object on repeated loads", () => {
    const first = loadKaomojiDB();
    const second = loadKaomojiDB();

    expect(first).toBe(second);
  });

  it("keeps valid localized metadata and scene-specific fields", () => {
    const db = loadKaomojiDB();

    for (const scene of db.scenes) {
      expect(scene.name.en).toBeTruthy();
      expect(scene.name.zh).toBeTruthy();
      expect(scene.description.en).toBeTruthy();
      expect(scene.description.zh).toBeTruthy();
      expect(scene.kaomoji.length).toBeGreaterThan(0);

      if (scene.id === "celebrate") {
        for (const entry of scene.kaomoji) {
          expect(EXPECTED_INTENSITIES).toContain(entry.intensity);
        }
      }

      if (scene.id === "thinking") {
        for (const entry of scene.kaomoji) {
          expect(EXPECTED_STATES).toContain(entry.state);
        }
      }

      if (scene.id === "apologize") {
        for (const entry of scene.kaomoji) {
          expect(entry.reason).toBeDefined();
          expect(entry.reason?.length).toBeGreaterThan(0);
          for (const reason of entry.reason ?? []) {
            expect(EXPECTED_REASONS).toContain(reason);
          }
        }
      }
    }
  });
});