// Pure, deterministic money and ranking rules. AI only supplies fit, reason and category.
import { SEARCH_BANDS } from "./config";

export type Offer = { url: string; domain: string; price: number; compareAt: number | null; currency: string; inStock: boolean };
export type Product = { id: string; title: string; image: string | null; category: string | null; rating: number | null; reviewCount: number; offers: Offer[] };

export type Signals = {
  rating: number | null;
  reviewCount: number;
  offerCount: number;
  inStock: boolean;
  priceConsistent: boolean;
  wishlistMatch: number;
};

export type Scored = {
  id: string;
  price: number;
  category: string;
  fit: number;
  signals: Signals;
};

export const WEIGHTS = { fit: 0.35, vote: 0.2, potFit: 0.2, wishlist: 0.1, quality: 0.1, reliability: 0.05 };
export const MIN_FIT = 0.4;

export function bandFor(amount: number) {
  let b = 0;
  for (const x of SEARCH_BANDS) if (amount >= x) b = x;
  return b;
}

/** 1.0 when price is 80 to 100% of the authorised pot, linear fall-off below, 0 above the pot. */
export function potFit(price: number, pot: number) {
  if (pot <= 0 || price > pot) return 0;
  const r = price / pot;
  if (r >= 0.8) return 1;
  return Math.max(0, r / 0.8);
}

/** Rating damped toward neutral when there are few reviews. */
export function quality(rating: number | null, reviewCount: number) {
  if (rating == null) return 0.5;
  const k = 20;
  const w = reviewCount / (reviewCount + k);
  return Math.min(1, Math.max(0, (rating / 5) * w + 0.5 * (1 - w)));
}

export function reliability(s: Pick<Signals, "inStock" | "offerCount" | "priceConsistent">) {
  return (s.inStock ? 0.4 : 0) + (s.offerCount > 1 ? 0.3 : 0) + (s.priceConsistent ? 0.3 : 0);
}

/** Share of votes for a category, capped at the fit so votes can't lift a poor match. */
export function voteScore(category: string, tally: Record<string, number>, fit: number) {
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return Math.min((tally[category] ?? 0) / total, fit);
}

export function totalScore(c: Scored, pot: number, tally: Record<string, number>) {
  const s = c.signals;
  return (
    WEIGHTS.fit * c.fit +
    WEIGHTS.vote * voteScore(c.category, tally, c.fit) +
    WEIGHTS.potFit * potFit(c.price, pot) +
    WEIGHTS.wishlist * s.wishlistMatch +
    WEIGHTS.quality * quality(s.rating, s.reviewCount) +
    WEIGHTS.reliability * reliability(s)
  );
}

export function isUnanimous(tally: Record<string, number>) {
  const used = Object.entries(tally).filter(([, v]) => v > 0);
  return used.length === 1;
}

export function topCategories(tally: Record<string, number>, n = 2) {
  return Object.entries(tally).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k);
}

/** Categories that read as the same kind of gift on screen (a mug and a baking dish are both tableware). */
const FAMILY: Record<string, string> = { cooking: "kitchen", ceramics: "kitchen", coffee: "kitchen", tea: "kitchen", baking: "kitchen", kitchen: "kitchen", tableware: "kitchen" };
export function giftFamily(category: string | null | undefined) {
  const c = (category ?? "other").toLowerCase();
  return FAMILY[c] ?? c;
}

/**
 * Hard rules first (above pot dropped, fit < MIN_FIT never shown), then weighted ranking.
 * The top 3 are three different kinds of gift whenever the results allow it, unless votes are unanimous.
 */
export function rank(cands: Scored[], pot: number, tally: Record<string, number>) {
  const eligible = cands.filter((c) => c.price <= pot && c.fit >= MIN_FIT);
  const sorted = eligible.map((c) => ({ ...c, total: totalScore(c, pot, tally) })).sort((a, b) => b.total - a.total || a.price - b.price);
  if (sorted.length >= 3 && !isUnanimous(tally)) {
    const top: typeof sorted = [];
    const seen = new Set<string>();
    for (const c of sorted) {
      if (top.length === 3) break;
      if (!seen.has(giftFamily(c.category))) { top.push(c); seen.add(giftFamily(c.category)); }
    }
    for (const c of sorted) { if (top.length === 3) break; if (!top.includes(c)) top.push(c); }
    const rest = sorted.filter((c) => !top.includes(c));
    return [...top, ...rest].map((c, i) => ({ ...c, rank: i + 1 }));
  }
  return sorted.map((c, i) => ({ ...c, rank: i + 1 }));
}

