// Kitty's closing state machine: collecting -> voting -> veto -> buying -> done (or cancelled).
// Every transition is a conditional update on the current status, so a replayed tick is a no-op.
// All money maths lives in ./closing (pure, tested); this file only does I/O and narration.
import { formatMoney } from "./kitty";
import { resplit, votePhrase, afterCapture, clockTime, proportionalRefund, holdAction, isVoteClosed, pickWinner, proRata, shouldClose, voteClosesAt, vetoMs, effectiveDeadline, isDemoHold, reminderDueAt, type VoteWindow } from "./closing";
import { OCCASIONS } from "./config";

const HELD = ["authorized", "reauthorized"];
const LOCK_MS = 90_000;

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const pp = () => import("./paypal.server");

async function say(potId: string, kind: string, message: string, payload: Record<string, unknown> = {}) {
  const db = await admin();
  await db.from("agent_events").insert({ pot_id: potId, kind, message, payload: payload as any });
}
async function setWorking(potId: string, text: string | null) {
  const db = await admin();
  await db.from("pots").update({ agent_working: text }).eq("id", potId);
}

/** Move status only if it is still `from`. Returns true if this caller won the transition. */
async function transition(potId: string, from: string, patch: Record<string, unknown>) {
  const db = await admin();
  const { data } = await db.from("pots").update(patch as any).eq("id", potId).eq("status", from).select("id");
  return !!data?.length;
}

async function lock(potId: string) {
  const db = await admin();
  const stale = new Date(Date.now() - LOCK_MS).toISOString();
  const { data } = await db.from("pots").update({ tick_lock_at: new Date().toISOString() }).eq("id", potId).or(`tick_lock_at.is.null,tick_lock_at.lt.${stale}`).select("id");
  return !!data?.length;
}
async function unlock(potId: string) {
  const db = await admin();
  await db.from("pots").update({ tick_lock_at: null }).eq("id", potId);
}

const cents = (n: number) => Math.round(n * 100);
const short = (t: string) => (t.length > 48 ? `${t.slice(0, 46).trim()}...` : t);

async function heldTotal(potId: string) {
  const db = await admin();
  const { data } = await db.from("contributions").select("amount").eq("pot_id", potId).in("status", [...HELD, "captured"]);
  return (data ?? []).reduce((s, c) => s + Number(c.amount), 0);
}

async function rankedPicks(potId: string, max?: number) {
  const db = await admin();
  const { data } = await db.from("candidates").select("*").eq("pot_id", potId).not("rank", "is", null).order("rank");
  return (data ?? []).filter((c) => c.price != null && (max == null || cents(Number(c.price)) <= cents(max)));
}

