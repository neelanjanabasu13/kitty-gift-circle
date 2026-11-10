// Channel3 product search. Server-only: reads CHANNEL3_API_KEY.
import { MARKET } from "./config";
import type { Offer, Product } from "./scoring";

const BASE = "https://api.trychannel3.com/v1";

export type SearchResult = { status: "ok"; products: Product[] } | { status: "not_configured" } | { status: "error"; message: string };

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function mapProduct(raw: any): Product | null {
  if (!raw?.id || !raw?.title) return null;
  const offers: Offer[] = (Array.isArray(raw.offers) ? raw.offers : [])
    .map((o: any): Offer | null => {
      const price = num(o?.price?.price ?? o?.price);
      if (price == null || !o?.url) return null;
      let domain = o.domain as string | undefined;
      if (!domain) {
        try { domain = new URL(o.url).hostname.replace(/^www\./, ""); } catch { domain = "shop"; }
      }
      const avail = String(o.availability ?? "InStock");
      return { url: o.url, domain: domain!, price, compareAt: num(o?.price?.compare_at_price), currency: o?.price?.currency ?? MARKET.currency, inStock: /instock/i.test(avail) };
    })
    .filter(Boolean) as Offer[];
  const img = Array.isArray(raw.images) ? (raw.images[0]?.url ?? raw.images[0] ?? null) : (raw.image_url ?? null);
  const category = Array.isArray(raw.category) ? raw.category.join(" ") : (raw.category ?? null);
  const rating = num(raw.ratings?.rating ?? raw.ratings?.average ?? raw.rating);
  const reviewCount = num(raw.ratings?.count ?? raw.ratings?.review_count ?? raw.review_count) ?? 0;
  return { id: String(raw.id), title: String(raw.title), image: typeof img === "string" ? img : null, category, rating, reviewCount, offers };
}

export async function searchProducts(opts: { query: string; potId: string; minPrice: number; maxPrice: number; limit?: number }): Promise<SearchResult> {
  const key = process.env["CHANNEL3_API_KEY"];
  if (!key) return { status: "not_configured" };
  try {
    const res = await fetch(`${BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "x-user-id": opts.potId },
      body: JSON.stringify({
        query: opts.query,
        limit: opts.limit ?? 10,
        filters: { price: { min_price: Math.floor(opts.minPrice), max_price: Math.ceil(opts.maxPrice) }, availability: ["InStock"] },
        config: { country: MARKET.country, currency: MARKET.currency },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Channel3 search failed [${res.status}]: ${text}`);
      return { status: "error", message: `Shop search failed (${res.status})` };
    }
    const json = JSON.parse(text);
    const list = Array.isArray(json) ? json : (json.products ?? json.results ?? []);
    return { status: "ok", products: list.map(mapProduct).filter(Boolean) as Product[] };
  } catch (e) {
    console.error("Channel3 search error", e);
    return { status: "error", message: "Shop search is unreachable right now" };
  }
}

/** Look up a single product by its shop URL (for the 'I know what to get' mode, later). */
export async function lookupByUrl(url: string): Promise<{ status: "ok"; product: Product | null } | { status: "not_configured" } | { status: "error"; message: string }> {
  const key = process.env["CHANNEL3_API_KEY"];
  if (!key) return { status: "not_configured" };
  try {
    const res = await fetch(`${BASE}/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ url }),
    });
    const text = await res.text();
    if (!res.ok) return { status: "error", message: `Lookup failed (${res.status})` };
    return { status: "ok", product: mapProduct(JSON.parse(text)) };
  } catch {
    return { status: "error", message: "Lookup is unreachable right now" };
  }
}

export type Refresh = { status: "ok"; price: number; inStock: boolean; url: string } | { status: "gone" } | { status: "not_configured" } | { status: "error" };

/**
 * Pre-buy refresh: re-fetch a product by id (falling back to a title search) and return the current
 * offer at the same retailer if possible, otherwise the cheapest in-stock offer.
 */
export async function refreshOffer(o: { productId: string; title: string; retailer: string | null; potId: string; maxPrice: number }): Promise<Refresh> {
  const key = process.env["CHANNEL3_API_KEY"];
  if (!key) return { status: "not_configured" };
  let product: Product | null = null;
  try {
    const res = await fetch(`${BASE}/products/${encodeURIComponent(o.productId)}`, { headers: { "x-api-key": key, "x-user-id": o.potId } });
    if (res.ok) product = mapProduct(await res.json());
  } catch { /* fall through to search */ }
  if (!product) {
    const r = await searchProducts({ query: o.title, potId: o.potId, minPrice: 0, maxPrice: o.maxPrice * 2, limit: 10 });
    if (r.status === "error") return { status: "error" };
    if (r.status === "not_configured") return { status: "not_configured" };
    product = r.products.find((p) => p.id === o.productId) ?? null;
  }
  if (!product) return { status: "gone" };
  const same = product.offers.find((x) => x.domain === o.retailer);
  const best = same && same.inStock ? same : product.offers.filter((x) => x.inStock).sort((a, b) => a.price - b.price)[0] ?? same;
  if (!best) return { status: "gone" };
  return { status: "ok", price: best.price, inStock: best.inStock, url: best.url };
}
