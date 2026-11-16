import { Env, SIX_HOURS, UserError, serp } from "./serpapi";
import { lookupPlaceFacts, mapsUrl } from "./places";
import { PlaceRef } from "./resolve";

export const SORTS = {
  newest: "newestFirst",
  relevant: "qualityScore",
  highest: "ratingHigh",
  lowest: "ratingLow",
} as const;
export type Sort = keyof typeof SORTS;

export interface Review {
  rating?: number;
  when?: string; // relative, as Google shows it
  date?: string; // YYYY-MM-DD
  text?: string;
  translated?: true;
  price_pp?: string;
  mode?: string; // Dine in / Take out / Delivery
  meal?: string;
  scores?: string; // "food 5, service 3, atmosphere 4"
  dishes?: string;
  photos?: number;
  likes?: number;
  owner_replied?: true;
}

interface CacheEntry {
  fetched_at: number;
  place: any;
  reviews: Review[];
  next?: string;
}

const MAX_TEXT = 1200;
const MODE_RE = /^(dine.?in|take.?out|takeaway|delivery|drive.?through|pick.?up)/i;

function pickText(r: any): { text?: string; translated?: true } {
  const ex = r.extracted_snippet;
  if (ex?.translated) return { text: ex.translated, translated: true };
  let t: string | undefined = ex?.original ?? r.snippet;
  if (t && t.includes("(Translated by Google)")) {
    // Older response format: "(Translated by Google) EN... (Original) TH..."
    const en = t.split("(Translated by Google)")[1]?.split("(Original)")[0]?.trim();
    if (en) return { text: en, translated: true };
  }
  return { text: t };
}

export function compactReview(r: any): Review {
  const out: Review = { rating: r.rating, when: r.date };
  if (r.iso_date) out.date = String(r.iso_date).slice(0, 10);
  const { text, translated } = pickText(r);
  if (text) out.text = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}...` : text;
  if (translated) out.translated = true;

  const d = r.details ?? {};
  if (d.price_per_person) out.price_pp = d.price_per_person;
  const mode = d.order_type ?? d.service_type ?? (typeof d.service === "string" && MODE_RE.test(d.service) ? d.service : undefined);
  if (mode) out.mode = mode;
  if (d.meal_type) out.meal = d.meal_type;
  const scores = ["food", "service", "atmosphere"]
    .filter((k) => typeof d[k] === "number")
    .map((k) => `${k} ${d[k]}`);
  if (scores.length) out.scores = scores.join(", ");
  if (d.recommended_dishes) out.dishes = d.recommended_dishes;

  const n = Array.isArray(r.images) ? r.images.length : 0;
  if (n) out.photos = n;
  if (r.likes) out.likes = r.likes;
  if (r.response) out.owner_replied = true;
  return out;
}

async function fetchPage(env: Env, ref: PlaceRef, sort: Sort, token?: string) {
  const body = await serp(env, {
    engine: "google_maps_reviews",
    data_id: ref.data_id,
    place_id: ref.data_id ? undefined : ref.place_id,
    hl: "en",
    sort_by: SORTS[sort],
    next_page_token: token,
    num: token ? 20 : undefined, // SerpApi rejects `num` on the first page (it returns 8 there)
  });
  if (body.__empty) return { place: null, reviews: [] as any[], next: undefined };
  return {
    place: body.place_info ?? null,
    reviews: (body.reviews ?? []) as any[],
    next: body.serpapi_pagination?.next_page_token as string | undefined,
  };
}

/** Returns up to `max` reviews, reusing and extending the KV cache instead of refetching. */
export async function getReviews(env: Env, ref: PlaceRef, sort: Sort, max: number) {
  const id = (ref.data_id ?? ref.place_id)!;
  const key = `rev:v1:${id}:${sort}`;
  let entry: CacheEntry | null = null;
  try {
    entry = await env.CACHE.get<CacheEntry>(key, "json");
  } catch {
    /* ignore */
  }
  const fromCache = !!entry && (entry.reviews.length >= max || !entry.next);
  let pages = 0;

  if (!entry) {
    const first = await fetchPage(env, ref, sort);
    pages++;
    entry = {
      fetched_at: Date.now(),
      place: first.place,
      reviews: first.reviews.map(compactReview),
      next: first.next,
    };
    if (!first.place && first.reviews.length === 0) {
      throw new UserError(
        "place_not_found",
        `Google returned nothing for place "${id}". The id may be wrong; use search_places to get a fresh one.`,
      );
    }
  }
  while (entry.reviews.length < max && entry.next && pages < 8) {
    const page = await fetchPage(env, ref, sort, entry.next);
    pages++;
    entry.reviews.push(...page.reviews.map(compactReview));
    entry.next = page.reviews.length ? page.next : undefined;
  }
  if (pages > 0) {
    const ttl = Math.max(60, SIX_HOURS - Math.floor((Date.now() - entry.fetched_at) / 1000));
    try {
      await env.CACHE.put(key, JSON.stringify(entry), { expirationTtl: ttl });
    } catch {
      /* ignore */
    }
  }

  const facts = (await lookupPlaceFacts(env, id)) ?? {};
  const pi = entry.place ?? {};
  const reviews = entry.reviews.slice(0, max);

  const priceCounts: Record<string, number> = {};
  for (const r of entry.reviews) if (r.price_pp) priceCounts[r.price_pp] = (priceCounts[r.price_pp] ?? 0) + 1;

  return {
    place: {
      name: pi.title ?? facts.name,
      address: pi.address ?? facts.address,
      type: pi.type ?? facts.type,
      rating: pi.rating ?? facts.rating,
      total_reviews: pi.reviews ?? facts.reviews,
      price_range: facts.price,
      price_per_person_in_reviews: Object.keys(priceCounts).length ? priceCounts : undefined,
      maps_url: mapsUrl({ data_id: ref.data_id ?? facts.data_id, place_id: ref.place_id ?? facts.place_id, title: pi.title }),
      id,
    },
    sort,
    returned: reviews.length,
    more_available: reviews.length < entry.reviews.length || !!entry.next,
    cached: fromCache,
    reviews,
  };
}
