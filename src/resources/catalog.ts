import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadKaomojiDB } from "../data/loader.js";

/** Registers the kaomoji://catalog Resource on the McpServer */
export function registerCatalogResource(server: McpServer): void {
  server.registerResource(
    "CLI-Safe Kaomoji Catalog",
    "kaomoji://catalog",
    { mimeType: "application/json" },
    async (uri) => {
      const db = loadKaomojiDB();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(db, null, 2),
          },
        ],
      };
    }
  );
}