// ---------- cleaning ----------

export function matchesDislike(text: string, dislikes: string[]) {
  const t = text.toLowerCase();
  return dislikes.find((d) => {
    const w = d.toLowerCase().trim().replace(/\s+stuff$/, "");
    if (!w) return false;
    const stem = w.length > 4 ? w.replace(/(ed|s)$/, "") : w;
    return t.includes(stem);
  });
}

/** An offer far below the product's other offers or its compare-at price is likely bogus. */
export function isSuspiciousOffer(o: Offer, all: Offer[]) {
  const others = all.filter((x) => x !== o).map((x) => x.price);
  const ref = others.length ? Math.max(...others) : null;
  if (ref != null && o.price < ref * 0.4) return true;
  if (o.compareAt != null && o.price < o.compareAt * 0.4) return true;
  return false;
}

export type CleanResult = {
  kept: { product: Product; offer: Offer }[];
  dropped: { dislike: number; dislikeWord: string | null; abovePot: number; suspicious: number; duplicate: number };
};

const FOREIGN_TLD = /\.(ie|de|fr|ch|au|nl|es|it|ca|at|be|se|dk|no|pl|nz|jp|us)$/;
const FOREIGN_SUB = /^(de|fr|ch|au|nl|es|it|ca|at|be|se|dk|us|eu|ie|nz|jp)\./;
/** True when an offer's shop is clearly another country's storefront (seen live: de.peugeot-saveurs.com, next.ie). */
export function isForeignShop(domain: string, country: "GB" | "US"): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (country === "GB") return FOREIGN_TLD.test(d) || FOREIGN_SUB.test(d) || /\.com\.au$/.test(d);
  return /\.(co\.uk|uk|ie|de|fr|ch|au|nl|es|it|ca)$/.test(d) || /^(uk|de|fr|ch|au|nl|es|it|ca|eu)\./.test(d);
}
const titleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function cleanProducts(products: Product[], dislikes: string[], pot: number, market?: { country: "GB" | "US"; currency: string }): CleanResult {
  const seen = new Set<string>();
  const dropped: CleanResult["dropped"] = { dislike: 0, dislikeWord: null, abovePot: 0, suspicious: 0, duplicate: 0 };
  const kept: CleanResult["kept"] = [];
  for (const p of products) {
    const tk = `t:${titleKey(p.title)}`;
    if (seen.has(p.id) || seen.has(tk)) { dropped.duplicate++; continue; }
    seen.add(p.id); seen.add(tk);
    const hit = matchesDislike(`${p.title} ${p.category ?? ""}`, dislikes);
    if (hit) { dropped.dislike++; dropped.dislikeWord ??= hit; continue; }
    // Only offers in the pot's currency from shops in the pot's country can be compared with the pot.
    const local = market ? p.offers.filter((o) => o.currency === market.currency && !isForeignShop(o.domain, market.country)) : p.offers;
    if (!local.length) { dropped.abovePot++; continue; }
    const valid = local.filter((o) => o.price > 0 && !isSuspiciousOffer(o, local));
    if (valid.length < p.offers.length && valid.length === 0) { dropped.suspicious++; continue; }
    const affordable = valid.filter((o) => o.price <= pot);
    if (!affordable.length) { dropped.abovePot++; continue; }
    const best = affordable.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price)[0]!;
    kept.push({ product: p, offer: best });
  }
  return { kept, dropped };
}

