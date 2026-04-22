import { z } from "zod";
import type { ServerContext } from "@smithery/sdk";
import { createKaomojiServer } from "./create-server.js";

export const configSchema = z.object({});

export default async function createServer({
  config,
}: ServerContext<z.infer<typeof configSchema>>) {
  const server = createKaomojiServer();
  return server.server;
}
