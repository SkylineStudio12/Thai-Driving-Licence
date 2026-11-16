export interface Env {
  CACHE: KVNamespace;
  SERPAPI_KEY: string;
  SERPAPI_BASE?: string;
  ACCESS_TOKEN?: string;
}

/** An error whose message is meant to be shown to Claude as-is. */
export class UserError extends Error {
  constructor(
    public code: string,
    message: string,
    public extra?: unknown,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | undefined>;

/** Calls SerpApi and maps its failure modes onto readable errors. */
export async function serp(env: Env, params: Params): Promise<any> {
  if (!env.SERPAPI_KEY) {
    throw new UserError("config", "Server misconfigured: SERPAPI_KEY secret is not set.");
  }
  const url = new URL(env.SERPAPI_BASE || "https://serpapi.com/search.json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("api_key", env.SERPAPI_KEY);

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  } catch (e) {
    throw new UserError("upstream", `Could not reach SerpApi: ${(e as Error).message}`);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // fall through with body = null
  }
  const err: string | undefined = body?.error;

  if (res.status === 429 || (err && /run out of searches|plan.*limit|exceeded|hourly/i.test(err))) {
    throw new UserError(
      "quota_exhausted",
      `SerpApi quota exhausted (${err ?? "HTTP 429"}). Cached results still work; new lookups will fail until the quota resets.`,
    );
  }
  if (res.status === 401 || (err && /invalid api key/i.test(err))) {
    throw new UserError("auth", "SerpApi rejected the API key (check the SERPAPI_KEY secret).");
  }
  if (err && /hasn't returned any results|no results/i.test(err)) {
    return { __empty: true, error: err };
  }
  if (err) throw new UserError("upstream", `SerpApi error: ${err}`);
  if (!res.ok || !body) throw new UserError("upstream", `SerpApi HTTP ${res.status}`);
  return body;
}

/** KV read-through cache. Failures to read/write the cache never break a lookup. */
export async function cached<T>(
  env: Env,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<{ value: T; hit: boolean }> {
  try {
    const hit = await env.CACHE.get<T>(key, "json");
    if (hit !== null) return { value: hit, hit: true };
  } catch {
    /* ignore */
  }
  const value = await load();
  try {
    await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {
    /* ignore */
  }
  return { value, hit: false };
}

export const DAY = 86400;
export const SIX_HOURS = 6 * 3600;
