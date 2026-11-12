// Kitty's agent run: plan, search, clean, score, rank, store. Narrates every step to agent_events.
import { BASE_CATEGORIES, MARKET, SEARCH_BANDS } from "./config";
import { formatMoney } from "./kitty";
import { bandFor, cleanProducts, seedKinds, guessCategory, preselect, provisionalFit, rank, signalsFor, templateQueries, topCategories, type Scored, type Signals } from "./scoring";

export type Trigger = { kind: "authorized" | "withdrawn" | "vote" | "replan" | "manual" | "seed"; who?: string | null };

const LIVE = ["authorized", "reauthorized", "captured"];
const LOCK_MS = 120_000;

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function say(potId: string, kind: string, message: string, payload: Record<string, unknown> = {}) {
  const db = await admin();
  const { data } = await db.from("agent_events").insert({ pot_id: potId, kind, message, payload: payload as any }).select("id").maybeSingle();
  return data?.id as string | undefined;
}
async function working(potId: string, text: string | null) {
  const db = await admin();
  await db.from("pots").update({ agent_working: text }).eq("id", potId);
}

async function acquire(potId: string) {
  const db = await admin();
  const stale = new Date(Date.now() - LOCK_MS).toISOString();
  const { data } = await db
    .from("pots")
    .update({ agent_lock_at: new Date().toISOString(), agent_pending: false })
    .eq("id", potId)
    .or(`agent_lock_at.is.null,agent_lock_at.lt.${stale}`)
    .select("id");
  if (data && data.length) return true;
  await db.from("pots").update({ agent_pending: true }).eq("id", potId);
  return false;
}
async function release(potId: string) {
  const db = await admin();
  const { data } = await db.from("pots").update({ agent_lock_at: null, agent_working: null }).eq("id", potId).select("agent_pending").single();
  return !!data?.agent_pending;
}

export async function runAgent(potId: string, trigger: Trigger) {
  if (!(await acquire(potId))) return { status: "queued" as const };
  try {
    await runOnce(potId, trigger);
  } catch (e) {
    console.error("agent run failed", e);
    await say(potId, "agent_error", "I hit a snag picking gifts. I'll try again in a moment.");
  }
  // One follow-up pass if triggers arrived while we were busy.
  if (await release(potId)) {
    if (await acquire(potId)) {
      try { await runOnce(potId, { kind: "vote" }); } catch (e) { console.error(e); }
      await release(potId);
    }
  }
  return { status: "done" as const };
}

