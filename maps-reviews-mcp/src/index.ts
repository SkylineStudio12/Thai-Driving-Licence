import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { env as workerEnv } from "cloudflare:workers";
import { Env, UserError } from "./serpapi";
import { searchPlaces } from "./places";
import { resolvePlace } from "./resolve";
import { SORTS, Sort, getReviews } from "./reviews";

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v) }] });

function fail(e: unknown) {
  if (e instanceof UserError) {
    const body: Record<string, unknown> = { error: e.code, message: e.message };
    if (e.extra) body.candidates = e.extra;
    return { ...json(body), isError: true };
  }
  console.error(e);
  return { ...json({ error: "internal", message: `Unexpected error: ${(e as Error)?.message ?? e}` }), isError: true };
}

function createServer() {
  const env = workerEnv as unknown as Env;
  const server = new McpServer({ name: "maps-reviews", version: "1.0.0" });

  server.registerTool(
    "search_places",
    {
      title: "Search Google Maps places",
      description:
        "Find restaurants, cafes, bars or other places on Google Maps. Returns candidates with name, address, rating, " +
        "review count, price level, an id for get_reviews, and a Google Maps link. Accepts English or Thai names. " +
        "Results are biased to Chiang Mai unless `near` says otherwise.",
      inputSchema: z.object({
        query: z.string().min(1).describe('Place name, optionally with area, e.g. "Khao Soi Mae Sai" or "ข้าวซอยแม่สาย"'),
        near: z
          .string()
          .optional()
          .describe('Location bias: an area name ("Nimman", "Old City", "Bangkok") or "lat,lng". Default: Chiang Mai.'),
        limit: z.number().int().min(1).max(20).optional().describe("Max candidates (default 8)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, near, limit }) => {
      try {
        return json(await searchPlaces(env, query, near, limit ?? 8));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_reviews",
    {
      title: "Read Google Maps reviews",
      description:
        "Read recent Google Maps reviews for one place. `place` is an id from search_places, or a pasted Google Maps URL " +
        "(full or maps.app.goo.gl share link). Reviews come translated to English when Google has a translation " +
        "(translated:true), otherwise in the original language (often Thai). Each review has rating, relative and " +
        "absolute date, text, and when present price per person, dining mode, meal, sub-scores, recommended dishes, " +
        "photo count and whether the owner replied.",
      inputSchema: z.object({
        place: z.string().min(1).describe("Place id from search_places, or a Google Maps URL"),
        sort: z
          .enum(Object.keys(SORTS) as [Sort, ...Sort[]])
          .optional()
          .describe("newest (default), relevant, highest, lowest"),
        max: z.number().int().min(1).max(100).optional().describe("Max reviews to return (default 40, cap 100)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ place, sort, max }) => {
      try {
        const ref = await resolvePlace(env, place);
        return json(await getReviews(env, ref, sort ?? "newest", Math.min(max ?? 40, 100)));
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}

const mcp = createMcpHandler(createServer, { route: "/mcp" });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response("maps-reviews MCP server. Connect an MCP client to the /mcp endpoint.\n");
    }
    // Optional shared secret in the path: /mcp/<ACCESS_TOKEN>. Keeps strangers off your SerpApi quota.
    if (env.ACCESS_TOKEN) {
      if (url.pathname !== `/mcp/${env.ACCESS_TOKEN}`) return new Response("Not found", { status: 404 });
      url.pathname = "/mcp";
      request = new Request(url.toString(), request);
    }
    return mcp(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
