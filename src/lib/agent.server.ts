// Kitty's agent run: plan, search, clean, score, rank, store. Narrates every step to agent_events.
import { BASE_CATEGORIES, MARKET, SEARCH_BANDS } from "./config";
import { formatMoney } from "./kitty";
import { bandFor, cleanProducts, rank, signalsFor, topCategories, type Scored, type Signals } from "./scoring";

export type Trigger = { kind: "authorized" | "withdrawn" | "vote" | "replan" | "manual"; who?: string | null };

const LIVE = ["authorized", "reauthorized", "captured"];
const LOCK_MS = 120_000;

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function say(potId: string, kind: string, message: string, payload: Record<string, unknown> = {}) {
  const db = await admin();
  await db.from("agent_events").insert({ pot_id: potId, kind, message, payload: payload as any });
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

  if (reason && band === 0) {
    if (trigger.kind === "manual" || trigger.kind === "replan") await say(potId, "waiting", `I'll start searching shops once the pot reaches ${money(30)}.`);
    reason = null;
  }

  if (reason) {
    if (reason === "band" && band > lastBand) await say(potId, "band_crossed", `We've passed ${money(band)}, so I'm looking for bigger gifts.`);
    if (reason === "votes") await say(potId, "votes_shift", `Everyone's leaning towards ${top2.join(" and ")}, so I'm having another look.`);
    const ok = await search(potId, pot, raised, top2, reason === "replan" || reason === "first");
    if (ok) await db.from("pots").update({ last_search_band: band, last_top_categories: top2 }).eq("id", potId);
  }

  await rerank(potId, raised, tally, trigger, cur);
}

