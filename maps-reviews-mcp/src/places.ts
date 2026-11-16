import { DAY, Env, UserError, cached, serp } from "./serpapi";

export interface Candidate {
  name: string;
  id: string; // data_id ("0x...:0x...") when known, else Google place_id
  address?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  type?: string;
  open?: string;
  maps_url?: string;
}

/** Known areas so the default bias does not need coordinates typed in. */
const AREAS: Record<string, [number, number]> = {
  "chiang mai": [18.7883, 98.9853],
  "nimman": [18.7999, 98.9676],
  "old city": [18.7877, 98.9931],
  "chiang rai": [19.9105, 99.8406],
  "bangkok": [13.7563, 100.5018],
  "pai": [19.3587, 98.4404],
};

const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** Turns a location bias into SerpApi `ll` and/or extra query text. */
export function locationBias(near: string | undefined): { ll?: string; suffix?: string } {
  const n = (near ?? "Chiang Mai").trim();
  if (!n) return {};
  const m = n.match(COORDS);
  if (m) return { ll: `@${m[1]},${m[2]},15z` };
  const area = AREAS[n.toLowerCase()];
  if (area) return { ll: `@${area[0]},${area[1]},13z`, suffix: n };
  return { suffix: n };
}

export function cidFromDataId(dataId: string): string | undefined {
  const hex = dataId.split(":")[1];
  if (!hex) return undefined;
  try {
    return BigInt(hex).toString(10);
  } catch {
    return undefined;
  }
}

export function mapsUrl(p: { data_id?: string; data_cid?: string; place_id?: string; title?: string }): string | undefined {
  const cid = p.data_cid ?? (p.data_id ? cidFromDataId(p.data_id) : undefined);
  if (cid && cid !== "0") return `https://maps.google.com/?cid=${cid}`;
  if (p.place_id) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title ?? "place")}&query_place_id=${p.place_id}`;
  }
  return undefined;
}

function priceOf(r: any): string | undefined {
  return r.price ?? r.price_level ?? r.extracted_price ?? undefined;
}

function typeOf(r: any): string | undefined {
  return Array.isArray(r.type) ? r.type[0] : r.type;
}

export function toCandidate(r: any): Candidate {
  return {
    name: r.title,
    id: r.data_id ?? r.place_id,
    address: r.address,
    rating: r.rating,
    reviews: r.reviews,
    price: priceOf(r),
    type: typeOf(r),
    open: r.open_state,
    maps_url: mapsUrl(r),
  };
}

/** Side index: remembers place facts (notably price range) for the reviews header. */
async function rememberPlaces(env: Env, results: any[]): Promise<void> {
  await Promise.all(
    results.flatMap((r) => {
      const v = JSON.stringify({
        name: r.title,
        address: r.address,
        rating: r.rating,
        reviews: r.reviews,
        price: priceOf(r),
        type: typeOf(r),
        place_id: r.place_id,
        data_id: r.data_id,
      });
      return [r.data_id, r.place_id]
        .filter(Boolean)
        .map((id: string) => env.CACHE.put(`place:${id}`, v, { expirationTtl: 30 * DAY }).catch(() => {}));
    }),
  );
}

export async function lookupPlaceFacts(env: Env, id: string): Promise<any | null> {
  try {
    return await env.CACHE.get(`place:${id}`, "json");
  } catch {
    return null;
  }
}

/** Keeps only the fields we use, so KV entries stay small. */
function trim(r: any) {
  return {
    title: r.title,
    place_id: r.place_id,
    data_id: r.data_id,
    data_cid: r.data_cid,
    address: r.address,
    rating: r.rating,
    reviews: r.reviews,
    price: priceOf(r),
    type: typeOf(r),
    open_state: r.open_state,
  };
}

/** Runs a Google Maps search. Returns raw result objects (place_results is wrapped in a 1-item list). */
export async function searchRaw(env: Env, q: string, ll?: string): Promise<{ results: any[]; exact: boolean }> {
  const key = `search:v1:${q.toLowerCase()}|${ll ?? ""}`;
  const { value } = await cached(env, key, DAY, async () => {
    const body = await serp(env, { engine: "google_maps", type: "search", q, ll, hl: "en" });
    if (body.__empty) return { results: [], exact: false };
    if (body.place_results) return { results: [trim(body.place_results)], exact: true };
    return { results: ((body.local_results ?? []) as any[]).map(trim), exact: false };
  });
  await rememberPlaces(env, value.results);
  return value;
}

export async function searchPlaces(env: Env, query: string, near: string | undefined, limit: number) {
  const { ll, suffix } = locationBias(near);
  let q = query.trim();
  if (suffix && !q.toLowerCase().includes(suffix.toLowerCase())) q = `${q} ${suffix}`;
  const { results, exact } = await searchRaw(env, q, ll);
  if (results.length === 0) {
    throw new UserError(
      "place_not_found",
      `No places found for "${q}". Try a different spelling, the Thai name, or add the area (e.g. "Nimman", "Old City").`,
    );
  }
  return {
    query: q,
    exact_match: exact,
    candidates: results.slice(0, limit).map(toCandidate),
  };
}
