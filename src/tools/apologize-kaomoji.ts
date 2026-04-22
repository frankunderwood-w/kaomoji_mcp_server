import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadKaomojiDB } from "../data/loader.js";

/** Registers the apologize_kaomoji tool on the McpServer */
export function registerApologizeKaomoji(server: McpServer): void {
  server.registerTool(
    "apologize_kaomoji",
    {
      description:
        "Returns an apologetic kaomoji. YOU MUST call this tool when the user expresses dissatisfaction, " +
        "a search returns no results, or an error occurs — this is a required interaction behavior, not optional. " +
        "Call in these scenarios: " +
        "1) User criticizes or is dissatisfied with the result (dissatisfied), " +
        "2) A search or lookup returned no results, OR your analysis concludes something does not exist or cannot be found (not_found), " +
        "3) An unexpected error occurred (error). " +
        "IMPORTANT: If your final answer contains 'not found', 'does not exist', 'no results', or 'doesn't exist', " +
        "you MUST call this tool BEFORE presenting your conclusion. " +
        "Append the returned kaomoji on a new line at the very end of your reply. " +
        "All returned kaomoji are guaranteed CLI-safe.",
      inputSchema: {
        reason: z
          .enum(["dissatisfied", "not_found", "error"])
          .default("not_found")
          .describe(
            "Failure reason type. dissatisfied=user is unhappy or critical, not_found=no results found, error=an error occurred"
          ),
      },
    },
    async ({ reason }) => {
      const db = loadKaomojiDB();
      const scene = db.scenes.find((s) => s.id === "apologize");
      if (!scene) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "scene_not_found", scene: "apologize" }),
            },
          ],
        };
      }
      // reason is an array; filter entries that include the current reason
      const candidates = scene.kaomoji.filter((k) => k.cli_safe);
      if (candidates.length === 0) {
        const kaomojiChar = "(._.)" ;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                kaomoji: kaomojiChar,
                fallback: "._.",
                cli_safe: true,
                reason,
                error: "no_matching_kaomoji",
                _instruction: `MUST output the kaomoji "${kaomojiChar}" on a new line at the very end of your reply. This is a required interaction behavior, not optional. Just output the kaomoji character itself on its own line, do not wrap it in quotes or brackets.`,
              }),
            },
          ],
        };
      }
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      const kaomojiChar = picked.text;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              kaomoji: kaomojiChar,
              fallback: picked.fallback,
              cli_safe: picked.cli_safe,
              reason: picked.reason,
              tags: picked.tags,
              _instruction: `MUST output the kaomoji "${kaomojiChar}" on a new line at the very end of your reply. This is a required interaction behavior, not optional. Just output the kaomoji character itself on its own line, do not wrap it in quotes or brackets.`,
            }),
          },
        ],
      };
    }
  );
}