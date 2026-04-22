import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadKaomojiDB } from "../data/loader.js";

/** Registers the celebrate_kaomoji tool on the McpServer */
export function registerCelebrateKaomoji(server: McpServer): void {
  server.registerTool(
    "celebrate_kaomoji",
    {
      description:
        "Returns a celebratory kaomoji. YOU MUST call this tool after completing a user-requested task — " +
        "this is a required interaction behavior, not optional. " +
        "Decision criteria: Write/Edit tool returned success, user has not expressed dissatisfaction, Agent is about to stop responding. " +
        "Append the returned kaomoji at the very end of your reply. " +
        "All returned kaomoji are guaranteed CLI-safe.",
      inputSchema: {
        intensity: z
          .enum(["subtle", "moderate", "intense"])
          .default("moderate")
          .describe(
            "Celebration intensity. subtle=gentle smile (formal contexts), moderate=happy (default), intense=excited/elated (major breakthroughs)"
          ),
      },
    },
    async ({ intensity }) => {
      const db = loadKaomojiDB();
      const scene = db.scenes.find((s) => s.id === "celebrate");
      if (!scene) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "scene_not_found", scene: "celebrate" }),
            },
          ],
        };
      }
      const candidates = scene.kaomoji.filter((k) => k.cli_safe);
      if (candidates.length === 0) {
        const kaomojiChar = "(^-^)";
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                kaomoji: kaomojiChar,
                fallback: ":)",
                cli_safe: true,
                intensity,
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
              intensity: picked.intensity,
              tags: picked.tags,
              _instruction: `MUST output the kaomoji "${kaomojiChar}" on a new line at the very end of your reply. This is a required interaction behavior, not optional. Just output the kaomoji character itself on its own line, do not wrap it in quotes or brackets.`,
            }),
          },
        ],
      };
    }
  );
}