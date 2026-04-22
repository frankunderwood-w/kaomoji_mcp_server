import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerThinkingKaomoji } from "../../src/tools/thinking-kaomoji.js";

function parseToolPayload(result: Awaited<ReturnType<Client["callTool"]>>) {
  const [content] = result.content;

  if (!content || content.type !== "text") {
    throw new Error("Expected text tool content");
  }

  return JSON.parse(content.text) as Record<string, unknown>;
}

async function createHarness() {
  const server = new McpServer(
    { name: "thinking-test-server", version: "1.0.0" },
    { capabilities: { logging: {} } }
  );
  registerThinkingKaomoji(server);

  const client = new Client({ name: "thinking-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { server, client };
}

describe("thinking_kaomoji tool", () => {
  it("returns a random kaomoji with the provided phase name", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Searching for auth middleware" },
    });
    const payload = parseToolPayload(result);

    expect(payload.kaomoji).toEqual(expect.any(String));
    expect(payload.kaomoji.length).toBeGreaterThan(0);
    expect(payload.fallback).toEqual(expect.any(String));
    expect(payload.cli_safe).toBe(true);
    expect(payload.phase).toBe("Searching for auth middleware");
    expect(payload._instruction).toEqual(expect.any(String));
    expect(payload._instruction).toContain(payload.kaomoji as string);
    expect(payload._instruction).toContain("Searching for auth middleware");
  });

  it("returns different kaomoji across multiple calls (randomness check)", async () => {
    const { client } = await createHarness();

    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await client.callTool({
        name: "thinking_kaomoji",
        arguments: { phase: `Phase ${i}` },
      });
      const payload = parseToolPayload(result);
      results.add(payload.kaomoji as string);
    }

    // With 10 entries in the pool and 20 calls, we should get at least 2 different kaomoji
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  it("always returns cli_safe: true", async () => {
    const { client } = await createHarness();

    for (let i = 0; i < 10; i++) {
      const result = await client.callTool({
        name: "thinking_kaomoji",
        arguments: { phase: `Test phase ${i}` },
      });
      const payload = parseToolPayload(result);
      expect(payload.cli_safe).toBe(true);
    }
  });

  it("includes _instruction telling the LLM to output the phase and kaomoji", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Analyzing patterns" },
    });
    const payload = parseToolPayload(result);
    const instruction = payload._instruction as string;

    expect(instruction).toContain("MUST");
    expect(instruction).toContain("phase");
    expect(instruction).toContain(payload.kaomoji);
    expect(instruction).toContain("Analyzing patterns");
    expect(instruction).toContain("new line");
  });

  it("preserves the phase name exactly as provided", async () => {
    const { client } = await createHarness();

    const phases = [
      "Simple",
      "Searching for API interface definitions across the codebase",
      "Running verification tests",
    ];

    for (const phase of phases) {
      const result = await client.callTool({
        name: "thinking_kaomoji",
        arguments: { phase },
      });
      const payload = parseToolPayload(result);
      expect(payload.phase).toBe(phase);
    }
  });

  it("accepts a phase name at exactly the max length (80 chars)", async () => {
    const { client } = await createHarness();

    const phase = "A".repeat(80);
    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase },
    });

    expect(result.isError).toBeFalsy();
    const payload = parseToolPayload(result);
    expect(payload.phase).toBe(phase);
  });

  it("rejects a phase name that exceeds the max length (81 chars)", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "A".repeat(81) },
    });

    expect(result.isError).toBe(true);
  });

  it("rejects an empty phase name", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "" },
    });

    expect(result.isError).toBe(true);
  });
});

describe("thinking_kaomoji tool — mcp_server parameter", () => {
  it("accepts mcp_server parameter and includes it in response", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Reading project files", mcp_server: "filesystem" },
    });
    const payload = parseToolPayload(result);

    expect(payload.phase).toBe("Reading project files");
    expect(payload.mcp_server).toBe("filesystem");
    expect(payload.kaomoji).toEqual(expect.any(String));
    expect(payload.cli_safe).toBe(true);
  });

  it("includes MCP server name in _instruction format", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Querying database", mcp_server: "postgres" },
    });
    const payload = parseToolPayload(result);
    const instruction = payload._instruction as string;

    // The instruction should contain the phase with server name in brackets
    expect(instruction).toContain("Querying database");
    expect(instruction).toContain("[postgres]");
    expect(instruction).toContain("MCP server name in brackets");
    // The phase line format should be: **Querying database** [postgres]
    expect(instruction).toContain("**Querying database** [postgres]");
  });

  it("works without mcp_server parameter (backward compatibility)", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Analyzing code" },
    });
    const payload = parseToolPayload(result);

    expect(payload.phase).toBe("Analyzing code");
    expect(payload).not.toHaveProperty("mcp_server");
    expect(payload.kaomoji).toEqual(expect.any(String));
  });

  it("does not include server bracket format when mcp_server is absent", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Searching files" },
    });
    const payload = parseToolPayload(result);
    const instruction = payload._instruction as string;

    // Without mcp_server, the instruction should have plain phase format: **Searching files**
    expect(instruction).toContain("**Searching files**\n");
    // Should NOT contain brackets for server name
    expect(instruction).not.toContain("[");
  });

  it("includes server bracket format when mcp_server is provided", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Searching files", mcp_server: "github" },
    });
    const payload = parseToolPayload(result);
    const instruction = payload._instruction as string;

    // With mcp_server, the format should be: **Searching files** [github]
    expect(instruction).toContain("**Searching files** [github]");
  });

  it("accepts mcp_server at exactly the max length (64 chars)", async () => {
    const { client } = await createHarness();

    const mcpServer = "x".repeat(64);
    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Test phase", mcp_server: mcpServer },
    });

    expect(result.isError).toBeFalsy();
    const payload = parseToolPayload(result);
    expect(payload.mcp_server).toBe(mcpServer);
  });

  it("rejects mcp_server that exceeds max length (65 chars)", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Test phase", mcp_server: "x".repeat(65) },
    });

    expect(result.isError).toBe(true);
  });

  it("rejects empty mcp_server string", async () => {
    const { client } = await createHarness();

    const result = await client.callTool({
      name: "thinking_kaomoji",
      arguments: { phase: "Test phase", mcp_server: "" },
    });

    expect(result.isError).toBe(true);
  });
});