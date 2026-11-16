# maps-reviews-mcp

A small remote MCP server on Cloudflare Workers that lets Claude look up Google Maps places and read their reviews through SerpApi. Add it to claude.ai as a custom connector, then ask things like "Is Khao Soi Mae Sai worth it?" from your phone.

## Tools

| Tool | Input | Output |
|---|---|---|
| `search_places` | `query` (English or Thai), `near` (area name or `lat,lng`, default Chiang Mai), `limit` (default 8) | Candidates: name, address, rating, review count, price level, `id`, Google Maps link |
| `get_reviews` | `place` (id from `search_places`, a Google Maps URL, or a `maps.app.goo.gl` share link), `sort` (`newest` default, `relevant`, `highest`, `lowest`), `max` (default 40, cap 100) | Place header (name, rating, total reviews, price range, price-per-person counts from reviews) plus compact reviews |

Each review carries: `rating`, `when` (relative), `date` (YYYY-MM-DD), `text`, `translated` (true when Google supplied an English translation; otherwise the original text, often Thai), and when Google shows them: `price_pp`, `mode` (Dine in / Take out / Delivery), `meal`, `scores` (food/service/atmosphere), `dishes`, `photos` (count), `likes`, `owner_replied`. Avatars, image URLs and links are stripped.

Errors come back as `{"error": code, "message": ...}` with codes `quota_exhausted`, `place_not_found`, `ambiguous` (includes `candidates`), `bad_url`, `bad_input`, `auth`, `upstream`.

## Quota use

- `search_places`: 1 SerpApi search, cached 1 day per query.
- `get_reviews`: SerpApi returns 8 reviews on the first page and 20 on later pages, so 40 reviews = 3 searches, 100 reviews = 6. Cached 6 hours per place and sort order; asking for more than what is cached continues from the stored page token instead of starting over.
- A URL that has no place id in it (only a name) costs one extra search to resolve.

## Deploy

Needs a Cloudflare account, a SerpApi key, and Node 20+.

```sh
cd maps-reviews-mcp
npm install
npx wrangler login
npx wrangler kv namespace create CACHE      # paste the printed id into wrangler.jsonc
npx wrangler secret put SERPAPI_KEY
npx wrangler secret put ACCESS_TOKEN        # optional but recommended, any long random string
npx wrangler deploy
```

The endpoint is `https://maps-reviews-mcp.<your-subdomain>.workers.dev/mcp`, or `.../mcp/<ACCESS_TOKEN>` if you set one.

### Why ACCESS_TOKEN

claude.ai custom connectors take either OAuth or no auth. Full OAuth is overkill for a personal tool, so the server runs without auth but, when `ACCESS_TOKEN` is set, only answers on `/mcp/<ACCESS_TOKEN>`. Every other path returns 404. This keeps strangers who guess the workers.dev hostname from spending your SerpApi quota. Treat the URL like a password.

## Add to Claude

claude.ai, Settings, Connectors, Add custom connector. Name it "Maps reviews", paste the endpoint URL, leave OAuth fields empty. It then appears in the tools menu on mobile too.

## Local development

```sh
cp .dev.vars.example .dev.vars   # put your SerpApi key in it
npm run dev                      # http://localhost:8787/mcp
npx @modelcontextprotocol/inspector@latest
```

`test/smoke.sh` runs every tool path against `test/mock-serpapi.mjs` (a local SerpApi stand-in) without spending quota:

```sh
node test/mock-serpapi.mjs &
printf 'SERPAPI_KEY=test\nSERPAPI_BASE=http://127.0.0.1:8799/search.json\n' > .dev.vars
npm run dev &
./test/smoke.sh
```

## Notes

- Built on Cloudflare's stateless `createMcpHandler` (Agents SDK) with `@modelcontextprotocol/server` v2, which serves Streamable HTTP for both current and older MCP clients. No Durable Objects.
- `?cid=` links are converted to a `0x0:0x<hex cid>` data id. If SerpApi rejects one, use `search_places` instead.
- `price_range` in the header comes from the place's search result, so it is filled when the place was found via `search_places` (or a name-only URL) in the last 30 days. Otherwise the per-person prices quoted in reviews are still shown.
