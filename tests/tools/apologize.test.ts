import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadKaomojiDB } from "../../src/data/loader.js";
import { registerApologizeKaomoji } from "../../src/tools/apologize-kaomoji.js";
import type { KaomojiDB } from "../../src/data/loader.js";

vi.mock("../../src/data/loader.js", () => ({
  loadKaomojiDB: vi.fn(),
}));

const apologizeDb: KaomojiDB = {
  version: "1.0.0",
  scenes: [
    {
      id: "apologize",
      name: { en: "Apologize", zh: "Apologize" },
      description: { en: "Apology entries", zh: "Apology entries" },
      kaomoji: [
        {
          text: "(._.)",
          reason: ["dissatisfied", "error"],
          fallback: "._.",
          cli_safe: true,
          tags: { en: ["sorry"], zh: ["sorry"] },
        },
        {
          text: "(;_;)",
          reason: ["dissatisfied"],
          fallback: ";_;",
          cli_safe: true,
          tags: { en: ["sad"], zh: ["sad"] },
        },
        {
          text: "(-_-)",
          reason: ["not_found"],
          fallback: "-_-",
          cli_safe: true,
          tags: { en: ["empty"], zh: ["empty"] },
        },
        {
          text: "(o_o)?",
          reason: ["not_found"],
          fallback: "o_o?",
          cli_safe: true,
          tags: { en: ["confused"], zh: ["confused"] },
        },
        {
          text: "m(_ _)m",
          reason: ["error"],
          fallback: "m(_ _)m",
          cli_safe: true,
          tags: { en: ["bow"], zh: ["bow"] },
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
  const server = new McpServer({ name: "apologize-test-server", version: "1.0.0" });
  registerApologizeKaomoji(server);

  const client = new Client({ name: "apologize-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { server, client };
}

describe("apologize_kaomoji", () => {
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    vi.mocked(loadKaomojiDB).mockReset();
    vi.mocked(loadKaomojiDB).mockReturnValue(apologizeDb);

    ({ server, client } = await createHarness());
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await client.close();
    await server.close();
  });

  it("picks randomly from the full pool regardless of reason param", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    // Requesting "dissatisfied" but selection ignores reason — picks from all 5 entries
    const result = await client.callTool({
      name: "apologize_kaomoji",
      arguments: { reason: "dissatisfied" },
    });
    const payload = parseToolPayload(result);

    // floor(0.99 * 5) = 4 → last entry m(_ _)m (error only)
    expect(payload.kaomoji).toBe("m(_ _)m");
    expect(payload.cli_safe).toBe(true);
  });

  it("picks the first cli_safe entry when reason is omitted and Math.random returns 0", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = await client.callTool({
      name: "apologize_kaomoji",
      arguments: {},
    });
    const payload = parseToolPayload(result);

    // All 5 cli_safe entries are candidates; index 0 → (._.)
    expect(payload.kaomoji).toBe("(._.)");
    expect(payload.cli_safe).toBe(true);
  });

  it("returns the kaomoji at index 0 when Math.random returns 0, regardless of reason param", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = await client.callTool({
      name: "apologize_kaomoji",
      arguments: { reason: "error" },
    });
    const payload = parseToolPayload(result);

    expect(payload.kaomoji).toBe("(._.)");
    expect(payload.reason).toEqual(expect.arrayContaining(["error", "dissatisfied"]));
  });

  it("returns a scene_not_found payload when the apologize scene is missing", async () => {
    vi.mocked(loadKaomojiDB).mockReturnValueOnce({ version: "1.0.0", scenes: [] });

    const result = await client.callTool({
      name: "apologize_kaomoji",
      arguments: { reason: "error" },
    });
    const payload = parseToolPayload(result);

    expect(payload).toEqual({ error: "scene_not_found", scene: "apologize" });
  });

  it("returns a fallback payload when no cli_safe entry exists in the scene", async () => {
    vi.mocked(loadKaomojiDB).mockReturnValueOnce({
      version: "1.0.0",
      scenes: [
        {
          ...apologizeDb.scenes[0],
          kaomoji: apologizeDb.scenes[0].kaomoji.map((entry) => ({
            ...entry,
            cli_safe: false,
          })),
        },
      ],
    });

    const result = await client.callTool({
      name: "apologize_kaomoji",
      arguments: { reason: "not_found" },
    });
    const payload = parseToolPayload(result);

    expect(payload).toMatchObject({
      kaomoji: "(._.)",
      fallback: "._.",
      cli_safe: true,
      reason: "not_found",
      error: "no_matching_kaomoji",
    });
    expect(typeof payload._instruction).toBe("string");
    expect(payload._instruction as string).toContain("(._.)");
  });

  it("includes _instruction field in normal response", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = await client.callTool({
      name: "apologize_kaomoji",
      arguments: { reason: "dissatisfied" },
    });
    const payload = parseToolPayload(result);

    expect(typeof payload._instruction).toBe("string");
    expect(payload._instruction as string).toContain(payload.kaomoji as string);
    expect(payload._instruction as string).toContain("new line");
  });
});