async function runOnce(potId: string, trigger: Trigger) {
  const db = await admin();
  const { data: pot } = await db.from("pots").select("*").eq("id", potId).single();
  if (!pot || pot.status !== "collecting") return;
  // Shortlist locks at the deadline: no more re-ranks or searches until the closer's single final search.
  const { effectiveDeadline } = await import("./closing");
  if (effectiveDeadline(new Date(pot.created_at), new Date(pot.deadline_at), pot).getTime() <= Date.now()) return;
  // Fixed split: the organiser already chose the gift, so there's nothing to search or rank.
  if (pot.mode === "fixed_split") return;

  const { data: live } = await db.from("contributions").select("id, amount").eq("pot_id", potId).in("status", LIVE);
  const raised = (live ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const liveIds = new Set((live ?? []).map((c) => c.id));
  const { data: votes } = await db.from("category_votes").select("category, contribution_id").eq("pot_id", potId);
  const tally: Record<string, number> = {};
  for (const v of votes ?? []) if (v.contribution_id && liveIds.has(v.contribution_id)) tally[v.category] = (tally[v.category] ?? 0) + 1;
  const top2 = topCategories(tally);
  tallyFor.set(potId, tally);
  const cur = pot.currency;
  const money = (n: number) => formatMoney(n, cur);

  const band = bandFor(raised);
  const lastBand = Number(pot.last_search_band ?? 0);
  const { count: cached } = await db.from("candidates").select("id", { count: "exact", head: true }).eq("pot_id", potId);
  const top2Changed = top2.some((c) => !(pot.last_top_categories ?? []).includes(c));

  let reason: string | null = null;
  if (trigger.kind === "replan" || trigger.kind === "manual") reason = "replan";
  else if (band > lastBand) reason = lastBand > 0 ? "band" : "first";
  else if (top2Changed && top2.length) reason = "votes";
  else if (!cached && band > 0) reason = "first";

  // Before the first price band, Kitty shows first ideas at the organiser's target budget instead of an empty shelf.
  if (band === 0) {
    const target = Number(pot.target_amount ?? 0);
    if (!pot.is_demo && target > 0 && (!cached || trigger.kind === "replan" || trigger.kind === "manual")) await seedSearch(potId, pot, target);
    await rerank(potId, target || raised, tally, trigger, cur, true);
    return;
  }

  if (reason) {
    if (reason === "band" && band > lastBand) await say(potId, "band_crossed", `We've passed ${money(band)}, so I'm looking for bigger gifts.`);
    if (reason === "votes") await say(potId, "votes_shift", `Everyone's leaning towards ${top2.join(" and ")}, so I'm having another look.`);
    const ok = await search(potId, pot, raised, top2, reason === "replan" || reason === "first");
    if (ok) await db.from("pots").update({ last_search_band: band, last_top_categories: top2 }).eq("id", potId);
  }

  await rerank(potId, raised, tally, trigger, cur);
}

/** First ideas at the target budget: one gift kind each (likes first, then popular kinds), no AI wait. */
async function seedSearch(potId: string, pot: any, target: number) {
  const db = await admin();
  if (!process.env["CHANNEL3_API_KEY"]) return false;
  const { searchProducts } = await import("./channel3.server");
  const kinds = seedKinds(pot.likes ?? []);
  const money = (n: number) => formatMoney(n, pot.currency);
  await working(potId, `Finding first ideas for ${pot.recipient_name} around ${money(target)}`);
  const t0 = Date.now();
  const queries = kinds.flatMap((k) => [{ k, q: `${k} gift` }, { k, q: `${k} gift set` }]);
  const results = await Promise.all(queries.map(({ q }) => searchProducts({ query: q, potId, minPrice: target * 0.4, maxPrice: target, limit: 10 })));
  const kindOf = new Map<string, string>();
  results.forEach((r, i) => { if (r.status === "ok") for (const p of r.products) if (!kindOf.has(p.id)) kindOf.set(p.id, queries[i]!.k); });
  const products = results.flatMap((r) => (r.status === "ok" ? r.products : []));
  if (!products.length) { await working(potId, null); return false; }
  const { kept } = cleanProducts(products, pot.dislikes ?? [], target, { country: MARKET.country, currency: pot.currency ?? MARKET.currency });
  const likes: string[] = (pot.likes ?? []).map((l: string) => l.toLowerCase());
  const wishText = `${pot.wishlist_url ?? ""}`.replace(/[-_/]/g, " ");
  const seen = new Set<string>();
  const rows = kept.filter(({ product }) => !seen.has(product.id) && seen.add(product.id)).map(({ product, offer }) => {
    const kind = kindOf.get(product.id) ?? "home";
    const theirs = likes.includes(kind);
    return {
      pot_id: potId,
      channel3_product_id: product.id,
      title: product.title.slice(0, 200),
      image_url: product.image,
      offer_url: offer.url,
      retailer: offer.domain,
      price: offer.price,
      currency: offer.currency,
      category: kind,
      fit_score: Math.max(0.5, provisionalFit(product.title, product.category, likes.length ? likes : [kind], product.rating, product.reviewCount)),
      reason: theirs ? `A first idea for ${pot.recipient_name}'s love of ${kind}, within the ${money(target)} target.` : `A popular ${kind} gift while I learn more about ${pot.recipient_name}.`,
      band: "seed",
      signals: signalsFor(product, offer, wishText) as any,
      fetched_at: new Date().toISOString(),
    };
  });
  await db.from("candidates").delete().eq("pot_id", potId);
  if (rows.length) await db.from("candidates").insert(rows);
  await say(potId, "seeded", `Here are some first ideas around ${money(target)}. They'll change as people chip in and tell me what ${pot.recipient_name} likes.`, { kinds, found: rows.length, timings: { total: Date.now() - t0 } });
  await working(potId, null);
  return true;
}

/** Timings from the latest live search per pot, attached to the next "reranked" event. */
const tallyFor = new Map<string, Record<string, number>>();
const planCache = new Map<string, string[]>();
const lastTimings = new Map<string, Record<string, number>>();

async function search(potId: string, pot: any, raised: number, top2: string[], replaceAll: boolean) {
  const db = await admin();
  const { searchProducts } = await import("./channel3.server");
  const { planQueries, scoreCandidates } = await import("./ai.server");
  if (!process.env["CHANNEL3_API_KEY"]) {
    const { data: last } = await db.from("agent_events").select("kind").eq("pot_id", potId).order("at", { ascending: false }).limit(1);
    if (last?.[0]?.kind !== "search_unconfigured") await say(potId, "search_unconfigured", "I can start looking in shops as soon as the shop key is added.");
    return false;
  }
  // Demo pots reuse real Channel3 results Kitty already found for an earlier demo pot, so the story never waits on live shops.
  if (pot.is_demo && (await reuseDemoPicks(potId, pot, raised, replaceAll))) return true;
  const money = (n: number) => formatMoney(n, pot.currency);
  const profile = {
    name: pot.recipient_name, occasion: pot.occasion, closeness: pot.closeness, likes: pot.likes ?? [], dislikes: pot.dislikes ?? [],
    wishlist: pot.wishlist_url, topVoted: top2, pot: raised, currency: pot.currency,
  };

  const t0 = Date.now();
  await working(potId, `Thinking about ${(profile.likes.slice(0, 2).join(" and ") || "what they love")}`);
  // Plans come from a template when there are 2+ likes (no AI wait), else the AI planner; cached per pot and profile.
  const planKey = `${potId}|${JSON.stringify([profile.likes, profile.dislikes, top2, profile.occasion])}`;
  let queries: string[] = planCache.get(planKey) ?? templateQueries(profile.likes, top2) ?? [];
  if (!queries.length) {
    try {
      queries = await planQueries(profile);
    } catch (e) {
      console.error(e);
      queries = [...profile.likes, ...top2].slice(0, 4).map((l: string) => `${l} gift`);
    }
  }
  planCache.set(planKey, queries);
  const tPlan = Date.now() - t0;
  if (!queries.length) queries = ["thoughtful gift"];
  // Always look beyond the likes' own kind of gift, so the shortlist can show three different kinds.
  const { giftFamily } = await import("./scoring");
  const likeFamilies = new Set(profile.likes.map((l: string) => giftFamily(l)));
  const wider = ["wellbeing gift set", "experience day gift", "book lover gift", "indoor plant gift"].filter((q) => !likeFamilies.has(giftFamily(q.split(" ")[0])));
  queries = [...queries.slice(0, 4), ...wider.slice(0, 2)];
  await say(potId, "planned", `I've got ${queries.length} ideas to try, based on ${(profile.likes.slice(0, 2).join(" and ") || "what I know")}.`, { queries });

  const topic = profile.likes[0] ?? top2[0] ?? "thoughtful";
  await working(potId, `Looking through shops for ${topic} gifts under ${money(raised)}`);
  // Search a little above the pot too, so a "next unlock" gift exists; ranking still only shows what the pot covers.
  const stretch = Math.round(Math.max(raised * 1.3, SEARCH_BANDS.find((b) => b > raised) ?? raised * 1.3));
  const tS = Date.now();
  const results = await Promise.all(queries.map((q) => searchProducts({ query: q, potId, minPrice: raised * 0.5, maxPrice: stretch, limit: 10 })));
  const failed = results.filter((r) => r.status === "error").length;
  const products = results.flatMap((r) => (r.status === "ok" ? r.products : []));
  const domains = new Set(products.flatMap((p) => p.offers.map((o) => o.domain)));
  const tSearch = Date.now() - tS;
  const searchedId = await say(potId, "searched", `I looked through ${domains.size || queries.length} shops for ${topic} gifts under ${money(raised)}.${failed ? ` ${failed} search${failed === 1 ? "" : "es"} didn't come back.` : ""}`, { found: products.length, timings: { plan: tPlan, search: tSearch, total: Date.now() - t0 } });
  if (!products.length) return failed < results.length;

  const { kept, dropped } = cleanProducts(products, profile.dislikes, stretch, { country: MARKET.country, currency: pot.currency ?? MARKET.currency });
  if (dropped.dislike) await say(potId, "dropped", `Left out ${dropped.dislike} ${dropped.dislikeWord ?? ""} thing${dropped.dislike === 1 ? "" : "s"}. ${pot.recipient_name} isn't a fan.`.replace("  ", " "));
  if (dropped.suspicious) await say(potId, "dropped", `Skipped ${dropped.suspicious} deal${dropped.suspicious === 1 ? "" : "s"} that looked too good to be true.`);

  const categories = Array.from(new Set([...BASE_CATEGORIES, ...profile.likes.map((l: string) => l.toLowerCase())]));
  const wishText = `${pot.wishlist_url ?? ""}`.replace(/[-_/]/g, " ");
  const bandLabel = String(bandFor(raised));
  // 1. Provisional picks straight away from a cheap, deterministic score.
  const rows = kept.map(({ product, offer }) => ({
    pot_id: potId,
    channel3_product_id: product.id,
    title: product.title.slice(0, 200),
    image_url: product.image,
    offer_url: offer.url,
    retailer: offer.domain,
    price: offer.price,
    currency: offer.currency,
    category: guessCategory(product.title, product.category, categories),
    fit_score: provisionalFit(product.title, product.category, profile.likes, product.rating, product.reviewCount),
    reason: `Picked with ${pot.recipient_name}'s love of ${profile.likes[0] ?? "good things"} in mind.`,
    band: bandLabel,
    signals: signalsFor(product, offer, wishText) as any,
    fetched_at: new Date().toISOString(),
  }));

  const tW = Date.now();
  if (replaceAll) await db.from("candidates").delete().eq("pot_id", potId);
  else await db.from("candidates").delete().eq("pot_id", potId).eq("band", bandLabel);
  // Avoid duplicates across bands
  const { data: existing } = await db.from("candidates").select("channel3_product_id").eq("pot_id", potId);
  const have = new Set((existing ?? []).map((e) => e.channel3_product_id));
  const fresh = rows.filter((r) => !have.has(r.channel3_product_id));
  const { data: inserted } = fresh.length ? await db.from("candidates").insert(fresh).select("*") : { data: [] as any[] };
  const tWrite = Date.now() - tW;
  await rerank(potId, raised, tallyFor.get(potId) ?? {}, { kind: "manual" }, pot.currency, true);
  const firstPicks = Date.now() - t0;
  await say(potId, "first_picks", "First picks are in. Fine-tuning...", { timings: { firstPicks } });

  // 2. One fast AI pass over the best 15 (mixed kinds), then overwrite with the final ranking.
  await working(potId, `Weighing up the best ${Math.min(15, inserted?.length ?? 0)} gifts for ${pot.recipient_name}`);
  const pool = preselect((inserted ?? []).filter((c: any) => Number(c.price) <= raised).map((c: any) => ({ ...c, fit: Number(c.fit_score) })), 15);
  const tSc = Date.now();
  let scores: Awaited<ReturnType<typeof scoreCandidates>> = [];
  let timedOut = false;
  try {
    scores = await scoreCandidates(profile, categories, pool.map((c: any) => ({ id: c.id, title: c.title, category: c.category, price: Number(c.price) })), 8000);
  } catch (e) {
    timedOut = true;
    console.error("scoring skipped", e);
  }
  const tScore = Date.now() - tSc;
  const tW2 = Date.now();
  const aiDropped = scores.filter((x) => x.dislike);
  // One write: AI scores for the 15, a slight damp on the rest so scored ones lead, and dislikes removed.
  const byScore = new Map(scores.map((x) => [x.id, x]));
  const drop = aiDropped.map((x) => x.id);
  if (scores.length) {
    const upd = (inserted ?? []).filter((c: any) => !drop.includes(c.id)).map((c: any) => {
      const x = byScore.get(c.id);
      return x ? { ...c, fit_score: x.fit, reason: x.reason, category: x.category } : { ...c, fit_score: Math.round(Number(c.fit_score) * 0.8 * 1000) / 1000 };
    });
    await Promise.all([upd.length ? db.from("candidates").upsert(upd) : null, drop.length ? db.from("candidates").delete().in("id", drop) : null]);
  }
  if (aiDropped.length) await say(potId, "dropped", `Left out ${aiDropped.length} more that ${pot.recipient_name} wouldn't love.`);
  if (timedOut) await say(potId, "score_slow", "Fine-tuning took too long, so I'm keeping the first picks for now.");
  const timings = { plan: tPlan, search: tSearch, firstPicks, score: tScore, write: tWrite + (Date.now() - tW2), total: Date.now() - t0 };
  lastTimings.set(potId, timings);
  if (searchedId) await db.from("agent_events").update({ payload: { found: products.length, timings } as any }).eq("id", searchedId);
  return true;
}

async function rerank(potId: string, raised: number, tally: Record<string, number>, trigger: Trigger, currency: string, quiet = false) {
  const db = await admin();
  const { data: cands } = await db.from("candidates").select("*").eq("pot_id", potId);
  if (!cands?.length) return;
  const prevTop = cands.filter((c) => c.rank != null && c.rank <= 3).sort((a, b) => a.rank! - b.rank!).map((c) => c.id);
  const scored: Scored[] = cands.map((c) => ({ id: c.id, price: Number(c.price ?? 0), category: c.category ?? "home", fit: Number(c.fit_score ?? 0), signals: c.signals as unknown as Signals }));
  const ranked = rank(scored, raised, tally);
  const byId = new Map(ranked.map((r) => [r.id, r]));
  // One batched write for every candidate's rank and score.
  await db.from("candidates").upsert(cands.map((c) => {
    const r = byId.get(c.id);
    return { ...c, rank: r ? r.rank : null, total_score: r ? Math.round(r.total * 1000) / 1000 : null };
  }));
  const newTop = ranked.slice(0, 3).map((r) => r.id);
  const changed = newTop.join() !== prevTop.join();
  if (!changed || quiet) return;
  const lead = cands.find((c) => c.id === newTop[0]);
  const leadMoved = newTop[0] !== prevTop[0] && lead;
  const why =
    trigger.kind === "authorized" ? `after ${trigger.who ?? "someone"} chipped in` :
    trigger.kind === "withdrawn" ? "after a hold was released" :
    trigger.kind === "vote" ? "with the latest votes" : "with fresh picks";
  const msg = newTop.length === 0
    ? `Nothing fits under ${formatMoney(raised, currency)} yet. I'll wait for the pot to grow.`
    : `I reshuffled the picks ${why}.${leadMoved ? ` The ${short(lead!.title)} is top now.` : ""}`;
  const timings = lastTimings.get(potId);
  lastTimings.delete(potId);
  await say(potId, "reranked", msg, timings ? { top: newTop, timings } : { top: newTop });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (t: string) => (t.length > 48 ? `${t.slice(0, 46).trim()}...` : t);

/** Final search at close: search at the exact authorised pot, then re-rank. Returns ranked count. */
export async function finalSearch(potId: string, raised: number) {
  const db = await admin();
  const { data: pot } = await db.from("pots").select("*").eq("id", potId).single();
  if (!pot || pot.mode === "fixed_split") return 0;
  const { data: live } = await db.from("contributions").select("id").eq("pot_id", potId).in("status", LIVE);
  const liveIds = new Set((live ?? []).map((c) => c.id));
  const { data: votes } = await db.from("category_votes").select("category, contribution_id").eq("pot_id", potId);
  const tally: Record<string, number> = {};
  for (const v of votes ?? []) if (v.contribution_id && liveIds.has(v.contribution_id)) tally[v.category] = (tally[v.category] ?? 0) + 1;
  await say(potId, "final_search", `The pot's closed at ${formatMoney(raised, pot.currency)}. One last look for gifts at exactly that.`);
  try {
    await search(potId, pot, raised, topCategories(tally), false);
  } catch (e) {
    console.error("final search failed", e);
  }
  await rerank(potId, raised, tally, { kind: "manual" }, pot.currency);
  await working(potId, null);
  const { count } = await db.from("candidates").select("id", { count: "exact", head: true }).eq("pot_id", potId).not("rank", "is", null);
  return count ?? 0;
}

/** Re-rank cached candidates against a new total (after holds drop off). */
export async function rerankAt(potId: string, raised: number) {
  const db = await admin();
  const { data: pot } = await db.from("pots").select("currency, mode").eq("id", potId).single();
  if (pot?.mode === "fixed_split") return;
  await rerank(potId, raised, {}, { kind: "withdrawn" }, pot?.currency ?? "GBP");
}

/** Copy real, previously searched-and-scored candidates from another demo pot for the same person. */
async function reuseDemoPicks(potId: string, pot: any, raised: number, replaceAll: boolean) {
  const db = await admin();
  const stretch = Math.round(Math.max(raised * 1.3, SEARCH_BANDS.find((b) => b > raised) ?? raised * 1.3));
  const { data: donors } = await db.from("pots").select("id").eq("is_demo", true).eq("recipient_name", pot.recipient_name).neq("id", potId).order("created_at", { ascending: false }).limit(10);
  for (const d of donors ?? []) {
    const { data: rows } = await db.from("candidates").select("channel3_product_id, title, image_url, offer_url, retailer, price, currency, category, fit_score, reason, signals, fetched_at").eq("pot_id", d.id).lte("price", stretch).gte("price", raised * 0.5);
    if (!rows || rows.length < 6) continue;
    const bandLabel = String(bandFor(raised));
    const tW = Date.now();
  if (replaceAll) await db.from("candidates").delete().eq("pot_id", potId);
    const { data: existing } = await db.from("candidates").select("channel3_product_id").eq("pot_id", potId);
    const have = new Set((existing ?? []).map((e) => e.channel3_product_id));
    const fresh = rows.filter((r) => !have.has(r.channel3_product_id)).map((r) => ({ ...r, pot_id: potId, band: bandLabel }));
    if (fresh.length) await db.from("candidates").insert(fresh as any);
    const shops = new Set(rows.map((r) => r.retailer)).size;
    await say(potId, "searched", `I looked through ${shops} shops for gifts under ${formatMoney(raised, pot.currency)}.`, { found: rows.length, reused: true });
    return true;
  }
  return false;
}
