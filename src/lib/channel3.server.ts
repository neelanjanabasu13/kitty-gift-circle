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
  const imgs = Array.isArray(raw.images) ? raw.images : [];
  const main = imgs.find((i: any) => i?.is_main_image) ?? imgs[0];
  const img = main?.url ?? null;
  // Real shape (checked against the live API): category is { slug, title, path[] }, ratings is { value, count }.
  const category = typeof raw.category === "string" ? raw.category : (raw.category?.title ?? null);
  const rating = num(raw.ratings?.value);
  const reviewCount = num(raw.ratings?.count) ?? 0;
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

/** Look up a single product by its shop URL via POST /v1/lookup, which returns { product }. */
export async function lookupByUrl(url: string): Promise<{ status: "ok"; product: Product | null } | { status: "not_configured" } | { status: "error"; message: string }> {
  const key = process.env["CHANNEL3_API_KEY"];
  if (!key) return { status: "not_configured" };
  try {
    const res = await fetch(`${BASE}/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ url, realtime_fetch: true }),
    });
    const text = await res.text();
    if (res.status === 404) return { status: "ok", product: null };
    if (!res.ok) return { status: "error", message: `Lookup failed (${res.status})` };
    const json = JSON.parse(text);
    return { status: "ok", product: mapProduct(json.product ?? json) };
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
    const res = await fetch(`${BASE}/products/${encodeURIComponent(o.productId)}?country=${MARKET.country}&currency=${MARKET.currency}`, { headers: { "x-api-key": key, "x-user-id": o.potId } });
    if (res.ok) product = mapProduct(await res.json());
  } catch { /* fall through to search */ }
  if (!product) {
    const r = await searchProducts({ query: o.title, potId: o.potId, minPrice: 0, maxPrice: o.maxPrice * 2, limit: 10 });
    if (r.status === "error") return { status: "error" };
    if (r.status === "not_configured") return { status: "not_configured" };
    product = r.products.find((p) => p.id === o.productId) ?? null;
  }
  if (!product) return { status: "gone" };
  const offers = product.offers.filter((x) => x.currency === MARKET.currency);
  const same = offers.find((x) => x.domain === o.retailer);
  const best = same && same.inStock ? same : offers.filter((x) => x.inStock).sort((a, b) => a.price - b.price)[0] ?? same;
  if (!best) return { status: "gone" };
  return { status: "ok", price: best.price, inStock: best.inStock, url: best.url };
}
