import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCelebrateKaomoji } from "./tools/celebrate-kaomoji.js";
import { registerThinkingKaomoji } from "./tools/thinking-kaomoji.js";
import { registerApologizeKaomoji } from "./tools/apologize-kaomoji.js";
import { registerReactWithPrompt } from "./prompts/react-with.js";
import { registerCatalogResource } from "./resources/catalog.js";

/**
 * Server-level behavior instructions.
 * Injected into the MCP initialize response so that clients that automatically
 * propagate server instructions into the LLM context will always see this guide,
 * even when the react_with_kaomoji Prompt has not been explicitly loaded.
 */
const SERVER_INSTRUCTIONS = `This MCP server provides kaomoji (ASCII emoticons) for use at key interaction points. YOU MUST call the appropriate tool at these moments:

1. BEFORE entering each sub-task or thinking phase → call thinking_kaomoji
    - Pass a brief "phase" name describing what you are about to do (e.g. "Searching for auth middleware", "Analyzing error patterns").
    - Output the returned phase name and kaomoji before your actual work for this sub-task.
    - This creates a visible thinking process for the user, similar to deep-thinking indicators.
    - You do NOT need to call this for trivial single-step operations or when you are about to give the final answer.
    - IMPORTANT: When you are about to call another MCP server's tools, pass the "mcp_server" parameter to indicate which server you are delegating to. E.g. thinking_kaomoji({ phase: "Reading project files", mcp_server: "filesystem" }). The output will show the server name in brackets: **Reading project files** [filesystem]

2. AFTER completing a user task → call celebrate_kaomoji
    - Use when a file has been written, code modified, or a build task is done.
    - Choose intensity: "subtle" for simple fixes, "moderate" for regular completions, "intense" for major breakthroughs.
    - Output the returned kaomoji on a new line at the very end of your reply.

3. WHEN user is dissatisfied OR you reach a negative conclusion OR a search returns no results OR an error occurs → call apologize_kaomoji
    - reason="dissatisfied": user criticizes or expresses disappointment
    - reason="not_found"   : NO RESULTS — applies when:
      * A search tool (grep, glob, etc.) returned zero matches
      * Your analysis concludes that something DOES NOT EXIST or CANNOT BE FOUND
      * You are about to tell the user "not found", "no results", "doesn't exist", "cannot be found"
      * IMPORTANT: If your final answer contains any form of "not found", call apologize_kaomoji FIRST
    - reason="error"       : an unexpected error occurred
    - Output the returned kaomoji on a new line at the very end of your reply.

Rules: use at most 1 celebration/apology kaomoji per reply (on a new line at the very end); thinking_kaomoji may appear multiple times per reply (once per sub-task); never inside code blocks or command output.
Full behavior guide: call the react_with_kaomoji prompt for detailed instructions.`;

export function createKaomojiServer() {
  const server = new McpServer(
    {
      name: "kaomoji-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        logging: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  // Register tools
  registerCelebrateKaomoji(server);
  registerThinkingKaomoji(server);
  registerApologizeKaomoji(server);

  // Register Prompt
  registerReactWithPrompt(server);

  // Register Resource
  registerCatalogResource(server);

  return server;
}