export function signalsFor(p: Product, offer: Offer, wishlistText: string): Signals {
  const prices = p.offers.map((o) => o.price).filter((x) => x > 0);
  const consistent = prices.length < 2 || Math.max(...prices) / Math.min(...prices) <= 1.25;
  return {
    rating: p.rating,
    reviewCount: p.reviewCount,
    offerCount: new Set(p.offers.map((o) => o.domain)).size,
    inStock: offer.inStock,
    priceConsistent: consistent,
    wishlistMatch: wishlistMatch(p.title, wishlistText),
  };
}

export function wishlistMatch(title: string, wishlistText: string) {
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const w = words(wishlistText);
  if (!w.size) return 0;
  const t = words(title);
  let hit = 0;
  for (const x of t) if (w.has(x)) hit++;
  return Math.min(1, hit / 2);
}

/** Cheapest decent candidate priced above the pot: the gift that comes into reach next. */
export function nextUnlock<T extends { price: number | null; fit_score: number | null }>(cands: T[], pot: number) {
  return cands
    .filter((c) => c.price != null && c.price > pot && (c.fit_score ?? 0) >= 0.5)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0] ?? null;
}

// ---------- fast path: deterministic plan and provisional picks ----------

/** Shop queries built from likes and voted categories by template; null means too little to go on (use the AI planner). */
export function templateQueries(likes: string[], topVoted: string[]): string[] | null {
  const ls = likes.map((l) => l.trim().toLowerCase()).filter(Boolean);
  if (ls.length < 2) return null;
  const seeds = Array.from(new Set([...topVoted.map((v) => v.toLowerCase()), ...ls]));
  const out: string[] = [];
  for (const s of seeds) { out.push(`${s} gift`); if (out.length < 6) out.push(`${s} set`); if (out.length >= 6) break; }
  return Array.from(new Set(out)).slice(0, 6);
}

/** Cheap guess at a product's gift category: the first category or like named in its title or shop category. */
export function guessCategory(title: string, shopCategory: string | null, categories: string[]): string {
  const text = `${title} ${shopCategory ?? ""}`.toLowerCase();
  return categories.find((c) => text.includes(c.toLowerCase())) ?? (giftFamily(shopCategory) === "kitchen" ? "cooking" : "home");
}

/** Provisional fit before AI scoring: a like named in the title lifts it; quality nudges it. Always within 0.45..0.85. */
export function provisionalFit(title: string, shopCategory: string | null, likes: string[], rating: number | null, reviewCount: number): number {
  const text = `${title} ${shopCategory ?? ""}`.toLowerCase();
  const match = likes.some((l) => l && text.includes(l.toLowerCase()));
  return Math.round((0.45 + (match ? 0.3 : 0) + 0.1 * quality(rating, reviewCount)) * 1000) / 1000;
}

/** The best `n` for AI scoring, interleaved across gift families so variety survives the cut. */
export function preselect<T extends { fit: number; category: string }>(items: T[], n = 15): T[] {
  const byFam = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => b.fit - a.fit)) {
    const f = giftFamily(it.category);
    byFam.set(f, [...(byFam.get(f) ?? []), it]);
  }
  const out: T[] = [];
  const lists = Array.from(byFam.values());
  for (let i = 0; out.length < n && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.length < n) out.push(l[i]!);
  return out;
}

// ---------- seeded first ideas at the target budget ----------

/** Popular gift kinds used to fill the first ideas when the organiser gave fewer than three likes. */
export const POPULAR_GIFT_KINDS = ["cooking", "plants", "wellbeing", "books", "experiences", "tech"];

/**
 * One gift kind per first idea: up to three of the likes, topped up with popular kinds from different families.
 * 3 likes: one each. 2 likes: both plus one popular. 1 like: it plus two popular. None: three popular.
 */
export function seedKinds(likes: string[]): string[] {
  const out: string[] = [];
  const fams = new Set<string>();
  for (const l of likes.map((x) => x.trim().toLowerCase()).filter(Boolean)) {
    if (out.length === 3) break;
    if (!fams.has(giftFamily(l))) { out.push(l); fams.add(giftFamily(l)); }
  }
  for (const p of POPULAR_GIFT_KINDS) {
    if (out.length === 3) break;
    if (!fams.has(giftFamily(p))) { out.push(p); fams.add(giftFamily(p)); }
  }
  return out;
}
