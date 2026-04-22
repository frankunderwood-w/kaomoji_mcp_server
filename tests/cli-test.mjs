/**
 * CLI Integration Test Script for kaomoji-mcp
 * Tests the MCP server via InMemoryTransport (no stdio required)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createKaomojiServer } from "../build/create-server.js";

const results = [];

function log(category, test, passed, detail) {
  results.push({ category, test, passed, detail });
  const status = passed ? "PASS" : "FAIL";
  console.log(`[${status}] ${category} :: ${test}${detail ? " - " + detail : ""}`);
}

async function runTests() {
  console.log("=== Kaomoji MCP CLI Integration Tests ===\n");

  const server = createKaomojiServer();
  const client = new Client({ name: "cli-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  // =========================================
  // 1. Tool Listing
  // =========================================
  console.log("\n--- 1. Tool Listing ---");
  const tools = await client.listTools();
  const toolNames = tools.tools.map(t => t.name).sort();
  log("Tool-List", "lists 4 tools", toolNames.length === 4, `got: ${toolNames.join(", ")}`);
  log("Tool-List", "has celebrate_kaomoji", toolNames.includes("celebrate_kaomoji"));
  log("Tool-List", "has start_thinking_timer", toolNames.includes("start_thinking_timer"));
  log("Tool-List", "has stop_thinking_timer", toolNames.includes("stop_thinking_timer"));
  log("Tool-List", "has apologize_kaomoji", toolNames.includes("apologize_kaomoji"));

  // Tool descriptions (non-empty)
  for (const tool of tools.tools) {
    log("Tool-Desc", `${tool.name} has description`, typeof tool.description === "string" && tool.description.length > 0);
  }

  // =========================================
  // 2. Tool Schema Validation
  // =========================================
  console.log("\n--- 2. Tool Schema Validation ---");
  const celebrateTool = tools.tools.find(t => t.name === "celebrate_kaomoji");
  log("Schema", "celebrate has trigger param", !!celebrateTool?.inputSchema?.properties?.trigger);
  log("Schema", "celebrate trigger has enum values", celebrateTool?.inputSchema?.properties?.trigger?.enum?.length === 3, `got: ${JSON.stringify(celebrateTool?.inputSchema?.properties?.trigger?.enum)}`);
  log("Schema", "celebrate has intensity param", !!celebrateTool?.inputSchema?.properties?.intensity);
  log("Schema", "celebrate intensity has enum values", celebrateTool?.inputSchema?.properties?.intensity?.enum?.length === 3);

  const startTool = tools.tools.find(t => t.name === "start_thinking_timer");
  log("Schema", "start_thinking has threshold param", !!startTool?.inputSchema?.properties?.threshold);
  log("Schema", "start_thinking has interval param", !!startTool?.inputSchema?.properties?.interval);
  log("Schema", "start_thinking has task_description param", !!startTool?.inputSchema?.properties?.task_description);
  log("Schema", "start_thinking threshold min=5", startTool?.inputSchema?.properties?.threshold?.minimum === 5);
  log("Schema", "start_thinking threshold max=300", startTool?.inputSchema?.properties?.threshold?.maximum === 300);

  const stopTool = tools.tools.find(t => t.name === "stop_thinking_timer");
  log("Schema", "stop_thinking has timer_id param", !!stopTool?.inputSchema?.properties?.timer_id);

  const apologizeTool = tools.tools.find(t => t.name === "apologize_kaomoji");
  log("Schema", "apologize has reason param", !!apologizeTool?.inputSchema?.properties?.reason);
  log("Schema", "apologize reason has enum values", apologizeTool?.inputSchema?.properties?.reason?.enum?.length === 3);

  // =========================================
  // 3. Prompt Tests
  // =========================================
  console.log("\n--- 3. Prompt Tests ---");
  const prompts = await client.listPrompts();
  log("Prompt-List", "lists at least 1 prompt", prompts.prompts.length >= 1);
  log("Prompt-List", "has react_with_kaomoji", prompts.prompts.some(p => p.name === "react_with_kaomoji"));
  
  const promptResult = await client.getPrompt({ name: "react_with_kaomoji", arguments: {} });
  log("Prompt-Content", "prompt returns messages", promptResult.messages.length > 0);
  const promptText = promptResult.messages[0]?.content?.text || "";
  log("Prompt-Content", "contains celebrate_kaomoji ref", promptText.includes("celebrate_kaomoji"));
  log("Prompt-Content", "contains start_thinking_timer ref", promptText.includes("start_thinking_timer"));
  log("Prompt-Content", "contains apologize_kaomoji ref", promptText.includes("apologize_kaomoji"));
  log("Prompt-Content", "contains usage principles", promptText.includes("Usage Rules"));

  // =========================================
  // 4. Resource Tests
  // =========================================
  console.log("\n--- 4. Resource Tests ---");
  const resources = await client.listResources();
  log("Resource-List", "lists at least 1 resource", resources.resources.length >= 1);
  log("Resource-List", "has kaomoji://catalog", resources.resources.some(r => r.uri === "kaomoji://catalog"));
  log("Resource-List", "catalog has application/json mime", resources.resources[0]?.mimeType === "application/json");

  const resource = await client.readResource({ uri: "kaomoji://catalog" });
  const catalogData = JSON.parse(resource.contents[0].text);
  log("Resource-Content", "catalog version is 1.0.0", catalogData.version === "1.0.0");
  log("Resource-Content", "catalog has 3 scenes", catalogData.scenes.length === 3, `got ${catalogData.scenes.length}`);
  const sceneIds = catalogData.scenes.map(s => s.id).sort();
  log("Resource-Content", "scenes are apologize,celebrate,thinking", sceneIds.join(",") === "apologize,celebrate,thinking");
  
  // Check each scene has kaomoji
  for (const scene of catalogData.scenes) {
    log("Resource-Content", `scene '${scene.id}' has kaomoji entries`, scene.kaomoji.length > 0, `${scene.kaomoji.length} entries`);
  }

  // =========================================
  // 5. Tool Call Tests - celebrate_kaomoji
  // =========================================
  console.log("\n--- 5. celebrate_kaomoji Call Tests ---");
  
  // Test all trigger values
  for (const trigger of ["task_complete", "problem_solved", "milestone_reached"]) {
    const res = await client.callTool({ name: "celebrate_kaomoji", arguments: { trigger, intensity: "moderate" } });
    const data = JSON.parse(res.content[0].text);
    log("Celebrate", `trigger=${trigger} works`, data.kaomoji !== undefined);
  }

  // Test all intensity values
  for (const intensity of ["subtle", "moderate", "intense"]) {
    const res = await client.callTool({ name: "celebrate_kaomoji", arguments: { trigger: "task_complete", intensity } });
    const data = JSON.parse(res.content[0].text);
    log("Celebrate", `intensity=${intensity} returns matching value`, data.intensity === intensity);
  }

  // Test default intensity
  const celebDefault = await client.callTool({ name: "celebrate_kaomoji", arguments: { trigger: "task_complete" } });
  const celebDefaultData = JSON.parse(celebDefault.content[0].text);
  log("Celebrate", "defaults to moderate intensity", celebDefaultData.intensity === "moderate");

  // Test response structure
  const celebStruct = await client.callTool({ name: "celebrate_kaomoji", arguments: { trigger: "task_complete", intensity: "intense" } });
  const celebStructData = JSON.parse(celebStruct.content[0].text);
  log("Celebrate", "response has kaomoji field", "kaomoji" in celebStructData);
  log("Celebrate", "response has fallback field", "fallback" in celebStructData);
  log("Celebrate", "response has cli_safe=true", celebStructData.cli_safe === true);
  log("Celebrate", "response has intensity field", "intensity" in celebStructData);
  log("Celebrate", "response has tags field", "tags" in celebStructData);
  log("Celebrate", "tags has en array", Array.isArray(celebStructData.tags?.en));
  log("Celebrate", "tags has zh array", Array.isArray(celebStructData.tags?.zh));

  // =========================================
  // 6. Tool Call Tests - apologize_kaomoji
  // =========================================
  console.log("\n--- 6. apologize_kaomoji Call Tests ---");

  // Test all reason values
  for (const reason of ["dissatisfied", "not_found", "error"]) {
    const res = await client.callTool({ name: "apologize_kaomoji", arguments: { reason } });
    const data = JSON.parse(res.content[0].text);
    log("Apologize", `reason=${reason} works`, data.kaomoji !== undefined);
    log("Apologize", `reason=${reason} cli_safe=true`, data.cli_safe === true);
    if (data.error !== "no_matching_kaomoji") {
      log("Apologize", `reason=${reason} includes matching reason`, Array.isArray(data.reason) && data.reason.includes(reason));
    }
  }

  // Test default reason
  const apoDefault = await client.callTool({ name: "apologize_kaomoji", arguments: {} });
  const apoDefaultData = JSON.parse(apoDefault.content[0].text);
  log("Apologize", "defaults to not_found reason", Array.isArray(apoDefaultData.reason) && apoDefaultData.reason.includes("not_found"));

  // Test response structure
  log("Apologize", "response has kaomoji field", "kaomoji" in apoDefaultData);
  log("Apologize", "response has fallback field", "fallback" in apoDefaultData);
  log("Apologize", "response has reason field", "reason" in apoDefaultData);

  // =========================================
  // 7. Tool Call Tests - thinking timer
  // =========================================
  console.log("\n--- 7. Thinking Timer Tests ---");

  // Start timer
  const startRes = await client.callTool({
    name: "start_thinking_timer",
    arguments: { threshold: 5, interval: 2, task_description: "CLI integration test" },
  });
  const startData = JSON.parse(startRes.content[0].text);
  log("Thinking", "start returns status=started", startData.status === "started");
  log("Thinking", "start returns timer_id", typeof startData.timer_id === "string" && startData.timer_id.startsWith("thinking-"));
  log("Thinking", "start returns threshold=5", startData.threshold === 5);
  log("Thinking", "start returns interval=2", startData.interval === 2);

  // Start second timer (concurrent)
  const startRes2 = await client.callTool({
    name: "start_thinking_timer",
    arguments: { threshold: 10, interval: 5 },
  });
  const startData2 = JSON.parse(startRes2.content[0].text);
  log("Thinking", "concurrent start returns different timer_id", startData2.timer_id !== startData.timer_id);

  // Stop specific timer
  const stopRes = await client.callTool({
    name: "stop_thinking_timer",
    arguments: { timer_id: startData.timer_id },
  });
  const stopData = JSON.parse(stopRes.content[0].text);
  log("Thinking", "stop specific timer returns stopped", stopData.status === "stopped");
  log("Thinking", "stop returns matching timer_id", stopData.timer_id === startData.timer_id);
  log("Thinking", "stop returns totalElapsed as number", typeof stopData.totalElapsed === "number");

  // Stop earliest timer (no timer_id)
  const stopEarliest = await client.callTool({
    name: "stop_thinking_timer",
    arguments: {},
  });
  const stopEarliestData = JSON.parse(stopEarliest.content[0].text);
  log("Thinking", "stop without timer_id stops earliest", stopEarliestData.status === "stopped");

  // Stop with no active timer
  const stopNone = await client.callTool({
    name: "stop_thinking_timer",
    arguments: {},
  });
  const stopNoneData = JSON.parse(stopNone.content[0].text);
  log("Thinking", "stop with no active timer returns no_active_timer", stopNoneData.status === "no_active_timer");

  // =========================================
  // 8. Error Handling Tests
  // =========================================
  console.log("\n--- 8. Error Handling Tests ---");

  // Invalid intensity
  const invalidIntensity = await client.callTool({
    name: "celebrate_kaomoji",
    arguments: { trigger: "task_complete", intensity: "super_happy" },
  });
  log("Error", "invalid intensity returns error", invalidIntensity.isError === true);

  // Invalid trigger
  const invalidTrigger = await client.callTool({
    name: "celebrate_kaomoji",
    arguments: { trigger: "unknown_trigger" },
  });
  log("Error", "invalid trigger returns error", invalidTrigger.isError === true);

  // Invalid reason
  const invalidReason = await client.callTool({
    name: "apologize_kaomoji",
    arguments: { reason: "unknown_reason" },
  });
  log("Error", "invalid reason returns error", invalidReason.isError === true);

  // Unknown tool - MCP SDK returns error response, not exception
  const unknownToolResult = await client.callTool({ name: "unknown_tool", arguments: {} });
  log("Error", "unknown tool returns isError=true", unknownToolResult.isError === true);

  // Unknown resource throws
  try {
    await client.readResource({ uri: "kaomoji://nonexistent" });
    log("Error", "unknown resource returns error", false, "no error thrown");
  } catch (e) {
    log("Error", "unknown resource returns error", true);
  }

  // =========================================
  // 9. Data Integrity Tests
  // =========================================
  console.log("\n--- 9. Data Integrity Tests ---");
  
  const catalogRaw = await client.readResource({ uri: "kaomoji://catalog" });
  const fullDb = JSON.parse(catalogRaw.contents[0].text);
  
  // Total entries >= 75
  const totalEntries = fullDb.scenes.reduce((sum, s) => sum + s.kaomoji.length, 0);
  log("Data", `total kaomoji entries >= 75`, totalEntries >= 75, `got ${totalEntries}`);
  
  // All entries are cli_safe
  let allCliSafe = true;
  let allHaveFallback = true;
  let allHaveTags = true;
  for (const scene of fullDb.scenes) {
    for (const entry of scene.kaomoji) {
      if (entry.cli_safe !== true) allCliSafe = false;
      if (!entry.fallback || typeof entry.fallback !== "string") allHaveFallback = false;
      if (!entry.tags?.en?.length || !entry.tags?.zh?.length) allHaveTags = false;
    }
  }
  log("Data", "all entries cli_safe=true", allCliSafe);
  log("Data", "all entries have fallback", allHaveFallback);
  log("Data", "all entries have tags (en+zh)", allHaveTags);

  // Celebrate scene has all intensities
  const celebrateScene = fullDb.scenes.find(s => s.id === "celebrate");
  const intensities = [...new Set(celebrateScene.kaomoji.map(k => k.intensity))];
  log("Data", "celebrate has subtle intensity", intensities.includes("subtle"));
  log("Data", "celebrate has moderate intensity", intensities.includes("moderate"));
  log("Data", "celebrate has intense intensity", intensities.includes("intense"));

  // Thinking scene has all states
  const thinkingScene = fullDb.scenes.find(s => s.id === "thinking");
  const states = [...new Set(thinkingScene.kaomoji.map(k => k.state))];
  log("Data", "thinking has thinking state", states.includes("thinking"));
  log("Data", "thinking has confused state", states.includes("confused"));
  log("Data", "thinking has effort state", states.includes("effort"));

  // Apologize scene has all reasons
  const apologizeScene = fullDb.scenes.find(s => s.id === "apologize");
  const reasons = [...new Set(apologizeScene.kaomoji.flatMap(k => k.reason || []))];
  log("Data", "apologize has dissatisfied reason", reasons.includes("dissatisfied"));
  log("Data", "apologize has not_found reason", reasons.includes("not_found"));
  log("Data", "apologize has error reason", reasons.includes("error"));

  // Check no scene is empty
  for (const scene of fullDb.scenes) {
    log("Data", `scene '${scene.id}' has entries`, scene.kaomoji.length > 0, `${scene.kaomoji.length} entries`);
  }

  await client.close();
  await server.close();

  // =========================================
  // 10. Smithery Entry Point Tests
  // =========================================
  console.log("\n--- 10. Smithery Entry Point Tests ---");
  
  const smitheryMod = await import("../build/smithery.js");
  log("Smithery", "exports configSchema", typeof smitheryMod.configSchema === "object");
  log("Smithery", "exports default createServer", typeof smitheryMod.default === "function");

  // configSchema parsing with defaults
  const defaultConfig = smitheryMod.configSchema.parse({});
  log("Smithery", "configSchema default threshold=15", defaultConfig.thinkingThreshold === 15);
  log("Smithery", "configSchema default interval=10", defaultConfig.thinkingInterval === 10);
  log("Smithery", "configSchema default maxTtl=300", defaultConfig.thinkingMaxTtl === 300);

  // configSchema parsing with custom values
  const customConfig = smitheryMod.configSchema.parse({ thinkingThreshold: 5, thinkingInterval: 3, thinkingMaxTtl: 60 });
  log("Smithery", "configSchema custom threshold=5", customConfig.thinkingThreshold === 5);
  log("Smithery", "configSchema custom interval=3", customConfig.thinkingInterval === 3);
  log("Smithery", "configSchema custom maxTtl=60", customConfig.thinkingMaxTtl === 60);

  // createServer returns MCP Server instance
  const smitheryServer = await smitheryMod.default({ config: { thinkingThreshold: 10, thinkingInterval: 5, thinkingMaxTtl: 120 } });
  log("Smithery", "createServer returns server object", typeof smitheryServer === "object");
  log("Smithery", "server has connect method", typeof smitheryServer.connect === "function");

  // =========================================
  // 11. Environment Variable Configuration
  // =========================================
  console.log("\n--- 11. Environment Variable Configuration ---");

  // Test default config (no env vars)
  const defaultServer = createKaomojiServer();
  log("EnvConfig", "server creates with default config", typeof defaultServer === "object");
  await defaultServer.close();

  // Test custom config override
  const customCfg = createKaomojiServer({ thinkingThreshold: 20, thinkingInterval: 15, thinkingMaxTtl: 600 });
  log("EnvConfig", "server creates with custom config", typeof customCfg === "object");
  await customCfg.close();

  // =========================================
  // Summary
  // =========================================
  console.log("\n========================================");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`=== Results: ${passed} passed, ${failed} failed out of ${results.length} tests ===`);
  
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => console.log(`  FAIL: ${r.category} :: ${r.test}${r.detail ? " - " + r.detail : ""}`));
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error("Test runner error:", e);
  process.exit(1);
});