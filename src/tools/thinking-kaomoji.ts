import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/** Thinking kaomoji pool — hardcoded CLI-safe entries as the primary source */
const THINKING_KAOMOJI_POOL = [
  { kaomoji: "(..)", fallback: ".." },
  { kaomoji: "(._.)", fallback: "._." },
  { kaomoji: "(o_O)?", fallback: "o_O?" },
  { kaomoji: "(>_<)", fallback: ">_<" },
  { kaomoji: "(x_x)", fallback: "x_x" },
  { kaomoji: "(~_~)", fallback: "~_~" },
  { kaomoji: "(-_-;)", fallback: "-_-;" },
  { kaomoji: "(^_^)?", fallback: "^_^?" },
  { kaomoji: "(???)" , fallback: "???" },
  { kaomoji: "(o.o)", fallback: "o.o" },
];

/** Maximum allowed length for the phase/subtask name */
const MAX_PHASE_LENGTH = 80;

/** Maximum allowed length for the mcp_server name */
const MAX_MCP_SERVER_LENGTH = 64;

/** Picks a random kaomoji from the pool */
function pickRandomKaomoji(): { kaomoji: string; fallback: string } {
  return THINKING_KAOMOJI_POOL[Math.floor(Math.random() * THINKING_KAOMOJI_POOL.length)];
}

/** Registers the thinking_kaomoji tool on the McpServer */
export function registerThinkingKaomoji(server: McpServer): void {
  server.registerTool(
    "thinking_kaomoji",
    {
      description:
        "Call this tool EVERY TIME you enter a new sub-task or thinking phase to show the user your current progress. " +
        "This creates a visible thinking process similar to deep-thinking indicators.\n\n" +
        "When to call:\n" +
        "- Before starting a new sub-task (e.g. 'Searching for auth middleware', 'Analyzing error patterns')\n" +
        "- When transitioning between phases (e.g. 'Planning refactoring approach', 'Running verification')\n" +
        "- Before executing any tool chain or multi-step operation\n" +
        "- When you begin a new line of reasoning or analysis\n" +
        "- BEFORE calling another MCP server's tools — pass the MCP server name in the mcp_server field\n\n" +
        "You do NOT need to call this for trivial single-step operations or when you are about to give the final answer.\n\n" +
        "The tool returns a random thinking kaomoji. Output the phase name and kaomoji in your reply " +
        "so the user can see what you are working on. When calling another MCP server's tools, " +
        "include the mcp_server parameter to clearly indicate which server you are delegating work to.",
      inputSchema: {
        phase: z
          .string()
          .min(1)
          .max(MAX_PHASE_LENGTH)
          .describe(
            "Brief name of the current sub-task or thinking phase you are entering. " +
            "Keep it concise (max " + MAX_PHASE_LENGTH + " chars). " +
            "Examples: 'Searching for auth middleware', 'Analyzing test failures', 'Refactoring imports'"
          ),
        mcp_server: z
          .string()
          .min(1)
          .max(MAX_MCP_SERVER_LENGTH)
          .optional()
          .describe(
            "Name of the MCP server you are about to call. " +
            "Pass this when you are about to use a tool from another MCP server, " +
            "so the user knows which external service you are delegating to. " +
            "Examples: 'filesystem', 'github', 'postgres', 'brave-search'"
          ),
      },
    },
    async ({ phase, mcp_server }) => {
      const { kaomoji, fallback } = pickRandomKaomoji();
      const serverLabel = mcp_server ? ` [${mcp_server}]` : "";
      const phaseLine = `**${phase}**${serverLabel}`;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              kaomoji,
              fallback,
              cli_safe: true,
              phase,
              ...(mcp_server ? { mcp_server } : {}),
              _instruction:
                `You MUST output the following in your reply — on a new line, output the phase name` +
                (mcp_server ? ` with the MCP server name in brackets` : "") +
                `, then on the very next line output the kaomoji "${kaomoji}" by itself. ` +
                `Format:\n` +
                `${phaseLine}\n` +
                `${kaomoji}\n\n` +
                `This is a required interaction behavior, not optional. ` +
                `Do not wrap the kaomoji in quotes or brackets. ` +
                `The phase name and kaomoji should appear before your actual work output for this sub-task.`,
            }),
          },
        ],
      };
    }
  );
}
