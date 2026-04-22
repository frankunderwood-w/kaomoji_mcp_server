import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** A single kaomoji entry */
export interface KaomojiEntry {
  text: string;
  /** Exclusive to celebrate scene: "subtle" | "moderate" | "intense" */
  intensity?: string;
  /** Exclusive to thinking scene: "thinking" | "confused" | "effort" */
  state?: string;
  /** Exclusive to apologize scene: subset of ["dissatisfied", "not_found", "error"] */
  reason?: string[];
  /** ASCII fallback text, e.g. ":)" */
  fallback: string;
  /** Terminal compatibility flag */
  cli_safe: boolean;
  /** Multilingual tags */
  tags: { en: string[]; zh: string[] };
}

/** Scene: celebrate / thinking / apologize */
export interface Scene {
  id: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  kaomoji: KaomojiEntry[];
}

/** Full kaomoji database */
export interface KaomojiDB {
  version: string;
  scenes: Scene[];
}

let cachedDb: KaomojiDB | null = null;

/** Loads and caches the kaomoji database; reads from file on first call, returns cached result on subsequent calls */
export function loadKaomojiDB(): KaomojiDB {
  if (cachedDb) return cachedDb;
  const dbPath = join(__dirname, "kaomoji.json");
  const raw = readFileSync(dbPath, "utf-8");
  cachedDb = JSON.parse(raw);
  return cachedDb!;
}