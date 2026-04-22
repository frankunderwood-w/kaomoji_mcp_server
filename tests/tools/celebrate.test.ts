import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadKaomojiDB } from "../../src/data/loader.js";
import { registerCelebrateKaomoji } from "../../src/tools/celebrate-kaomoji.js";
import type { KaomojiDB } from "../../src/data/loader.js";

vi.mock("../../src/data/loader.js", () => ({
  loadKaomojiDB: vi.fn(),
}));

const celebrateDb: KaomojiDB = {
  version: "1.0.0",
  scenes: [
    {
      id: "celebrate",
      name: { en: "Celebrate", zh: "Celebrate" },
      description: { en: "Celebrate entries", zh: "Celebrate entries" },
      kaomoji: [
        {
          text: "(^-^)",
          intensity: "subtle",
          fallback: ":)",
          cli_safe: true,
          tags: { en: ["gentle"], zh: ["gentle"] },
        },
        {
          text: "(^.^)",
          intensity: "subtle",
          fallback: ":)",
          cli_safe: true,
          tags: { en: ["soft"], zh: ["soft"] },
        },
        {
          text: "(^o^)/",
          intensity: "moderate",
          fallback: ":D",
          cli_safe: true,
          tags: { en: ["happy"], zh: ["happy"] },
        },
        {
          text: "(^▽^)",
          intensity: "moderate",
          fallback: ":D",
          cli_safe: true,
          tags: { en: ["joy"], zh: ["joy"] },
        },
        {
          text: "\\(^o^)/",
          intensity: "intense",
          fallback: ":D",
          cli_safe: true,
          tags: { en: ["excited"], zh: ["excited"] },
        },
        {
          text: "Y(^_^)Y",
          intensity: "intense",
          fallback: ":)",
          cli_safe: true,
          tags: { en: ["victory"], zh: ["victory"] },
        },
      ],
    },
  ],
};

function parseToolPayload(result: Awaited<ReturnType<Client["callTool"]>>) {
  const [content] = result.content;

  if (!content || content.type !== "text") {
    throw new Error("Expected text tool content");
  }

  return JSON.parse(content.text) as Record<string, unknown>;
}

async function createHarness() {
  const server = new McpServer({ name: "celebrate-test-server", version: "1.0.0" });
  registerCelebrateKaomoji(server);

  const client = new Client({ name: "celebrate-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { server, client };
}

describe("celebrate_kaomoji", () => {
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    vi.mocked(loadKaomojiDB).mockReset();
    vi.mocked(loadKaomojiDB).mockReturnValue(celebrateDb);

    ({ server, client } = await createHarness());
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await client.close();
    await server.close();
  });

  it("picks the first cli_safe entry when Math.random returns 0", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = await client.callTool({
      name: "celebrate_kaomoji",
      arguments: { intensity: "subtle" },
    });
    const payload = parseToolPayload(result);

    // All 6 cli_safe entries are candidates; index 0 → (^-^)
    expect(payload).toMatchObject({
      kaomoji: "(^-^)",
      fallback: ":)",
      cli_safe: true,
    });
  });

  it("picks randomly from the full pool regardless of intensity param", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    // Requesting "subtle" but selection ignores intensity — picks from all 6 entries
    const result = await client.callTool({
      name: "celebrate_kaomoji",
      arguments: { intensity: "subtle" },
    });
    const payload = parseToolPayload(result);

    // floor(0.99 * 6) = 5 → last entry Y(^_^)Y (intense)
    expect(payload.kaomoji).toBe("Y(^_^)Y");
    expect(payload.cli_safe).toBe(true);
  });

  it("selection spans all intensity levels in the pool", async () => {
    const candidates = celebrateDb.scenes[0].kaomoji;
    const intensities = new Set<string>();

    for (let i = 0; i < candidates.length; i++) {
      vi.spyOn(Math, "random").mockReturnValueOnce(i / candidates.length);
      const result = await client.callTool({
        name: "celebrate_kaomoji",
        arguments: {},
      });
      const payload = parseToolPayload(result);
      if (typeof payload.intensity === "string") intensities.add(payload.intensity);
    }

    expect(intensities).toContain("subtle");
    expect(intensities).toContain("moderate");
    expect(intensities).toContain("intense");
  });

  it("returns a scene_not_found payload when the celebrate scene is missing", async () => {
    vi.mocked(loadKaomojiDB).mockReturnValueOnce({ version: "1.0.0", scenes: [] });

    const result = await client.callTool({
      name: "celebrate_kaomoji",
      arguments: { intensity: "moderate" },
    });
    const payload = parseToolPayload(result);

    expect(payload).toEqual({ error: "scene_not_found", scene: "celebrate" });
  });

  it("returns a fallback payload when no cli_safe entry exists in the scene", async () => {
    vi.mocked(loadKaomojiDB).mockReturnValueOnce({
      version: "1.0.0",
      scenes: [
        {
          ...celebrateDb.scenes[0],
          kaomoji: celebrateDb.scenes[0].kaomoji.map((entry) => ({
            ...entry,
            cli_safe: false,
          })),
        },
      ],
    });

    const result = await client.callTool({
      name: "celebrate_kaomoji",
      arguments: { intensity: "moderate" },
    });
    const payload = parseToolPayload(result);

    expect(payload).toMatchObject({
      kaomoji: "(^-^)",
      fallback: ":)",
      cli_safe: true,
      intensity: "moderate",
      error: "no_matching_kaomoji",
    });
    expect(typeof payload._instruction).toBe("string");
    expect(payload._instruction as string).toContain("(^-^)");
  });

  it("includes _instruction field in normal response", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = await client.callTool({
      name: "celebrate_kaomoji",
      arguments: { intensity: "moderate" },
    });
    const payload = parseToolPayload(result);

    expect(typeof payload._instruction).toBe("string");
    expect(payload._instruction as string).toContain(payload.kaomoji as string);
    expect(payload._instruction as string).toContain("new line");
  });
});