export async function currentDecision(potId: string) {
  const db = await admin();
  const { data } = await db.from("decisions").select("*").eq("pot_id", potId).is("vetoed_at", null).order("created_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

/** Public entry: advance the pot as far as the clock and data allow. Idempotent and locked. */
export async function tickPot(potId: string): Promise<{ status: string; ran: boolean }> {
  if (!(await lock(potId))) return { status: "busy", ran: false };
  try {
    for (let i = 0; i < 5; i++) {
      const before = await statusOf(potId);
      await step(potId);
      const after = await statusOf(potId);
      if (after === before) break;
    }
    return { status: await statusOf(potId), ran: true };
  } catch (e) {
    console.error("tick failed", e);
    await say(potId, "tick_error", "Something went wrong while closing the kitty. I'll try again shortly. Nobody's been charged twice.");
    return { status: await statusOf(potId), ran: true };
  } finally {
    await setWorking(potId, null);
    await unlock(potId);
  }
}

async function statusOf(potId: string) {
  const db = await admin();
  const { data } = await db.from("pots").select("status").eq("id", potId).single();
  return data?.status ?? "missing";
}

async function step(potId: string) {
  const db = await admin();
  const { data: pot } = await db.from("pots").select("*").eq("id", potId).single();
  if (!pot) return;
  const now = new Date();
  if (pot.status === "collecting") {
    await maybeDraftReminder(pot, now);
    return closeIfDue(pot, now);
  }
  if (pot.status === "voting") return closeVoteIfDue(pot, now);
  if (pot.status === "veto") {
    const d = await currentDecision(pot.id);
    if (!d) return startVeto(pot, null, "agent");
    if (d.buy_at && new Date(d.buy_at).getTime() <= now.getTime()) {
      await transition(pot.id, "veto", { status: "buying" });
    }
    return;
  }
  if (pot.status === "buying") return buy(pot);
}

// ---------- close ----------
async function closeIfDue(pot: any, now: Date) {
  const raised = await heldTotal(pot.id);
  if (!shouldClose({ raised, target: Number(pot.target_amount), deadline: effectiveDeadline(new Date(pot.created_at), new Date(pot.deadline_at), pot), now })) return;
  const money = (n: number) => formatMoney(n, pot.currency);
  if (pot.mode === "fixed_split") return closeFixed(pot, now, raised);

  if (raised <= 0) {
    if (await transition(pot.id, "collecting", { status: "cancelled", closed_at: now.toISOString() })) {
      await say(pot.id, "pot_cancelled", "The deadline passed and nobody chipped in, so Kitty's off. Nobody was charged.");
    }
    return;
  }

  // Don't hammer the shop search if a close attempt found nothing a few minutes ago.
  if (pot.close_search_at && now.getTime() - new Date(pot.close_search_at).getTime() < 10 * 60_000) return;
  await (await admin()).from("pots").update({ close_search_at: now.toISOString() }).eq("id", pot.id);

  await setWorking(pot.id, `Closing the pot at ${money(raised)}. Running a final search...`);
  const { finalSearch } = await import("./agent.server");
  await finalSearch(pot.id, raised);
  const picks = (await rankedPicks(pot.id, raised)).slice(0, 3);
  if (!picks.length) {
    await say(pot.id, "close_waiting", `The pot's closed at ${money(raised)} but I haven't found a gift that fits yet. I'll keep looking. Every hold is still only held.`);
    return;
  }
  if (cents(raised) < cents(Number(pot.target_amount))) {
    await say(pot.id, "short_pot", `We reached ${money(raised)} of ${money(Number(pot.target_amount))}. Swapping to ${short(picks[0]!.title)} at ${money(Number(picks[0]!.price))}.`);
  }

  if (pot.vote_window === "off") {
    if (await transition(pot.id, "collecting", { status: "veto", closed_at: now.toISOString(), vote_candidate_ids: picks.map((p) => p.id) })) {
      await startVeto({ ...pot, status: "veto" }, picks[0]!, "agent");
    }
    return;
  }
  // Start the window after the final search finishes, so a slow search never eats the vote.
  const closes = voteClosesAt(pot.vote_window as VoteWindow, new Date(), pot);
  if (await transition(pot.id, "collecting", { status: "voting", closed_at: now.toISOString(), vote_closes_at: closes?.toISOString(), vote_candidate_ids: picks.map((p) => p.id) })) {
    await say(pot.id, "vote_open", `Time to vote! ${picks.length} picks are up. It closes at ${clockTime(closes!)} or once everyone who wants to vote has.`);
  }
}

// ---------- vote ----------
export async function voteState(pot: any) {
  const d = await admin();
  const ids: string[] = pot.vote_candidate_ids ?? [];
  const [{ data: live }, { data: votes }] = await Promise.all([
    d.from("contributions").select("id, final_vote_opt_out").eq("pot_id", pot.id).in("status", HELD),
    d.from("final_votes").select("contribution_id, candidate_id").eq("pot_id", pot.id),
  ]);
  const liveIds = new Set((live ?? []).map((c) => c.id));
  const valid = (votes ?? []).filter((v) => v.contribution_id && liveIds.has(v.contribution_id) && v.candidate_id && ids.includes(v.candidate_id));
  const eligible = (live ?? []).filter((c) => !c.final_vote_opt_out).length;
  const tally: Record<string, number> = {};
  for (const v of valid) tally[v.candidate_id!] = (tally[v.candidate_id!] ?? 0) + 1;
  return { ids, tally, voted: valid.length, eligible, contributors: (live ?? []).length };
}

async function closeVoteIfDue(pot: any, now: Date) {
  const vs = await voteState(pot);
  if (!isVoteClosed({ closesAt: pot.vote_closes_at ? new Date(pot.vote_closes_at) : null, now, eligible: vs.eligible, voted: vs.voted })) return;
  const d = await admin();
  const { data: cands } = await d.from("candidates").select("*").in("id", vs.ids.length ? vs.ids : ["00000000-0000-0000-0000-000000000000"]);
  const { winner, nobodyVoted } = pickWinner((cands ?? []).map((c) => ({ ...c, total_score: c.total_score != null ? Number(c.total_score) : null, votes: vs.tally[c.id] ?? 0 })));
  if (!(await transition(pot.id, "voting", { status: "veto" }))) return;
  if (nobodyVoted) await say(pot.id, "vote_closed", "Nobody voted, so Kitty is going with its top pick.");
  else await say(pot.id, "vote_closed", `The votes are in. The ${short(winner!.title)} won. ${votePhrase(vs.tally[winner!.id] ?? 0, vs.voted, vs.contributors)}`);
  await startVeto({ ...pot, status: "veto" }, winner, nobodyVoted ? "agent" : "votes", vs);
}

// ---------- veto ----------
export async function startVeto(pot: any, pick: any | null, by: "votes" | "agent" | "organiser", vs?: { tally: Record<string, number>; voted: number; contributors?: number }, opts: { from?: any } = {}) {
  const d = await admin();
  if (!pick) pick = (await rankedPicks(pot.id, await heldTotal(pot.id)))[0];
  if (!pick) {
    await say(pot.id, "close_waiting", "I couldn't find a gift the pot covers. The organiser can extend the deadline or top up.");
    return;
  }
  const ms = vetoMs(pot);
  const buyAt = new Date(Date.now() + ms);
  const { explainChoice } = await import("./ai.server");
  const why = await explainChoice({ name: pot.recipient_name, likes: pot.likes ?? [], title: pick.title, retailer: pick.retailer, votes: vs?.tally[pick.id] ?? 0, voted: vs?.voted ?? 0, contributors: vs?.contributors ?? vs?.voted ?? 0, reason: pick.reason });
  const prev = opts.from ?? (await currentDecision(pot.id));
  if (prev) await d.from("decisions").update({ vetoed_at: new Date().toISOString(), swapped_to: pick.id }).eq("id", prev.id).is("vetoed_at", null);
  await d.from("decisions").insert({ pot_id: pot.id, candidate_id: pick.id, buy_at: buyAt.toISOString(), decided_by: by, why, total_seconds: Math.round(ms / 1000) });
  await say(pot.id, "veto_started", `I'll buy the ${short(pick.title)} for ${formatMoney(Number(pick.price), pot.currency)} at ${clockTime(buyAt)}, unless someone says no.`);
}

// ---------- hold checks ----------
async function checkHolds(pot: any) {
  const d = await admin();
  const { getAuthorization, reauthorize } = await pp();
  const { data: holds } = await d.from("contributions").select("*").eq("pot_id", pot.id).in("status", HELD);
  let dropped = 0;
  for (const h of holds ?? []) {
    if (!h.authorization_id) continue;
    let status = "CREATED";
    let exp = h.auth_expires_at;
    try {
      const a = await getAuthorization(h.authorization_id);
      status = a.status;
      exp = a.expiration_time ?? exp;
    } catch (e) {
      console.error("auth lookup failed", h.id, e);
      continue; // can't tell; capture will surface it
    }
    const act = holdAction({ status, createdAt: new Date(h.created_at), honorExpiresAt: h.honor_expires_at ? new Date(h.honor_expires_at) : null, authExpiresAt: exp ? new Date(exp) : null, now: new Date() });
    if (act === "drop") {
      await d.from("contributions").update({ status: status === "VOIDED" ? "voided" : "expired" }).eq("id", h.id).in("status", HELD);
      dropped++;
    } else if (act === "reauthorize") {
      try {
        const r = await reauthorize(h.authorization_id, Number(h.amount), pot.currency, `reauth-${h.id}-${h.reauth_count + 1}`);
        await d.from("contributions").update({ status: "reauthorized", authorization_id: r.id, auth_expires_at: r.expiration_time ?? null, honor_expires_at: new Date(Date.now() + 3 * 86400_000).toISOString(), reauth_count: h.reauth_count + 1 }).eq("id", h.id);
        await say(pot.id, "reauthorized", "Refreshed a hold that was getting old. Still only held.");
      } catch (e) {
        console.error("reauth failed", h.id, e);
        await d.from("contributions").update({ status: "expired" }).eq("id", h.id);
        dropped++;
      }
    }
  }
  if (dropped) await say(pot.id, "holds_dropped", `${dropped} hold${dropped === 1 ? "" : "s"} had lapsed with PayPal, so I've taken ${dropped === 1 ? "it" : "them"} out of the pot. Nobody was charged for ${dropped === 1 ? "it" : "them"}.`);
  return dropped;
}

// ---------- buy ----------
async function buy(pot: any) {
  const d = await admin();
  const money = (n: number) => formatMoney(n, pot.currency, { exact: !Number.isInteger(n) });
  const { data: liveRows } = await d.from("contributions").select("is_seeded, authorization_id").eq("pot_id", pot.id).in("status", HELD);
  const needsPayPal = (liveRows ?? []).some((c) => !isDemoHold(c));
  if (needsPayPal && (!process.env["PAYPAL_CLIENT_ID"] || !process.env["PAYPAL_CLIENT_SECRET"])) {
    const { data: last } = await d.from("agent_events").select("kind").eq("pot_id", pot.id).order("at", { ascending: false }).limit(1);
    if (last?.[0]?.kind !== "paypal_unconfigured") await say(pot.id, "paypal_unconfigured", "Ready to buy, but PayPal isn't connected yet. Every hold is still only held.");
    return;
  }
  const decision = await currentDecision(pot.id);
  if (!decision?.candidate_id) {
    await transition(pot.id, "buying", { status: "veto" });
    return;
  }
  const { data: pick } = await d.from("candidates").select("*").eq("id", decision.candidate_id).single();
  if (!pick) return;
  let price = Number(pick.price);
  const { data: planned } = await d.from("contributions").select("id").eq("pot_id", pot.id).not("planned_capture", "is", null).limit(1);

  if (!planned?.length) {
    // 1. Pre-buy refresh of the winner's offer.
    await setWorking(pot.id, `Checking ${pick.retailer ?? "the shop"} still has the ${short(pick.title)}...`);
    const held = await heldTotal(pot.id);
    const { refreshOffer } = await import("./channel3.server");
    // Re-check the pick and the next two in parallel (5s each), so a sold-out winner can hand over instantly.
    const others = (await rankedPicks(pot.id, held)).filter((c) => c.id !== pick.id).slice(0, 2);
    const check = (c: any) => withTimeout(refreshOffer({ productId: c.channel3_product_id, title: c.title, retailer: c.retailer, potId: pot.id, maxPrice: held }), 5000);
    const tR = Date.now();
    // Demo pots skip the live recheck; real pots always recheck.
    const live = !!pick.channel3_product_id && !pot.is_demo;
    const results = live ? await Promise.all([pick, ...others].map((c) => (c.channel3_product_id ? check(c) : Promise.resolve(null)))) : [];
    const timings = { refresh: Date.now() - tR };
    const r = live ? results[0] : ({ status: "not_configured" } as const);
    const fits = (x: any) => x && x.status === "ok" && x.inStock && cents(x.price) <= cents(held);
    const handOver = async () => {
      const idx = others.findIndex((_, i) => fits(results[i + 1]));
      if (idx < 0) return swapToNext(pot, decision, held);
      const nx = others[idx]!; const nr = results[idx + 1] as any;
      if (cents(nr.price) !== cents(Number(nx.price))) await d.from("candidates").update({ price: nr.price, offer_url: nr.url, fetched_at: new Date().toISOString() }).eq("id", nx.id);
      await transition(pot.id, "buying", { status: "veto" });
      return startVeto({ ...pot, status: "veto" }, { ...nx, price: nr.price }, "agent", undefined, { from: decision });
    };
    const fresh = pick.fetched_at && Date.now() - new Date(pick.fetched_at).getTime() < 30 * 60_000;
    if (r && r.status === "ok") {
      if (!r.inStock || cents(r.price) > cents(held)) {
        await say(pot.id, "prebuy_moved", `${short(pick.title)} ${!r.inStock ? "has sold out" : `went up to ${money(r.price)}`}. Moving to the next pick.`, { timings });
        return handOver();
      }
      if (cents(r.price) !== cents(price)) {
        await d.from("candidates").update({ price: r.price, offer_url: r.url }).eq("id", pick.id);
        await say(pot.id, "prebuy_price", `Price moved from ${money(price)} to ${money(r.price)}. Still fits.`, { timings });
        price = r.price;
      } else await say(pot.id, "prebuy_ok", `Good news, it's still in stock at ${pick.retailer ?? "the shop"} for ${money(price)}.`, { timings });
    } else if (r && r.status === "gone") {
      await say(pot.id, "prebuy_moved", `${short(pick.title)} isn't listed any more. Moving to the next pick.`, { timings });
      return handOver();
    } else if (live && !fresh) {
      await say(pot.id, "prebuy_moved", `Couldn't re-check the ${short(pick.title)} in time, and my last look was a while ago. Moving to the next pick.`, { timings });
      return handOver();
    } else {
      await say(pot.id, "prebuy_skip", pot.is_demo ? "This is a demo, so I'm using the price I found earlier." : "Couldn't re-check the shop just now, but I checked it in the last half hour, so I'm going with that price.", { timings });
    }

    // 2. Hold checks.
    await setWorking(pot.id, "Checking every hold with PayPal...");
    const dropped = await checkHolds(pot);
    const total = await heldTotal(pot.id);
    if (dropped) {
      const { rerankAt } = await import("./agent.server");
      await rerankAt(pot.id, total);
    }
    if (cents(total) < cents(price)) {
      const alt = (await rankedPicks(pot.id, total))[0];
      if (alt) {
        await say(pot.id, "short_pot", `We're at ${money(total)} now. Swapping to ${short(alt.title)} at ${money(Number(alt.price))}.`);
        await transition(pot.id, "buying", { status: "veto" });
        return startVeto({ ...pot, status: "veto" }, alt, "agent", undefined, { from: decision });
      }
      return refundAndCancel(pot, "The holds that are left don't cover any gift, so Kitty's off.");
    }

    // 3. Plan pro-rata shares once; planned_capture makes replays safe.
    const { data: holds } = await d.from("contributions").select("id, amount").eq("pot_id", pot.id).in("status", HELD).order("created_at");
    const shares = proRata((holds ?? []).map((h) => ({ id: h.id, amount: Number(h.amount) })), price);
    await Promise.all(shares.map((s) => d.from("contributions").update({ planned_capture: s.share }).eq("id", s.id)));
    await say(pot.id, "capture_planned", `You're only charged your share of the final cost. ${money(price)} across ${shares.length} people, and ${money(Math.round((total - price) * 100) / 100)} of the holds is released.`);
  }

  // 4. Capture each planned share (idempotent: 'cap-' + contribution id, skip captured).
  // Captures are NOT final, so if one fails the others can be topped up before their holds close.
  // Every hold was already checked with GET in step 2; the rest of each hold is voided in step 6.
  await setWorking(pot.id, `Taking ${money(price)} from the holds...`);
  const { captureAuthorization, voidAuthorization } = await pp();
  const { data: todo } = await d.from("contributions").select("*").eq("pot_id", pot.id).in("status", HELD).not("planned_capture", "is", null);
  let failures = 0;
  for (const c of todo ?? []) {
    const share = Number(c.planned_capture);
    if (share <= 0) continue;
    if (isDemoHold(c)) {
      // Seeded demo hold: never sent to PayPal. Recorded as a demo payment with no capture id.
      await d.from("contributions").update({ status: "captured", captured_amount: share, capture_id: null }).eq("id", c.id).in("status", HELD);
      continue;
    }
    try {
      const cap = await captureAuthorization(c.authorization_id!, share, pot.currency, `cap-${c.id}`, false);
      await d.from("contributions").update({ status: "captured", capture_id: cap.id, captured_amount: share }).eq("id", c.id).in("status", HELD);
    } catch (e) {
      console.error("capture failed", c.id, e);
      failures++;
      await d.from("contributions").update({ status: "failed" }).eq("id", c.id).in("status", HELD);
      try { if (c.authorization_id) await voidAuthorization(c.authorization_id, `void-${c.id}`); } catch { /* lapses on its own */ }
    }
  }
  if (failures) await say(pot.id, "capture_failed", `${failures} hold${failures === 1 ? "" : "s"} couldn't be taken. Re-totalling what was paid.`);

  // 5. Settle shortfalls: re-split over the successful holds first, then cheaper pick, then refund.
  let { data: caps } = await d.from("contributions").select("id, amount, capture_id, captured_amount, authorization_id, is_seeded, topup_capture_id").eq("pot_id", pot.id).eq("status", "captured");
  let captured = (caps ?? []).reduce((s, c) => s + Number(c.captured_amount ?? 0), 0);
  if (cents(captured) < cents(price) && (caps ?? []).length) {
    const extras = resplit((caps ?? []).map((c) => ({ id: c.id, held: Number(c.amount), paid: Number(c.captured_amount ?? 0) })), (cents(price) - cents(captured)) / 100);
    if (extras) {
      let topped = 0;
      for (const x of extras) {
        const c = caps!.find((r) => r.id === x.id)!;
        if (c.topup_capture_id) continue; // already topped up on an earlier pass
        try {
          let capId: string | null = null;
          if (!isDemoHold(c)) capId = (await captureAuthorization(c.authorization_id!, x.extra, pot.currency, `cap2-${c.id}`, false)).id;
          await d.from("contributions").update({ captured_amount: Math.round((Number(c.captured_amount) + x.extra) * 100) / 100, topup_capture_id: capId ?? "demo", topup_amount: x.extra }).eq("id", c.id);
          topped += x.extra;
        } catch (e) { console.error("top-up capture failed", c.id, e); }
      }
      await say(pot.id, "capture_resplit", `To cover the gap, I took ${money(Math.round(topped * 100) / 100)} more from ${extras.length} of the other holds, in proportion to what each held and never more than anyone held.`);
      ({ data: caps } = await d.from("contributions").select("id, amount, capture_id, captured_amount, authorization_id, is_seeded, topup_capture_id").eq("pot_id", pot.id).eq("status", "captured"));
      captured = (caps ?? []).reduce((s, c) => s + Number(c.captured_amount ?? 0), 0);
    }
  }
  const fallbacks = (await rankedPicks(pot.id)).filter((c) => c.id !== pick.id).map((c) => ({ ...c, price: Number(c.price) }));
  const plan = afterCapture(captured, price, fallbacks);
  let gift = pick;
  if (plan.kind === "refund") return refundAndCancel(pot, "Not enough could be taken to cover a gift, so every payment has been refunded.");
  if (plan.kind === "swap") {
    const { refundCapture } = await pp();
    // Surplus rule after capture: refund the difference in the same proportions people paid.
    const excess = Math.round((captured - plan.to.price) * 100) / 100;
    for (const r of proportionalRefund((caps ?? []).map((c) => ({ id: c.id, amount: Number(c.captured_amount) })), excess)) {
      const c = caps!.find((x) => x.id === r.id)!;
      if (!c.capture_id) {
        await d.from("contributions").update({ captured_amount: Math.round((Number(c.captured_amount) - r.amount) * 100) / 100 }).eq("id", c.id);
        continue;
      }
      try {
        await refundCapture(c.capture_id!, `ref-${c.capture_id}-swap`, { value: r.amount, currency: pot.currency });
        await d.from("contributions").update({ captured_amount: Math.round((Number(c.captured_amount) - r.amount) * 100) / 100 }).eq("id", c.id);
      } catch (e) { console.error("partial refund failed", e); }
    }
    await d.from("decisions").update({ vetoed_at: new Date().toISOString(), swapped_to: plan.to.id }).eq("id", decision.id);
    await d.from("decisions").insert({ pot_id: pot.id, candidate_id: plan.to.id, buy_at: new Date().toISOString(), decided_by: "agent", why: plan.to.reason });
    await say(pot.id, "capture_swap", `Paid ${money(captured)} in the end, so I've switched to ${short(plan.to.title)} at ${money(plan.to.price)} and refunded the difference.`);
    gift = plan.to;
    price = plan.to.price;
  } else {
    await say(pot.id, "captured", `${money(price)} paid by ${caps?.length ?? 0} people. Wrapping it up.`);
  }

  // 6. Release holds that weren't needed, and the uncaptured rest of every captured hold.
  for (const c of caps ?? []) {
    if (isDemoHold(c) || !c.authorization_id || cents(Number(c.captured_amount)) >= cents(Number(c.amount))) continue;
    try { await voidAuthorization(c.authorization_id, `void-rest-${c.id}`); } catch (e) { console.error("void rest failed", c.id, e); }
  }
  const { data: spare } = await d.from("contributions").select("id, authorization_id").eq("pot_id", pot.id).in("status", HELD);
  for (const s of spare ?? []) {
    try { if (s.authorization_id) await voidAuthorization(s.authorization_id, `void-${s.id}`); } catch (e) { console.error("void spare failed", e); }
    await d.from("contributions").update({ status: "voided" }).eq("id", s.id);
  }

  // 7. Payout to the organiser.
  await payout(pot, gift, price);
}

async function swapToNext(pot: any, decision: any, held: number) {
  const next = (await rankedPicks(pot.id, held)).find((c) => c.id !== decision.candidate_id && !(c.price == null));
  await transition(pot.id, "buying", { status: "veto" });
  if (!next) {
    const d = await admin();
    await d.from("decisions").update({ vetoed_at: new Date().toISOString() }).eq("id", decision.id);
    await d.from("pots").update({ status: "collecting", close_search_at: null }).eq("id", pot.id).eq("status", "veto");
    await say(pot.id, "close_waiting", "No other pick fits right now. I'll search again shortly. Every hold is still only held.");
    return;
  }
  await startVeto({ ...pot, status: "veto" }, next, "agent", undefined, { from: decision });
}

async function payout(pot: any, gift: any, price: number) {
  const d = await admin();
  const { createPayout, refundCapture, PayPalError } = await pp();
  const batchId = `pot-${pot.id}`;
  const { data: existing } = await d.from("payouts").select("*").eq("pot_id", pot.id).maybeSingle();
  if (existing && ["SUCCESS", "PENDING", "PROCESSING", "fallback", "demo"].includes(existing.status ?? "")) {
    await transition(pot.id, "buying", { status: "done" });
    return;
  }
  const { data: paidRows } = await d.from("contributions").select("capture_id, captured_amount").eq("pot_id", pot.id).eq("status", "captured");
  const demoPaid = (paidRows ?? []).filter((c) => !c.capture_id).reduce((s, c) => s + Number(c.captured_amount ?? 0), 0);
  if (demoPaid > 0) {
    // Some of the money is demo holds, so a real payout would be dishonest. Record it as a demo payout.
    const realPaid = Math.round(((paidRows ?? []).reduce((s, c) => s + Number(c.captured_amount ?? 0), 0) - demoPaid) * 100) / 100;
    const row = { pot_id: pot.id, payout_batch_id: null, amount: price, status: "demo", buy_url: gift.offer_url };
    if (existing) await d.from("payouts").update(row).eq("pot_id", pot.id); else await d.from("payouts").insert(row);
    await transition(pot.id, "buying", { status: "done" });
    await say(pot.id, "paid_out", `All done! This is a demo pot, so no real payout went to ${pot.organiser_name}.${realPaid > 0 ? ` The ${formatMoney(realPaid, pot.currency, { exact: true })} from real sandbox holds is safe in Kitty's PayPal account.` : " Nobody's real money moved."}`);
    return;
  }
  if (!existing) await d.from("payouts").insert({ pot_id: pot.id, payout_batch_id: batchId, amount: price, status: "sending", buy_url: gift.offer_url });
  await setWorking(pot.id, `Sending ${formatMoney(price, pot.currency)} to ${pot.organiser_name}...`);
  const note = `Kitty for ${pot.recipient_name}: ${gift.title}`.slice(0, 200);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await createPayout({ batchId, email: pot.organiser_paypal_email, amount: price, currency: pot.currency, note, itemId: `item-${pot.id}` });
      await d.from("payouts").update({ payout_batch_id: r.batchId, item_id: r.itemId, status: r.status, amount: price, buy_url: gift.offer_url }).eq("pot_id", pot.id);
      await transition(pot.id, "buying", { status: "done" });
      await say(pot.id, "paid_out", `All done! ${formatMoney(price, pot.currency)} is with ${pot.organiser_name} to buy the ${short(gift.title)}.`);
      return;
    } catch (e) {
      lastErr = e;
      const body = e instanceof PayPalError ? e.body : "";
      const notEnabled = e instanceof PayPalError && (e.status === 403 || /AUTHORIZATION_ERROR|NOT_AUTHORIZED|PERMISSION_DENIED|not enabled|INSUFFICIENT_FUNDS/i.test(body));
      if (notEnabled) {
        await d.from("payouts").update({ status: "fallback", error: body.slice(0, 500), amount: price, buy_url: gift.offer_url }).eq("pot_id", pot.id);
        await transition(pot.id, "buying", { status: "done" });
        await say(pot.id, "payout_fallback", `Payouts aren't switched on for this PayPal account, so the ${formatMoney(price, pot.currency)} is safe in Kitty's PayPal account. In production it would go straight to ${pot.organiser_name}.`);
        return;
      }
      const transient = !(e instanceof PayPalError) || e.status >= 500 || e.status === 429;
      if (!transient) break;
    }
  }
  console.error("payout failed", lastErr);
  await d.from("payouts").update({ status: "failed", error: String(lastErr).slice(0, 500) }).eq("pot_id", pot.id);
  const { data: caps } = await d.from("contributions").select("id, capture_id").eq("pot_id", pot.id).eq("status", "captured");
  for (const c of caps ?? []) {
    if (!c.capture_id) continue;
    try {
      const r = await refundCapture(c.capture_id, `ref-${c.capture_id}-payout`);
      await d.from("contributions").update({ status: "refunded", refund_id: r.id }).eq("id", c.id);
    } catch (e) { console.error("refund failed", c.id, e); }
  }
  await transition(pot.id, "buying", { status: "cancelled" });
  await say(pot.id, "payout_failed", "PayPal couldn't send the payout, so every payment has been refunded in full.");
}

/** Refund every capture, void every hold and cancel. Used when the gift can't happen. */
export async function refundAndCancel(pot: any, line: string) {
  const d = await admin();
  const { refundCapture, voidAuthorization } = await pp();
  const { data: rows } = await d.from("contributions").select("id, status, capture_id, authorization_id, topup_capture_id").eq("pot_id", pot.id).in("status", [...HELD, "captured"]);
  for (const c of rows ?? []) {
    try {
      if (!c.capture_id && !c.authorization_id) {
        await d.from("contributions").update({ status: "voided" }).eq("id", c.id); // demo hold, nothing at PayPal
      } else if (c.status === "captured" && c.capture_id) {
        const r = await refundCapture(c.capture_id, `ref-${c.capture_id}-cancel`);
        if (c.topup_capture_id && c.topup_capture_id !== "demo") await refundCapture(c.topup_capture_id, `ref-${c.topup_capture_id}-cancel`);
        if (c.authorization_id) { try { await voidAuthorization(c.authorization_id, `void-rest-${c.id}`); } catch { /* fully captured or already closed */ } }
        await d.from("contributions").update({ status: "refunded", refund_id: r.id }).eq("id", c.id);
      } else if (c.authorization_id) {
        await voidAuthorization(c.authorization_id, `void-${c.id}`);
        await d.from("contributions").update({ status: "voided" }).eq("id", c.id);
      }
    } catch (e) { console.error("release failed", c.id, e); }
  }
  await d.from("pots").update({ status: "cancelled" }).eq("id", pot.id).in("status", ["collecting", "voting", "veto", "buying"]);
  await say(pot.id, "pot_cancelled", line);
}

/** Organiser or contributor cancel before buying: void every hold. */
export async function voidAllAndCancel(potId: string) {
  const d = await admin();
  const { voidAuthorization } = await pp();
  const { data: holds } = await d.from("contributions").select("id, authorization_id").eq("pot_id", potId).in("status", HELD);
  let released = 0;
  let failed = 0;
  for (const h of holds ?? []) {
    try {
      if (h.authorization_id) await voidAuthorization(h.authorization_id, `void-${h.id}`);
      await d.from("contributions").update({ status: "voided" }).eq("id", h.id);
      released++;
    } catch (e) {
      console.error("void failed", h.id, e);
      failed++;
    }
  }
  await d.from("decisions").update({ vetoed_at: new Date().toISOString() }).eq("pot_id", potId).is("vetoed_at", null);
  await d.from("pots").update({ status: "cancelled" }).eq("id", potId);
  await say(potId, "pot_cancelled", `Kitty's off. ${released} hold${released === 1 ? "" : "s"} released and nobody was charged.`, { released, failed });
  return { released, failed };
}

/** Pots the cron should look at. */
export async function duePots() {
  const d = await admin();
  const { data } = await d.from("pots").select("id, status, deadline_at").in("status", ["collecting", "voting", "veto", "buying"]).limit(200);
  return (data ?? []).map((p) => p.id);
}

// ---------- fixed split: no search, no vote, straight to the countdown once full ----------
async function closeFixed(pot: any, now: Date, raised: number) {
  const pick = (await rankedPicks(pot.id))[0];
  const money = (n: number) => formatMoney(n, pot.currency);
  if (!pick) {
    await say(pot.id, "close_waiting", "I don't have the gift's details yet. The organiser can add them from the manage page.");
    return;
  }
  if (cents(raised) < cents(Number(pick.price))) {
    const d = await admin();
    const { data: last } = await d.from("agent_events").select("kind").eq("pot_id", pot.id).order("at", { ascending: false }).limit(1);
    if (last?.[0]?.kind !== "fixed_short") await say(pot.id, "fixed_short", `We're at ${money(raised)} of ${money(Number(pick.price))} for the ${short(pick.title)}. The organiser can extend the deadline to give people more time.`);
    return;
  }
  if (await transition(pot.id, "collecting", { status: "veto", closed_at: now.toISOString(), vote_candidate_ids: [pick.id] })) {
    await say(pot.id, "fixed_full", `The pot's full for the ${short(pick.title)}. No vote needed, so the countdown starts now.`);
    await startVeto({ ...pot, status: "veto" }, pick, "organiser");
  }
}

// ---------- reminder nudge ----------
async function maybeDraftReminder(pot: any, now: Date) {
  if (!pot.reminders_enabled || pot.reminder_drafted_at) return;
  const created = new Date(pot.created_at);
  const due = reminderDueAt(created, new Date(pot.deadline_at), pot);
  if (now.getTime() < due.getTime()) return;
  if (now.getTime() >= effectiveDeadline(created, new Date(pot.deadline_at), pot).getTime()) return;
  const d = await admin();
  const { count } = await d.from("contributions").select("id", { count: "exact", head: true }).eq("pot_id", pot.id).in("status", [...HELD, "captured"]);
  const missing = Math.max(0, (pot.expected_count ?? 0) - (count ?? 0));
  // Claim the reminder atomically so overlapping ticks only draft once.
  const { data: won } = await d.from("pots").update({ reminder_drafted_at: now.toISOString() }).eq("id", pot.id).is("reminder_drafted_at", null).select("id");
  if (!won?.length || missing <= 0) return;
  const { draftNudge } = await import("./ai.server");
  const occ = OCCASIONS.find((o) => o.value === pot.occasion)?.noun ?? "";
  const text = await draftNudge({ name: pot.recipient_name, occasion: occ, missing });
  await d.from("reminders").insert({ pot_id: pot.id, draft_text: text, missing_count: missing });
  await say(pot.id, "reminder_drafted", `I drafted a nudge for the ${missing === 1 ? "1 person who hasn't" : `${missing} people who haven't`} chipped in yet.`);
}

/** Resolves to null if the promise takes longer than `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((res) => setTimeout(() => res(null), ms))]);
}
