import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createKaomojiServer } from "../../src/create-server.js";

function parseToolPayload(result: Awaited<ReturnType<Client["callTool"]>>) {
  const [content] = result.content;

  if (!content || content.type !== "text") {
    throw new Error("Expected text tool content");
  }

  return JSON.parse(content.text) as Record<string, unknown>;
}

describe("Kaomoji MCP server", () => {
  const server = createKaomojiServer();
  const client = new Client({ name: "integration-test-client", version: "1.0.0" });

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  it("lists the three registered tools", async () => {
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name).sort();

    expect(toolNames).toEqual([
      "apologize_kaomoji",
      "celebrate_kaomoji",
      "thinking_kaomoji",
    ]);
  });

  it("exposes the celebrate tool schema", async () => {
    const tools = await client.listTools();
    const celebrateTool = tools.tools.find((tool) => tool.name === "celebrate_kaomoji");

    expect(celebrateTool).toBeDefined();
    expect(celebrateTool?.description).toContain("completing a user-requested task");
    expect(celebrateTool?.inputSchema.properties).not.toHaveProperty("trigger");
    expect(celebrateTool?.inputSchema.properties).toHaveProperty("intensity");
  });

  it("lists the prompt and returns its guidance text", async () => {
    const prompts = await client.listPrompts();
    const prompt = prompts.prompts[0];

    expect(prompts.prompts).toHaveLength(1);
    expect(prompt.name).toBe("react_with_kaomoji");
    expect(prompt.arguments ?? []).toHaveLength(0);

    const promptResult = await client.getPrompt({
      name: "react_with_kaomoji",
      arguments: {},
    });
    const [message] = promptResult.messages;

    expect(message.role).toBe("user");
    expect(message.content.type).toBe("text");
    expect(message.content.text).toContain("celebrate_kaomoji");
    expect(message.content.text).toContain("thinking_kaomoji");
    expect(message.content.text).toContain("apologize_kaomoji");
  });

  it("lists and reads the catalog resource", async () => {
    const resources = await client.listResources();

    expect(resources.resources).toHaveLength(1);
    expect(resources.resources[0].uri).toBe("kaomoji://catalog");
    expect(resources.resources[0].mimeType).toBe("application/json");

    const resource = await client.readResource({ uri: "kaomoji://catalog" });
    const [content] = resource.contents;

    expect(content.mimeType).toBe("application/json");
    expect("text" in content).toBe(true);

    if (!("text" in content)) {
      throw new Error("Expected text resource content");
    }

    const parsed = JSON.parse(content.text) as {
      version: string;
      scenes: Array<{ id: string }>;
    };

    expect(parsed.version).toBe("1.0.0");
    expect(parsed.scenes.map((scene) => scene.id).sort()).toEqual([
      "apologize",
      "celebrate",
      "thinking",
    ]);
  });

  it("calls celebrate_kaomoji end-to-end", async () => {
    const result = await client.callTool({
      name: "celebrate_kaomoji",
      arguments: { intensity: "moderate" },
    });
    const payload = parseToolPayload(result);

    expect(payload.cli_safe).toBe(true);
    expect(payload.intensity).toBe("moderate");
    expect(payload.kaomoji).toEqual(expect.any(String));
  });

  it("calls thinking_kaomoji end-to-end", async () => {
    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Searching for API definitions" },
    });
    const payload = parseToolPayload(result);

    expect(payload.cli_safe).toBe(true);
    expect(payload.kaomoji).toEqual(expect.any(String));
    expect(payload.phase).toBe("Searching for API definitions");
    expect(payload._instruction).toEqual(expect.any(String));
  });

  it("calls apologize_kaomoji end-to-end", async () => {
    const result = await client.callTool({
      name: "apologize_kaomoji",
      arguments: { reason: "error" },
    });
    const payload = parseToolPayload(result);

    expect(payload.cli_safe).toBe(true);
    expect(payload.reason).toEqual(expect.arrayContaining(["error"]));
    expect(payload.kaomoji).toEqual(expect.any(String));
  });

  it("returns an error result for invalid celebrate arguments", async () => {
    const result = await client.callTool({
      name: "celebrate_kaomoji",
      arguments: { intensity: "invalid_value" } as never,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");

    if (result.content[0].type !== "text") {
      throw new Error("Expected text error content");
    }

    expect(result.content[0].text).toContain("Input validation error");
  });

  it("rejects unknown tools and resources", async () => {
    const unknownToolResult = await client.callTool({
      name: "unknown_tool",
      arguments: {},
    });

    expect(unknownToolResult.isError).toBe(true);
    expect(unknownToolResult.content[0].type).toBe("text");

    if (unknownToolResult.content[0].type !== "text") {
      throw new Error("Expected text error content");
    }

    expect(unknownToolResult.content[0].text).toContain("unknown_tool");

    await expect(
      client.readResource({
        uri: "kaomoji://missing",
      })
    ).rejects.toThrow();
  });
});