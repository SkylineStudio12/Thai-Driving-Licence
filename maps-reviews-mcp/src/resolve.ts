import { Env, UserError } from "./serpapi";
import { searchRaw, toCandidate } from "./places";

export interface PlaceRef {
  data_id?: string;
  place_id?: string;
}

const DATA_ID = /(0x[0-9a-f]+:0x[0-9a-f]+)/i;
const SHORT_HOSTS = /(^|\.)(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google)$/i;

export interface ParsedUrl extends PlaceRef {
  name?: string;
  lat?: number;
  lng?: number;
}

/** Pulls whatever identifies a place out of a full Google Maps URL. */
export function parseMapsUrl(raw: string): ParsedUrl {
  const out: ParsedUrl = {};
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return out;
  }
  const decoded = decodeURIComponent(url.href);

  const d = decoded.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i) ?? url.searchParams.get("ftid")?.match(DATA_ID);
  if (d) out.data_id = d[1].toLowerCase();

  const pid =
    url.searchParams.get("query_place_id") ??
    decoded.match(/place_id[:=]([A-Za-z0-9_-]{20,})/)?.[1] ??
    decoded.match(/!19s(ChIJ[A-Za-z0-9_-]+)/)?.[1];
  if (pid) out.place_id = pid;

  const cid = url.searchParams.get("cid") ?? decoded.match(/[?&]cid=(\d+)/)?.[1];
  if (!out.data_id && cid && /^\d+$/.test(cid)) {
    out.data_id = `0x0:0x${BigInt(cid).toString(16)}`;
  }

  const name = url.pathname.match(/\/maps\/place\/([^/]+)/)?.[1];
  if (name) out.name = decodeURIComponent(name.replace(/\+/g, " "));
  else {
    const q = url.searchParams.get("q") ?? url.searchParams.get("query");
    if (q && !/^place_id:/.test(q) && !/^-?\d+\.\d+,-?\d+\.\d+$/.test(q)) out.name = q;
  }

  const at = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) {
    out.lat = Number(at[1]);
    out.lng = Number(at[2]);
  }
  return out;
}

/** Follows a share link (maps.app.goo.gl etc.) to the full Google Maps URL. */
export async function expandShortUrl(raw: string): Promise<string> {
  let current = raw;
  for (let hop = 0; hop < 6; hop++) {
    const host = new URL(current).hostname;
    const isGoogleMaps = /google\.[a-z.]+$/i.test(host) && /\/maps|[?&](cid|q)=/.test(current);
    if (isGoogleMaps && !/consent\./.test(host)) return current;

    if (/consent\./.test(host)) {
      const cont = new URL(current).searchParams.get("continue");
      if (cont) {
        current = cont;
        continue;
      }
    }
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; maps-reviews-mcp)" },
    });
    const loc = res.headers.get("location");
    if (loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    // Some share pages answer 200 with the target embedded in the HTML.
    const html = await res.text();
    const m = html.match(/https:\/\/(?:www\.)?google\.[a-z.]+\/maps[^"'\s<>]+/i);
    if (m) return m[0].replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
    break;
  }
  throw new UserError("bad_url", `Could not expand the short link ${raw}. Paste the full Google Maps URL or use search_places.`);
}

/**
 * Resolves a place identifier or Google Maps URL to something the reviews engine accepts.
 * Throws UserError("ambiguous") with candidates when only a name could be extracted.
 */
export async function resolvePlace(env: Env, input: string): Promise<PlaceRef> {
  const s = input.trim();
  const bare = s.match(new RegExp(`^${DATA_ID.source}$`, "i"));
  if (bare) return { data_id: bare[1].toLowerCase() };
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return { place_id: s };

  if (!/^https?:\/\//i.test(s)) {
    throw new UserError(
      "bad_input",
      `"${s}" is neither a place id nor a Google Maps URL. Call search_places first and pass the candidate's id.`,
    );
  }

  let url = s;
  if (SHORT_HOSTS.test(new URL(url).hostname)) url = await expandShortUrl(url);

  const p = parseMapsUrl(url);
  if (p.data_id || p.place_id) return { data_id: p.data_id, place_id: p.place_id };

  if (p.name) {
    const ll = p.lat !== undefined ? `@${p.lat},${p.lng},17z` : undefined;
    const { results, exact } = await searchRaw(env, p.name, ll);
    if (results.length === 0) {
      throw new UserError("place_not_found", `The URL points to "${p.name}" but Google Maps found no such place.`);
    }
    const norm = (x?: string) => (x ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const same = results.filter((r) => norm(r.title) === norm(p.name));
    if (exact || results.length === 1 || same.length === 1) {
      const r = exact || results.length === 1 ? results[0] : same[0];
      return { data_id: r.data_id, place_id: r.place_id };
    }
    throw new UserError(
      "ambiguous",
      `The URL only names "${p.name}" and several places match. Pick one and call get_reviews with its id.`,
      results.slice(0, 6).map(toCandidate),
    );
  }
  throw new UserError("bad_url", "Could not find a place in that URL. Use search_places instead.");
}