async function search(potId: string, pot: any, raised: number, top2: string[], replaceAll: boolean) {
  const db = await admin();
  const { searchProducts } = await import("./channel3.server");
  const { planQueries, scoreCandidates } = await import("./ai.server");
  if (!process.env["CHANNEL3_API_KEY"]) {
    const { data: last } = await db.from("agent_events").select("kind").eq("pot_id", potId).order("at", { ascending: false }).limit(1);
    if (last?.[0]?.kind !== "search_unconfigured") await say(potId, "search_unconfigured", "I can start looking in shops as soon as the shop key is added.");
    return false;
  }
  const money = (n: number) => formatMoney(n, pot.currency);
  const profile = {
    name: pot.recipient_name, occasion: pot.occasion, closeness: pot.closeness, likes: pot.likes ?? [], dislikes: pot.dislikes ?? [],
    wishlist: pot.wishlist_url, topVoted: top2, pot: raised, currency: pot.currency,
  };

  await working(potId, `Thinking about ${(profile.likes.slice(0, 2).join(" and ") || "what they love")}`);
  let queries: string[];
  try {
    queries = await planQueries(profile);
  } catch (e) {
    console.error(e);
    queries = [...profile.likes, ...top2].slice(0, 4).map((l: string) => `${l} gift`);
  }
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
  const results = await Promise.all(queries.map((q) => searchProducts({ query: q, potId, minPrice: raised * 0.5, maxPrice: stretch, limit: 10 })));
  const failed = results.filter((r) => r.status === "error").length;
  const products = results.flatMap((r) => (r.status === "ok" ? r.products : []));
  const domains = new Set(products.flatMap((p) => p.offers.map((o) => o.domain)));
  await say(potId, "searched", `I looked through ${domains.size || queries.length} shops for ${topic} gifts under ${money(raised)}.${failed ? ` ${failed} search${failed === 1 ? "" : "es"} didn't come back.` : ""}`, { found: products.length });
  if (!products.length) return failed < results.length;

  const { kept, dropped } = cleanProducts(products, profile.dislikes, stretch, { country: MARKET.country, currency: pot.currency ?? MARKET.currency });
  if (dropped.dislike) await say(potId, "dropped", `Left out ${dropped.dislike} ${dropped.dislikeWord ?? ""} thing${dropped.dislike === 1 ? "" : "s"}. ${pot.recipient_name} isn't a fan.`.replace("  ", " "));
  if (dropped.suspicious) await say(potId, "dropped", `Skipped ${dropped.suspicious} deal${dropped.suspicious === 1 ? "" : "s"} that looked too good to be true.`);

  const categories = Array.from(new Set([...BASE_CATEGORIES, ...profile.likes.map((l: string) => l.toLowerCase())]));
  await working(potId, `Weighing up ${kept.length} gifts for ${pot.recipient_name}`);
  const items = kept.slice(0, 40).map(({ product, offer }) => ({ id: product.id, title: product.title, category: product.category, price: offer.price, retailer: offer.domain }));
  const scores = await scoreCandidates(profile, categories, items);
  const byId = new Map(scores.map((s) => [s.id, s]));
  const aiDropped = scores.filter((s) => s.dislike).length;
  if (aiDropped) await say(potId, "dropped", `Left out ${aiDropped} more that ${pot.recipient_name} wouldn't love.`);

  const wishText = `${pot.wishlist_url ?? ""}`.replace(/[-_/]/g, " ");
  const bandLabel = String(bandFor(raised));
  const rows = kept
    .map(({ product, offer }) => {
      const s = byId.get(product.id);
      if (!s || s.dislike) return null;
      return {
        pot_id: potId,
        channel3_product_id: product.id,
        title: product.title.slice(0, 200),
        image_url: product.image,
        offer_url: offer.url,
        retailer: offer.domain,
        price: offer.price,
        currency: offer.currency,
        category: s.category,
        fit_score: s.fit,
        reason: s.reason,
        band: bandLabel,
        signals: signalsFor(product, offer, wishText) as any,
        fetched_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as any[];

  if (replaceAll) await db.from("candidates").delete().eq("pot_id", potId);
  else await db.from("candidates").delete().eq("pot_id", potId).eq("band", bandLabel);
  // Avoid duplicates across bands
  const { data: existing } = await db.from("candidates").select("channel3_product_id").eq("pot_id", potId);
  const have = new Set((existing ?? []).map((e) => e.channel3_product_id));
  const fresh = rows.filter((r) => !have.has(r.channel3_product_id));
  if (fresh.length) await db.from("candidates").insert(fresh);
  return true;
}

async function rerank(potId: string, raised: number, tally: Record<string, number>, trigger: Trigger, currency: string) {
  const db = await admin();
  const { data: cands } = await db.from("candidates").select("id, title, price, category, fit_score, signals, rank").eq("pot_id", potId);
  if (!cands?.length) return;
  const prevTop = cands.filter((c) => c.rank != null && c.rank <= 3).sort((a, b) => a.rank! - b.rank!).map((c) => c.id);
  const scored: Scored[] = cands.map((c) => ({ id: c.id, price: Number(c.price ?? 0), category: c.category ?? "home", fit: Number(c.fit_score ?? 0), signals: c.signals as unknown as Signals }));
  const ranked = rank(scored, raised, tally);
  const byId = new Map(ranked.map((r) => [r.id, r]));
  await Promise.all(
    cands.map((c) => {
      const r = byId.get(c.id);
      return db.from("candidates").update({ rank: r ? r.rank : null, total_score: r ? Math.round(r.total * 1000) / 1000 : null }).eq("id", c.id);
    }),
  );
  const newTop = ranked.slice(0, 3).map((r) => r.id);
  const changed = newTop.join() !== prevTop.join();
  if (!changed) return;
  const lead = cands.find((c) => c.id === newTop[0]);
  const leadMoved = newTop[0] !== prevTop[0] && lead;
  const why =
    trigger.kind === "authorized" ? `after ${trigger.who ?? "someone"} chipped in` :
    trigger.kind === "withdrawn" ? "after a hold was released" :
    trigger.kind === "vote" ? "with the latest votes" : "with fresh picks";
  const msg = newTop.length === 0
    ? `Nothing fits under ${formatMoney(raised, currency)} yet. I'll wait for the pot to grow.`
    : `I reshuffled the picks ${why}.${leadMoved ? ` The ${short(lead!.title)} is top now.` : ""}`;
  await say(potId, "reranked", msg, { top: newTop });
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
