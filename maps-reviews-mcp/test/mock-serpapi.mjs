// Local stand-in for SerpApi, used by test/smoke.sh. Shapes copied from real responses.
import http from "node:http";
let calls = 0;
const review = (i, extra = {}) => ({
  position: i, link: "https://www.google.com/maps/reviews/x", rating: (i % 5) + 1,
  date: `${i} days ago`, iso_date: "2026-11-10T08:00:00Z", source: "Google", review_id: `r${i}`,
  user: { name: "U", link: "https://x", thumbnail: "https://lh3/x", reviews: 3, photos: 1 },
  snippet: `Review ${i}`, extracted_snippet: { original: `Review ${i}` }, likes: 0, ...extra,
});
http.createServer((req, res) => {
  calls++;
  const u = new URL(req.url, "http://x");
  const p = Object.fromEntries(u.searchParams);
  console.error("SERPAPI", JSON.stringify({ ...p, api_key: undefined }));
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (p.q === "quota test Chiang Mai") return send(429, { error: "Your account has run out of searches." });
  if (p.engine === "google_maps") {
    if (p.q?.startsWith("nothing")) return send(200, { error: "Google hasn't returned any results for this query." });
    if (p.q?.startsWith("Single Place")) return send(200, { place_results: { title: "Single Place", place_id: "ChIJsingle000000000000000", data_id: "0x30da3a7e5f5c1a5b:0x1111111111111111", address: "Nimman Rd", rating: 4.2, reviews: 99, price: "฿100–200", type: ["Cafe"] } });
    return send(200, { local_results: [
      { position: 1, title: "Khao Soi Mae Sai", place_id: "ChIJAAAAAAAAAAAAAAAAAAAAAAA", data_id: "0x30da3a7e5f5c1a5b:0xabcdef1234567890", data_cid: "12379813738877118608", address: "29/1 Ratchaphuek Alley, Chiang Mai", rating: 4.5, reviews: 3210, price: "฿1–100", type: "Thai restaurant", types: ["Thai restaurant"], open_state: "Open ⋅ Closes 4 PM", thumbnail: "https://lh5/x", gps_coordinates: { latitude: 18.8, longitude: 98.97 } },
      { position: 2, title: "Khao Soi Mae Sai 2", place_id: "ChIJBBBBBBBBBBBBBBBBBBBBBBB", data_id: "0x30da3a7e5f5c1a5b:0x0000000000000002", address: "Somewhere", rating: 4.0, reviews: 50, type: "Restaurant" },
    ]});
  }
  if (p.engine === "google_maps_reviews") {
    if (p.data_id === "0x1:0x1") return send(200, { error: "Google hasn't returned any results for this query." });
    if (!p.next_page_token) {
      if (p.num) return send(400, { error: "num can't be used on the initial page" });
      return send(200, {
        place_info: { title: "Khao Soi Mae Sai", address: "29/1 Ratchaphuek Alley", rating: 4.5, reviews: 3210, type: "Thai restaurant" },
        reviews: [
          review(1, { extracted_snippet: { original: "อร่อยมาก ราคาไม่แพง", translated: "Very tasty, not expensive" }, details: { order_type: "Dine in", meal_type: "Lunch", price_per_person: "฿1–200", food: 5, service: 4, atmosphere: 3, recommended_dishes: "Khao soi gai" }, images: ["https://a", "https://b"], response: { date: "1 day ago", snippet: "thanks" } }),
          review(2, { extracted_snippet: undefined, snippet: "(Translated by Google) Too salty\n\n(Original)\nเค็มไป", details: { service: "Take out", price_per_person: "฿1–200" } }),
          ...Array.from({ length: 6 }, (_, k) => review(k + 3)),
        ],
        serpapi_pagination: { next_page_token: "PAGE2" },
      });
    }
    const n = Number(p.num ?? 10);
    const start = p.next_page_token === "PAGE2" ? 9 : 29;
    return send(200, { reviews: Array.from({ length: n }, (_, k) => review(start + k)), serpapi_pagination: p.next_page_token === "PAGE2" ? { next_page_token: "PAGE3" } : {} });
  }
  send(400, { error: "unknown engine" });
}).listen(8799, () => console.error("mock serpapi on 8799"));
