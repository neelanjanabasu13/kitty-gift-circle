import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_CURRENCY } from "./config";
import { DEMO_FACTOR, effectiveDeadline, isDemoHold, scaleMs, storedDeadlineFor } from "./closing";

// All Kitty reads and writes run here with the server client. Public reads are keyed on slug and
// hide amounts/names per visibility; organiser actions require the pot's admin token.

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const pp = () => import("./paypal.server");
const closing = () => import("./closing.server");

function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
function makeSlug(name: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "kitty";
  return `${base}-${randomToken(3)}`;
}

async function logEvent(potId: string, kind: string, message: string, payload: Record<string, unknown> = {}) {
  const db = await admin();
  await db.from("agent_events").insert({ pot_id: potId, kind, message, payload: payload as any });
}

const LIVE = ["authorized", "reauthorized", "captured"];

// ---------- create pot ----------
const createPotSchema = z.object({
  recipient_name: z.string().trim().min(1).max(60),
  occasion: z.enum(["leaving", "birthday", "teacher_thank_you", "wedding", "new_baby", "other"]),
  closeness: z.enum(["close_friend", "family", "colleague", "kids_classmate", "teacher"]),
  likes: z.array(z.string().trim().min(1).max(30)).max(20),
  dislikes: z.array(z.string().trim().min(1).max(30)).max(20),
  wishlist_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  wishlist_image: z.object({ dataUrl: z.string().max(7_000_000), type: z.string().max(50) }).optional(),
  mode: z.enum(["pot_first", "fixed_split"]),
  target_amount: z.number().min(1).max(10000),
  deadline_at: z.string().datetime(),
  vote_window: z.enum(["off", "1h", "1d", "all_in"]),
  expected_count: z.number().int().min(1).max(500),
  organiser_name: z.string().trim().min(1).max(60),
  organiser_paypal_email: z.string().trim().email().max(200),
  demo_speed: z.boolean().optional(),
  product: z.object({
    title: z.string().trim().min(1).max(300),
    image_url: z.string().url().max(1000).nullable().optional(),
    retailer: z.string().max(120).nullable().optional(),
    price: z.number().min(1).max(10000),
    offer_url: z.string().url().max(1000),
    channel3_product_id: z.string().max(200).nullable().optional(),
  }).optional(),
});

export const createPot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createPotSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    if (new Date(data.deadline_at).getTime() < Date.now()) throw new Error("Pick a deadline in the future.");
    const slug = makeSlug(data.recipient_name);
    const admin_token = randomToken(24);

    let wishlist_image_path: string | null = null;
    if (data.wishlist_image) {
      const m = data.wishlist_image.dataUrl.match(/^data:(image\/(png|jpeg|webp|gif));base64,(.+)$/);
      if (!m) throw new Error("That screenshot needs to be a PNG, JPG or WebP image.");
      const bin = Uint8Array.from(atob(m[3] ?? ""), (c) => c.charCodeAt(0));
      const path = `${slug}/wishlist.${m[2] === "jpeg" ? "jpg" : (m[2] ?? "png")}`;
      const contentType = m[1] ?? "image/png";
      const { error } = await db.storage.from("wishlists").upload(path, bin, { contentType, upsert: true });
      if (error) throw new Error("We couldn't save the screenshot. Try a smaller image.");
      wishlist_image_path = path;
    }

    const { data: pot, error } = await db
      .from("pots")
      .insert({
        slug,
        admin_token,
        recipient_name: data.recipient_name,
        occasion: data.occasion,
        closeness: data.closeness,
        likes: data.likes,
        dislikes: data.dislikes,
        wishlist_url: data.wishlist_url || null,
        wishlist_image_path,
        mode: data.mode,
        target_amount: data.target_amount,
        currency: DEFAULT_CURRENCY,
        deadline_at: data.deadline_at,
        vote_window: data.vote_window,
        expected_count: data.expected_count,
        organiser_name: data.organiser_name,
        organiser_paypal_email: data.organiser_paypal_email,
        demo_speed: !!data.demo_speed,
        demo_factor: DEMO_FACTOR,
      })
      .select("id, slug, admin_token")
      .single();
    if (error || !pot) {
      console.error(error);
      throw new Error("We couldn't start the kitty just now. Please try again.");
    }
    await logEvent(pot.id, "pot_created", `${data.organiser_name} just set up a kitty for ${data.recipient_name}. I'm on it.`, {
      likes: data.likes,
      mode: data.mode,
    });
    if (data.mode === "fixed_split") {
      const pr = data.product;
      let host: string | null = null;
      if (data.wishlist_url) { try { host = new URL(data.wishlist_url).hostname.replace(/^www\./, ""); } catch { /* ignore */ } }
      await db.from("candidates").insert({
        pot_id: pot.id,
        channel3_product_id: pr?.channel3_product_id ?? null,
        title: pr?.title ?? `The gift ${data.organiser_name} picked`,
        image_url: pr?.image_url ?? null,
        offer_url: pr?.offer_url ?? (data.wishlist_url || null),
        retailer: pr?.retailer ?? host,
        price: pr?.price ?? data.target_amount,
        currency: DEFAULT_CURRENCY,
        category: "chosen",
        fit_score: 1,
        total_score: 1,
        rank: 1,
        reason: `${data.organiser_name} picked this one, so there's no vote.`,
        fetched_at: new Date().toISOString(),
      });
      await logEvent(pot.id, "fixed_gift", `${data.organiser_name} already knows the gift. I'll collect, then start the countdown once the pot's full.`);
    }
    if (data.demo_speed) await logEvent(pot.id, "demo_speed", "Demo speed is on, so an hour here passes in a minute.");
    if (data.likes.length) {
      await logEvent(pot.id, "profile_learned", `Noted: ${data.recipient_name} loves ${data.likes.slice(0, 3).join(", ")}.${data.dislikes.length ? ` I'll steer clear of ${data.dislikes.slice(0, 2).join(" and ")}.` : ""}`);
    }
    return { slug: pot.slug, adminToken: pot.admin_token };
  });

// ---------- read pot ----------
export type PublicContributor = {
  id: string;
  name: string | null;
  amount: number | null;
  visibility: "named" | "anonymous" | "amount_hidden";
  status: string;
  at: string;
  /** Added by the demo seed. */
  seeded: boolean;
  /** Seeded with no real sandbox authorization: never sent to PayPal. */
  demoHold: boolean;
};

async function loadPot(slug: string, adminToken?: string) {
  const db = await admin();
  const { data: pot } = await db.from("pots").select("*").eq("slug", slug).maybeSingle();
  if (!pot) return null;
  const isAdmin = !!adminToken && adminToken === pot.admin_token;

  const [{ data: contribs }, { data: sigs }, { data: events }, { data: votes }, { data: candidates }] = await Promise.all([
    db.from("contributions").select("id, display_name, visibility, amount, status, created_at, is_seeded, authorization_id").eq("pot_id", pot.id).in("status", LIVE).order("created_at"),
    db.from("card_signatures").select("id, name, message, created_at, contribution_id").eq("pot_id", pot.id).order("created_at"),
    db.from("agent_events").select("id, at, kind, message").eq("pot_id", pot.id).order("at", { ascending: false }).limit(30),
    db.from("category_votes").select("category").eq("pot_id", pot.id),
    db.from("candidates").select("id, title, image_url, offer_url, retailer, price, currency, category, reason, rank, band, fit_score, total_score").eq("pot_id", pot.id).order("rank", { nullsFirst: false }),
  ]);

  const live = contribs ?? [];
  const liveIds = new Set(live.map((c) => c.id));
  const raised = live.reduce((s, c) => s + Number(c.amount), 0);
  const contributors: PublicContributor[] = live.map((c) => ({
    id: c.id,
    visibility: c.visibility as PublicContributor["visibility"],
    name: c.visibility === "anonymous" && !isAdmin ? null : c.display_name || null,
    amount: c.visibility === "amount_hidden" && !isAdmin ? null : Number(c.amount),
    status: c.status,
    at: c.created_at,
    seeded: !!c.is_seeded,
    demoHold: isDemoHold(c),
  }));
  const voteTally: Record<string, number> = {};
  for (const v of votes ?? []) voteTally[v.category] = (voteTally[v.category] ?? 0) + 1;

  let wishlistImageUrl: string | null = null;
  if (isAdmin && pot.wishlist_image_path) {
    const { data: s } = await db.storage.from("wishlists").createSignedUrl(pot.wishlist_image_path, 3600);
    wishlistImageUrl = s?.signedUrl ?? null;
  }

  // ---------- closing state ----------
  const { currentDecision, voteState } = await closing();
  const dec = ["veto", "buying", "done"].includes(pot.status) ? await currentDecision(pot.id) : null;
  const candById = new Map((candidates ?? []).map((c) => [c.id, c]));
  let decision: null | { id: string; buy_at: string | null; why: string | null; decided_by: string | null; total_seconds: number | null; pick: { id: string; title: string; price: number; retailer: string | null; offer_url: string | null; image_url: string | null } | null } = null;
  if (dec) {
    const c = dec.candidate_id ? candById.get(dec.candidate_id) : undefined;
    decision = { id: dec.id, buy_at: dec.buy_at, why: dec.why, decided_by: dec.decided_by, total_seconds: dec.total_seconds, pick: c ? { id: c.id, title: c.title, price: Number(c.price), retailer: c.retailer, offer_url: c.offer_url, image_url: c.image_url } : null };
  }
  type SplitLine = { id: string; name: string | null; held: number | null; paid: number | null; released: number | null; demo: boolean };
  let split: null | { price: number; pot: number; lines: SplitLine[] } = null;
  if (["veto", "buying"].includes(pot.status) && decision?.pick) {
    const { splitLines } = await import("./closing");
    const holds = live.filter((c) => c.status === "authorized" || c.status === "reauthorized");
    const tot = holds.reduce((x, c) => x + Number(c.amount), 0);
    if (tot >= decision.pick.price) {
      const lines = splitLines(holds.map((h) => ({ id: h.id, amount: Number(h.amount) })), decision.pick.price);
      split = {
        price: decision.pick.price,
        pot: Math.round(tot * 100) / 100,
        lines: lines.map((l) => {
          const c = holds.find((h) => h.id === l.id)!;
          const hide = c.visibility === "amount_hidden" && !isAdmin;
          return { id: l.id, name: c.visibility === "anonymous" && !isAdmin ? null : c.display_name || null, held: hide ? null : l.held, paid: hide ? null : l.paid, released: hide ? null : l.released, demo: !!c.is_seeded };
        }),
      };
    }
  }
  const vs = pot.status === "voting" ? await voteState(pot) : null;
  const vote = vs
    ? { closesAt: pot.vote_closes_at as string | null, eligible: vs.eligible, voted: vs.voted, picks: vs.ids.map((id) => candById.get(id)).filter(Boolean).map((c) => ({ id: c!.id, title: c!.title, price: Number(c!.price), retailer: c!.retailer, image_url: c!.image_url, total_score: c!.total_score != null ? Number(c!.total_score) : null, votes: vs.tally[c!.id] ?? 0 })) }
    : null;

  let receipt: null | {
    gift: { title: string; retailer: string | null; price: number; offer_url: string | null; image_url: string | null } | null;
    held: number; paid: number; released: number;
    payments: { id: string; name: string | null; amount: number | null; capture_id: string | null; seeded: boolean; demoHold: boolean }[];
    payout: { batch_id: string | null; item_id: string | null; status: string | null; amount: number | null; buy_url: string | null } | null;
  } = null;
  if (pot.status === "done") {
    const [{ data: paidRows }, { data: po }] = await Promise.all([
      db.from("contributions").select("id, display_name, visibility, amount, captured_amount, capture_id, status, is_seeded, authorization_id").eq("pot_id", pot.id).in("status", ["captured", "voided"]).not("planned_capture", "is", null).order("created_at"),
      db.from("payouts").select("*").eq("pot_id", pot.id).maybeSingle(),
    ]);
    const rows = paidRows ?? [];
    const held = rows.reduce((s, r) => s + Number(r.amount), 0);
    const paid = rows.filter((r) => r.status === "captured").reduce((s, r) => s + Number(r.captured_amount ?? 0), 0);
    split = {
      price: Math.round(paid * 100) / 100,
      pot: Math.round(held * 100) / 100,
      lines: rows.map((r) => {
        const hide = r.visibility === "amount_hidden" && !isAdmin;
        const p = r.status === "captured" ? Number(r.captured_amount ?? 0) : 0;
        return { id: r.id, name: r.visibility === "anonymous" && !isAdmin ? null : r.display_name || null, held: hide ? null : Number(r.amount), paid: hide ? null : p, released: hide ? null : Math.round((Number(r.amount) - p) * 100) / 100, demo: !!r.is_seeded };
      }),
    };
    receipt = {
      gift: decision?.pick ? { title: decision.pick.title, retailer: decision.pick.retailer, price: decision.pick.price, offer_url: po?.buy_url ?? decision.pick.offer_url, image_url: decision.pick.image_url } : null,
      held: Math.round(held * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      released: Math.max(0, Math.round((held - paid) * 100) / 100),
      payments: rows.filter((r) => r.status === "captured").map((r) => ({
        id: r.id,
        name: r.visibility === "anonymous" && !isAdmin ? null : r.display_name || null,
        amount: r.visibility === "amount_hidden" && !isAdmin ? null : Number(r.captured_amount ?? 0),
        capture_id: r.capture_id,
        seeded: !!r.is_seeded,
        demoHold: isDemoHold(r),
      })),
      payout: po ? { batch_id: po.payout_batch_id, item_id: po.item_id, status: po.status, amount: po.amount != null ? Number(po.amount) : null, buy_url: po.buy_url } : null,
    };
  }

  return {
    isAdmin,
    pot: {
      id: pot.id,
      slug: pot.slug,
      recipient_name: pot.recipient_name,
      occasion: pot.occasion,
      closeness: pot.closeness,
      likes: pot.likes,
      dislikes: isAdmin ? pot.dislikes : [],
      wishlist_url: pot.wishlist_url,
      mode: pot.mode,
      target_amount: Number(pot.target_amount),
      currency: pot.currency,
      // The deadline on the pot's own clock (compressed at demo speed). Every screen reads this one.
      deadline_at: effectiveDeadline(new Date(pot.created_at), new Date(pot.deadline_at), pot).toISOString(),
      demo_factor: pot.demo_factor,
      is_demo: pot.is_demo,
      vote_window: pot.vote_window,
      expected_count: pot.expected_count,
      organiser_name: pot.organiser_name,
      organiser_paypal_email: isAdmin ? pot.organiser_paypal_email : null,
      status: pot.status,
      reminders_enabled: pot.reminders_enabled,
      agent_working: pot.agent_working,
      agent_busy: !!pot.agent_lock_at && Date.now() - new Date(pot.agent_lock_at).getTime() < 120_000,
      created_at: pot.created_at,
      demo_speed: pot.demo_speed,
      closed_at: pot.closed_at,
    },
    decision,
    vote,
    receipt,
    reminder: isAdmin ? await latestReminder(pot.id) : null,
    // Which services are switched on (booleans only, never values), so screens can explain calmly.
    config: { paypal: !!process.env["PAYPAL_CLIENT_ID"] && !!process.env["PAYPAL_CLIENT_SECRET"], shop: !!process.env["CHANNEL3_API_KEY"] },
    split,
    wishlistImageUrl,
    raised,
    people: live.length,
    contributors,
    signatures: (sigs ?? []).filter((s) => !s.contribution_id || liveIds.has(s.contribution_id)).map(({ contribution_id: _c, ...s }) => s),
    events: events ?? [],
    voteTally,
    candidates: (candidates ?? []).map((c) => ({ ...c, price: c.price != null ? Number(c.price) : null, fit_score: c.fit_score != null ? Number(c.fit_score) : null })),
  };
}

async function latestReminder(potId: string) {
  const db = await admin();
  const { data } = await db.from("reminders").select("id, draft_text, approved_at, missing_count, created_at").eq("pot_id", potId).order("created_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export type PotView = NonNullable<Awaited<ReturnType<typeof loadPot>>>;

export const getPot = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80), adminToken: z.string().max(100).optional() }).parse(d))
  .handler(async ({ data }) => loadPot(data.slug, data.adminToken));

// ---------- PayPal public config ----------
export const getPayPalClientId = createServerFn({ method: "GET" }).handler(async () => {
  return { clientId: process.env["PAYPAL_CLIENT_ID"] ?? null };
});

// ---------- create contribution order ----------
const contribSchema = z.object({
  slug: z.string().min(1).max(80),
  amount: z.number().min(1).max(1000),
  display_name: z.string().trim().max(60),
  visibility: z.enum(["named", "anonymous", "amount_hidden"]),
  categories: z.array(z.string().trim().min(1).max(30)).max(5),
  signature: z.object({ name: z.string().trim().min(1).max(60), message: z.string().trim().min(1).max(280) }).optional(),
});

export const createContributionOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => contribSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: pot } = await db.from("pots").select("id, status, currency, recipient_name, deadline_at, created_at, demo_speed, demo_factor").eq("slug", data.slug).maybeSingle();
    if (!pot) throw new Error("We can't find this kitty. Check the link with the organiser.");
    if (pot.status !== "collecting") throw new Error("This kitty isn't taking contributions any more.");
    if (effectiveDeadline(new Date(pot.created_at), new Date(pot.deadline_at), pot).getTime() < Date.now()) throw new Error("The deadline for this kitty has passed.");
    if (data.visibility !== "anonymous" && !data.display_name) throw new Error("Add your name, or choose Anonymous.");

    const amount = Math.round(data.amount * 100) / 100;
    const { data: c, error } = await db
      .from("contributions")
      .insert({ pot_id: pot.id, amount, display_name: data.display_name, visibility: data.visibility, status: "created" })
      .select("id")
      .single();
    if (error || !c) throw new Error("We couldn't start your hold. Please try again.");

    const { createAuthorizeOrder, plainPayPalError } = await pp();
    try {
      const order = await createAuthorizeOrder({
        amount,
        currency: pot.currency,
        customId: c.id,
        description: `Kitty for ${pot.recipient_name} (hold only)`,
        requestId: `order-${c.id}`,
      });
      await db.from("contributions").update({ paypal_order_id: order.id }).eq("id", c.id);
      // Stash vote + signature against the pending contribution; they only show once the hold is live.
      if (data.categories.length) {
        await db.from("category_votes").insert(data.categories.map((category) => ({ pot_id: pot.id, contribution_id: c.id, category })));
      }
      if (data.signature) {
        await db.from("card_signatures").insert({ pot_id: pot.id, contribution_id: c.id, ...data.signature });
      }
      return { orderId: order.id, contributionId: c.id };
    } catch (e) {
      await db.from("contributions").update({ status: "failed" }).eq("id", c.id);
      throw new Error(plainPayPalError(e));
    }
  });

// ---------- authorize ----------
export const authorizeContribution = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().min(5).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: c } = await db.from("contributions").select("id, pot_id, amount, status, display_name, visibility, authorization_id").eq("paypal_order_id", data.orderId).maybeSingle();
    if (!c) throw new Error("We couldn't match that PayPal payment to this kitty.");
    if (c.status === "authorized") return { ok: true, amount: Number(c.amount), contributionId: c.id, authorizationId: c.authorization_id };
    // Late chip-in: an order started before the deadline but approved after it never becomes a hold.
    const { data: lp } = await db.from("pots").select("status, created_at, deadline_at, demo_speed, demo_factor").eq("id", c.pot_id).single();
    if (!lp || lp.status !== "collecting" || effectiveDeadline(new Date(lp.created_at), new Date(lp.deadline_at), lp).getTime() < Date.now()) {
      await db.from("contributions").update({ status: "failed" }).eq("id", c.id);
      throw new Error("Sorry, this kitty closed before your hold went through. Nothing was taken from your account.");
    }

    const { authorizeOrder, plainPayPalError } = await pp();
    try {
      const r = await authorizeOrder(data.orderId);
      if (!r.authorizationId) throw new Error("PayPal didn't confirm the hold. Nothing has been taken.");
      await db
        .from("contributions")
        .update({
          status: "authorized",
          authorization_id: r.authorizationId,
          auth_expires_at: r.expiresAt ?? null,
          honor_expires_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
        })
        .eq("id", c.id);

      const { data: pot } = await db.from("pots").select("target_amount, currency, expected_count").eq("id", c.pot_id).single();
      const { data: live } = await db.from("contributions").select("amount").eq("pot_id", c.pot_id).in("status", LIVE);
      const raised = (live ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const who = c.visibility === "anonymous" ? "Someone" : c.display_name || "Someone";
      const amt = c.visibility === "amount_hidden" ? "a hold" : `a ${pot?.currency === "USD" ? "$" : "£"}${Number(c.amount)} hold`;
      await logEvent(c.pot_id, "contribution_held", `${who} just chipped in${c.visibility === "amount_hidden" ? "" : ` ${amt.replace(/^a /, "").replace(/ hold$/, "")}`}. That gets us to ${pot?.currency === "USD" ? "$" : "£"}${Math.round(raised * 100) / 100}. Held, not charged.`);
      if (pot && raised >= Number(pot.target_amount)) {
        await logEvent(c.pot_id, "target_reached", "We've hit the target! I'll start lining up the final picks.");
      }
      return { ok: true, amount: Number(c.amount), contributionId: c.id, authorizationId: r.authorizationId as string | null };
    } catch (e) {
      await db.from("contributions").update({ status: "failed" }).eq("id", c.id);
      throw new Error(plainPayPalError(e));
    }
  });

// ---------- withdraw (contributor) ----------
export const withdrawContribution = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ contributionId: z.string().uuid(), orderId: z.string().min(5).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: c } = await db
      .from("contributions")
      .select("id, pot_id, amount, status, authorization_id, paypal_order_id, display_name, visibility")
      .eq("id", data.contributionId)
      .maybeSingle();
    // The PayPal order id acts as the contributor's proof of ownership.
    if (!c || c.paypal_order_id !== data.orderId) throw new Error("We couldn't find that hold.");
    const { data: pot } = await db.from("pots").select("status").eq("id", c.pot_id).single();
    if (pot?.status !== "collecting") throw new Error("The kitty has moved on, so holds can't be withdrawn now.");
    if (c.status === "voided") return { ok: true };
    if (!c.authorization_id) throw new Error("There's no hold to release.");
    const { voidAuthorization, plainPayPalError } = await pp();
    try {
      await voidAuthorization(c.authorization_id, `void-${c.id}`);
    } catch (e) {
      throw new Error(plainPayPalError(e));
    }
    await db.from("contributions").update({ status: "voided" }).eq("id", c.id);
    const who = c.visibility === "anonymous" ? "Someone" : c.display_name || "Someone";
    await logEvent(c.pot_id, "contribution_withdrawn", `${who} stepped out. Their hold's been released and nothing was charged.`);
    return { ok: true };
  });

// ---------- organiser actions ----------
async function requireAdmin(slug: string, token: string) {
  const db = await admin();
  const { data: pot } = await db.from("pots").select("id, admin_token, status, recipient_name").eq("slug", slug).maybeSingle();
  if (!pot || pot.admin_token !== token) throw new Error("This manage link isn't valid.");
  return pot;
}

export const cancelPot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), adminToken: z.string().max(100) }).parse(d))
  .handler(async ({ data }) => {
    const pot = await requireAdmin(data.slug, data.adminToken);
    if (pot.status === "cancelled") return { released: 0, failed: 0 };
    if (!["collecting", "voting", "veto"].includes(pot.status)) throw new Error("Kitty has already bought the gift, so it can't be cancelled.");
    const { voidAllAndCancel } = await closing();
    const { released, failed } = await voidAllAndCancel(pot.id);
    return { released, failed };
  });

export const setReminders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), adminToken: z.string().max(100), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const pot = await requireAdmin(data.slug, data.adminToken);
    const db = await admin();
    await db.from("pots").update({ reminders_enabled: data.enabled }).eq("id", pot.id);
    return { enabled: data.enabled };
  });

// ---------- health check ----------
export const healthCheck = createServerFn({ method: "POST" }).handler(async () => {
  const secrets = {
    PAYPAL_CLIENT_ID: !!process.env["PAYPAL_CLIENT_ID"],
    PAYPAL_CLIENT_SECRET: !!process.env["PAYPAL_CLIENT_SECRET"],
    CHANNEL3_API_KEY: !!process.env["CHANNEL3_API_KEY"],
  };
  const result: {
    secrets: typeof secrets;
    currency: string;
    token: { ok: boolean; error?: string };
    order: { ok: boolean; id?: string; status?: string; error?: string };
    database: { ok: boolean; error?: string };
    shop: { ok: boolean; offers?: number; products?: number; error?: string };
    ai: { ok: boolean; error?: string };
  } = { secrets, currency: DEFAULT_CURRENCY, token: { ok: false }, order: { ok: false }, database: { ok: false }, shop: { ok: false }, ai: { ok: false } };

  // Channel3 test search (GB): count in-stock GBP offers from UK retailers.
  const { searchProducts } = await import("./channel3.server");
  const sr = await searchProducts({ query: "ceramic coffee mug", potId: "health-check", minPrice: 5, maxPrice: 80, limit: 10 });
  if (sr.status === "ok") {
    const offers = sr.products.flatMap((p) => p.offers).filter((o) => o.inStock && o.currency === "GBP" && /\.uk$/i.test(o.domain));
    result.shop = { ok: true, products: sr.products.length, offers: offers.length };
  } else result.shop = { ok: false, error: sr.status === "not_configured" ? "key missing" : sr.message };

  // Lovable AI check: one tiny completion.
  try {
    const { generateChatCompletion } = await import("@lovable.dev/ai-gateway");
    const r = await generateChatCompletion({ model: "google/gemini-3.1-flash-lite", messages: [{ role: "user", content: "Reply with the single word: ok" }] });
    const c = (r as any)?.choices?.[0]?.message?.content;
    result.ai = c ? { ok: true } : { ok: false, error: "empty reply" };
  } catch (e) {
    result.ai = { ok: false, error: e instanceof Error ? e.message.slice(0, 80) : "unreachable" };
  }

  try {
    const db = await admin();
    const { error } = await db.from("pots").select("id", { head: true, count: "exact" });
    result.database = error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    result.database = { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }

  const { getPayPalToken, createAuthorizeOrder, PayPalError } = await pp();
  try {
    await getPayPalToken();
    result.token = { ok: true };
  } catch (e) {
    result.token = { ok: false, error: e instanceof PayPalError ? `HTTP ${e.status}` : e instanceof Error ? e.message : "unknown" };
    return result;
  }
  try {
    const o = await createAuthorizeOrder({ amount: 1, currency: DEFAULT_CURRENCY, customId: "health-check", description: "Kitty health check", requestId: `health-${randomToken(8)}` });
    result.order = { ok: true, id: o.id, status: o.status };
  } catch (e) {
    result.order = { ok: false, error: e instanceof PayPalError ? `HTTP ${e.status}` : "unknown" };
  }
  return result;
});

// ---------- agent triggers ----------
const agent = () => import("./agent.server");

/** Fired by the contributor page after a hold is placed or withdrawn. Runs the agent to completion. */
export const triggerAgent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ contributionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: c } = await db.from("contributions").select("pot_id, status, display_name, visibility, created_at").eq("id", data.contributionId).maybeSingle();
    if (!c) return { status: "ignored" as const };
    if (Date.now() - new Date(c.created_at).getTime() > 3 * 86400_000) return { status: "ignored" as const };
    const kind = c.status === "voided" ? "withdrawn" : LIVE.includes(c.status) ? "authorized" : null;
    if (!kind) return { status: "ignored" as const };
    const who = c.visibility === "anonymous" ? "someone" : c.display_name || "someone";
    const { runAgent } = await agent();
    return runAgent(c.pot_id, { kind, who });
  });

export const runKittyNow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), adminToken: z.string().max(100) }).parse(d))
  .handler(async ({ data }) => {
    const pot = await requireAdmin(data.slug, data.adminToken);
    const db = await admin();
    const { data: full } = await db.from("pots").select("status, created_at, deadline_at, demo_speed, demo_factor").eq("id", pot.id).single();
    const locked = !full || full.status !== "collecting" || effectiveDeadline(new Date(full.created_at), new Date(full.deadline_at), full).getTime() <= Date.now();
    if (!locked) await logEvent(pot.id, "manual_run", "Taking another look, as asked.");
    const { runAgent } = await agent();
    const r = await runAgent(pot.id, { kind: "manual" });
    const { tickPot: tick } = await closing();
    await tick(pot.id);
    return r;
  });

export const updatePotProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string().max(80),
      adminToken: z.string().max(100),
      likes: z.array(z.string().trim().min(1).max(30)).max(20),
      dislikes: z.array(z.string().trim().min(1).max(30)).max(20),
      wishlist_url: z.string().trim().url().max(500).or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const pot = await requireAdmin(data.slug, data.adminToken);
    const db = await admin();
    await db.from("pots").update({ likes: data.likes, dislikes: data.dislikes, wishlist_url: data.wishlist_url || null }).eq("id", pot.id);
    await logEvent(pot.id, "profile_updated", `Got it, I've updated what ${pot.recipient_name} is into. Starting the search again from scratch.`);
    const { runAgent } = await agent();
    return runAgent(pot.id, { kind: "replan" });
  });

// ---------- closing: tick, vote, veto, extend ----------
export const tickPot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: pot } = await db.from("pots").select("id, status").eq("slug", data.slug).maybeSingle();
    if (!pot) return { status: "missing" };
    if (["done", "cancelled"].includes(pot.status)) return { status: pot.status };
    const { tickPot: tick } = await closing();
    return tick(pot.id);
  });

async function ownContribution(contributionId: string, orderId: string) {
  const db = await admin();
  const { data: c } = await db.from("contributions").select("id, pot_id, status, paypal_order_id").eq("id", contributionId).maybeSingle();
  if (!c || c.paypal_order_id !== orderId) throw new Error("We couldn't find your hold on this kitty.");
  return c;
}

export const castFinalVote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ contributionId: z.string().uuid(), orderId: z.string().min(5).max(60), candidateId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const c = await ownContribution(data.contributionId, data.orderId);
    if (!["authorized", "reauthorized"].includes(c.status)) throw new Error("Only people with a live hold can vote.");
    const db = await admin();
    const { data: pot } = await db.from("pots").select("id, status, vote_candidate_ids").eq("id", c.pot_id).single();
    if (pot?.status !== "voting") throw new Error("The vote has closed.");
    if (data.candidateId === null) {
      await db.from("contributions").update({ final_vote_opt_out: true }).eq("id", c.id);
      await db.from("final_votes").delete().eq("contribution_id", c.id);
    } else {
      if (!(pot.vote_candidate_ids ?? []).includes(data.candidateId)) throw new Error("That pick isn't in the vote.");
      await db.from("contributions").update({ final_vote_opt_out: false }).eq("id", c.id);
      const { error } = await db.from("final_votes").upsert({ pot_id: pot.id, contribution_id: c.id, candidate_id: data.candidateId }, { onConflict: "contribution_id" });
      if (error) throw new Error("Your vote didn't save. Try again.");
    }
    const { tickPot: tick } = await closing();
    await tick(pot.id);
    return { ok: true };
  });

export const getMyVote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ contributionId: z.string().uuid(), orderId: z.string().min(5).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const c = await ownContribution(data.contributionId, data.orderId);
    const db = await admin();
    const [{ data: v }, { data: me }] = await Promise.all([
      db.from("final_votes").select("candidate_id").eq("contribution_id", c.id).maybeSingle(),
      db.from("contributions").select("final_vote_opt_out, status, captured_amount, amount").eq("id", c.id).single(),
    ]);
    return { candidateId: v?.candidate_id ?? null, optedOut: !!me?.final_vote_opt_out, status: me?.status ?? c.status, captured: me?.captured_amount != null ? Number(me.captured_amount) : null };
  });

export const organiserDecide = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().max(80), adminToken: z.string().max(100), action: z.enum(["swap", "buy_now", "cancel"]), candidateId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const p = await requireAdmin(data.slug, data.adminToken);
    const db = await admin();
    const { data: pot } = await db.from("pots").select("*").eq("id", p.id).single();
    const c = await closing();
    if (data.action === "cancel") {
      if (!["collecting", "voting", "veto"].includes(pot!.status)) throw new Error("Kitty is already buying, so it can't be cancelled now.");
      await logEvent(pot!.id, "vetoed", `${pot!.organiser_name} vetoed the gift and called the kitty off.`);
      return c.voidAllAndCancel(pot!.id);
    }
    if (pot!.status !== "veto") throw new Error("There's no countdown running right now.");
    const dec = await c.currentDecision(pot!.id);
    if (data.action === "buy_now") {
      if (dec) await db.from("decisions").update({ buy_at: new Date().toISOString() }).eq("id", dec.id);
      await logEvent(pot!.id, "buy_now", `${pot!.organiser_name} said go for it. Buying now.`);
      await c.tickPot(pot!.id);
      return { released: 0, failed: 0 };
    }
    if (!data.candidateId || data.candidateId === dec?.candidate_id) throw new Error("Pick a different gift to swap to.");
    const { data: pick } = await db.from("candidates").select("*").eq("id", data.candidateId).eq("pot_id", pot!.id).single();
    const { data: live } = await db.from("contributions").select("amount").eq("pot_id", pot!.id).in("status", ["authorized", "reauthorized"]);
    const total = (live ?? []).reduce((s, x) => s + Number(x.amount), 0);
    if (!pick || Number(pick.price) > total) throw new Error("The pot doesn't cover that gift.");
    await logEvent(pot!.id, "swapped", `${pot!.organiser_name} swapped to the ${pick.title.slice(0, 60)}. I've restarted the countdown.`);
    await c.startVeto(pot, pick, "organiser", undefined, { from: dec });
    return { released: 0, failed: 0 };
  });

export const extendDeadline = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), adminToken: z.string().max(100), days: z.union([z.literal(1), z.literal(3)]) }).parse(d))
  .handler(async ({ data }) => {
    const p = await requireAdmin(data.slug, data.adminToken);
    const db = await admin();
    const { data: pot } = await db.from("pots").select("*").eq("id", p.id).single();
    if (!["collecting", "voting", "veto"].includes(pot!.status)) throw new Error("It's too late to extend this kitty.");
    const { data: live } = await db.from("contributions").select("amount").eq("pot_id", pot!.id).in("status", ["authorized", "reauthorized"]);
    const total = (live ?? []).reduce((s, x) => s + Number(x.amount), 0);
    if (total >= Number(pot!.target_amount)) throw new Error("The pot's already full, so there's nothing to wait for.");
    // Extend on the pot's own clock: at demo speed +1 day is +24 minutes.
    const created = new Date(pot!.created_at);
    const eff = effectiveDeadline(created, new Date(pot!.deadline_at), pot!);
    const target = new Date(Math.max(Date.now(), eff.getTime()) + scaleMs(data.days * 86400_000, pot!));
    const deadline = storedDeadlineFor(created, target, pot!).toISOString();
    await db.from("decisions").update({ vetoed_at: new Date().toISOString() }).eq("pot_id", pot!.id).is("vetoed_at", null);
    await db.from("final_votes").delete().eq("pot_id", pot!.id);
    await db.from("pots").update({ status: "collecting", deadline_at: deadline, vote_closes_at: null, vote_candidate_ids: [], close_search_at: null }).eq("id", pot!.id);
    await logEvent(pot!.id, "extended", `Deadline pushed back ${data.days === 1 ? "a day" : "3 days"}. Kitty's collecting again, and every hold is still only held.`);
    return { deadline };
  });

/** A contributor's own numbers under the surplus rule, even when their amount is hidden from others. */
export const getMySplit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ contributionId: z.string().uuid(), orderId: z.string().min(5).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const c = await ownContribution(data.contributionId, data.orderId);
    const db = await admin();
    const { data: me } = await db.from("contributions").select("amount, captured_amount, status, paypal_order_id, authorization_id, capture_id").eq("id", c.id).single();
    return {
      held: Number(me?.amount ?? 0),
      paid: me?.captured_amount != null ? Number(me.captured_amount) : null,
      status: me?.status ?? c.status,
      orderId: me?.paypal_order_id ?? null,
      authorizationId: me?.authorization_id ?? null,
      captureId: me?.capture_id ?? null,
    };
  });

// ---------- Phase 4: demo world ----------
export const setDemoSpeed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), adminToken: z.string().max(100), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const p = await requireAdmin(data.slug, data.adminToken);
    const db = await admin();
    const { data: pot } = await db.from("pots").select("created_at, deadline_at, demo_speed, demo_factor").eq("id", p.id).single();
    if (!pot || pot.demo_speed === data.enabled) return { enabled: data.enabled };
    // Keep the deadline the organiser sees where it is: re-express it on the new clock.
    const created = new Date(pot.created_at);
    const eff = effectiveDeadline(created, new Date(pot.deadline_at), pot);
    const deadline_at = storedDeadlineFor(created, eff, { demo: data.enabled, factor: pot.demo_factor || DEMO_FACTOR }).toISOString();
    await db.from("pots").update({ demo_speed: data.enabled, deadline_at }).eq("id", p.id);
    await logEvent(p.id, "demo_speed", data.enabled ? "Demo speed is on, so an hour here passes in a minute." : "Demo speed is off. Back to real time.");
    return { enabled: data.enabled };
  });

const SEEDS: { name: string; amount: number; visibility: "named" | "anonymous" | "amount_hidden"; message?: string; vote?: string }[] = [
  { name: "Sam", amount: 10, visibility: "named", message: "Priya! The kitchen won't be the same without you. Come back and cook for us.", vote: "cooking" },
  { name: "Aisha", amount: 15, visibility: "named", message: "Thank you for every coffee run and every kind word. Good luck!", vote: "coffee" },
  { name: "Tom", amount: 10, visibility: "amount_hidden", message: "You made Mondays bearable. Go and be brilliant.", vote: "cooking" },
  { name: "Mei", amount: 12, visibility: "named", message: "Miss you already. Send pictures of everything you make.", vote: "ceramics" },
  { name: "Jonah", amount: 10, visibility: "named", vote: "cooking" },
  { name: "", amount: 8, visibility: "anonymous", message: "Thanks for always having time for the new starters." },
  { name: "Ravi", amount: 15, visibility: "named", message: "Best desk neighbour I've ever had. Keep in touch!", vote: "coffee" },
  { name: "Grace", amount: 10, visibility: "named", message: "Wishing you the happiest next chapter, Priya." },
  { name: "Leo", amount: 8, visibility: "amount_hidden", vote: "ceramics" },
];

async function insertSeeds(potId: string) {
  const db = await admin();
  const now = Date.now();
  for (const [i, s] of SEEDS.entries()) {
    const { data: c } = await db
      .from("contributions")
      .insert({ pot_id: potId, display_name: s.name, visibility: s.visibility, amount: s.amount, status: "authorized", is_seeded: true, created_at: new Date(now - (SEEDS.length - i) * 60_000).toISOString() })
      .select("id")
      .single();
    if (!c) continue;
    if (s.message) await db.from("card_signatures").insert({ pot_id: potId, contribution_id: c.id, name: s.name || "Someone", message: s.message });
    if (s.vote) await db.from("category_votes").insert({ pot_id: potId, contribution_id: c.id, category: s.vote });
  }
  const total = SEEDS.reduce((x, s) => x + s.amount, 0);
  await logEvent(potId, "demo_seeded", `I've added ${SEEDS.length} demo chip-ins, £${total} in all, so you can watch me work. They're demo holds, not real PayPal holds, so they're never charged.`);
}

async function requireDemo(slug: string, token: string) {
  const p = await requireAdmin(slug, token);
  const db = await admin();
  const { data: pot } = await db.from("pots").select("*").eq("id", p.id).single();
  if (!pot?.is_demo) throw new Error("This only works on the demo pot.");
  return pot;
}

/**
 * Creates the Priya demo pot (no token) or tops up seeds on an existing demo pot (its admin token).
 * Seeded rows are is_seeded and carry no authorization, so capture and void never send them to PayPal.
 */
export const seedDemoPot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80).optional(), adminToken: z.string().max(100).optional() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    if (data.slug && data.adminToken) {
      const pot = await requireDemo(data.slug, data.adminToken);
      const { count } = await db.from("contributions").select("id", { count: "exact", head: true }).eq("pot_id", pot.id).eq("is_seeded", true);
      if (!count) await insertSeeds(pot.id);
      return { slug: pot.slug, adminToken: pot.admin_token };
    }
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count: recent } = await db.from("pots").select("id", { count: "exact", head: true }).eq("is_demo", true).gte("created_at", since);
    if ((recent ?? 0) >= 20) throw new Error("Lots of demo pots were started just now. Try again in a little while.");
    const slug = makeSlug("priya-demo");
    const admin_token = randomToken(24);
    const created = new Date();
    const { data: pot, error } = await db
      .from("pots")
      .insert({
        slug, admin_token, is_demo: true, demo_speed: true, demo_factor: DEMO_FACTOR,
        recipient_name: "Priya", occasion: "leaving", closeness: "colleague",
        likes: ["cooking", "ceramics", "coffee"], dislikes: ["scented things"],
        mode: "pot_first", target_amount: 120, currency: DEFAULT_CURRENCY, expected_count: 12, vote_window: "1h",
        // Two days on the pot's clock: 48 minutes at demo speed, with the nudge due at 24.
        deadline_at: new Date(created.getTime() + 2 * 86400_000).toISOString(), created_at: created.toISOString(),
        organiser_name: "Alex", organiser_paypal_email: "demo-organiser@example.com",
      })
      .select("id, slug, admin_token")
      .single();
    if (error || !pot) {
      console.error(error);
      throw new Error("We couldn't start the demo pot just now.");
    }
    await logEvent(pot.id, "pot_created", "Alex just set up a kitty for Priya's leaving do. I'm on it.");
    await logEvent(pot.id, "profile_learned", "Noted: Priya loves cooking, ceramics and coffee. I'll steer clear of scented things.");
    await insertSeeds(pot.id);
    const { runAgent } = await import("./agent.server");
    await runAgent(pot.id, { kind: "manual" });
    return { slug: pot.slug, adminToken: pot.admin_token };
  });

/** Releases any real sandbox holds on the demo pot, wipes it and seeds it again from scratch. */
export const resetDemoPot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), adminToken: z.string().max(100) }).parse(d))
  .handler(async ({ data }) => {
    const pot = await requireDemo(data.slug, data.adminToken);
    const db = await admin();
    const { voidAuthorization, refundCapture } = await pp();
    const { data: rows } = await db.from("contributions").select("id, status, authorization_id, capture_id, is_seeded").eq("pot_id", pot.id);
    let released = 0;
    for (const c of rows ?? []) {
      if (isDemoHold(c)) continue; // never sent to PayPal
      try {
        if (c.status === "captured" && c.capture_id) { await refundCapture(c.capture_id, `ref-${c.capture_id}-reset`); released++; }
        else if (["authorized", "reauthorized"].includes(c.status) && c.authorization_id) { await voidAuthorization(c.authorization_id, `void-${c.id}`); released++; }
      } catch (e) { console.error("reset release failed", c.id, e); }
    }
    for (const t of ["final_votes", "decisions", "payouts", "reminders", "card_signatures", "category_votes", "candidates", "agent_events"] as const) {
      await db.from(t).delete().eq("pot_id", pot.id);
    }
    await db.from("contributions").delete().eq("pot_id", pot.id);
    const created = new Date();
    await db.from("pots").update({
      status: "collecting", created_at: created.toISOString(), deadline_at: new Date(created.getTime() + 2 * 86400_000).toISOString(),
      demo_speed: true, closed_at: null, vote_closes_at: null, vote_candidate_ids: [], close_search_at: null,
      last_search_band: 0, last_top_categories: [], agent_lock_at: null, agent_pending: false, agent_working: null,
      tick_lock_at: null, reminder_drafted_at: null,
    }).eq("id", pot.id);
    await logEvent(pot.id, "demo_reset", `Fresh start.${released ? ` I released ${released} real sandbox hold${released === 1 ? "" : "s"} first, and nobody was charged.` : ""}`);
    await insertSeeds(pot.id);
    const { runAgent } = await import("./agent.server");
    await runAgent(pot.id, { kind: "manual" });
    return { released };
  });

// ---------- reminder nudge ----------
export const approveReminder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), adminToken: z.string().max(100), reminderId: z.string().uuid(), text: z.string().trim().min(5).max(400) }).parse(d))
  .handler(async ({ data }) => {
    const p = await requireAdmin(data.slug, data.adminToken);
    const db = await admin();
    const { data: r } = await db.from("reminders").update({ draft_text: data.text, approved_at: new Date().toISOString() }).eq("id", data.reminderId).eq("pot_id", p.id).select("id").maybeSingle();
    if (!r) throw new Error("We couldn't find that nudge.");
    return { ok: true };
  });

// ---------- fixed split: read a product from its link ----------
export const lookupProductUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ url: z.string().trim().url().max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const { lookupByUrl } = await import("./channel3.server");
    const r = await lookupByUrl(data.url);
    if (r.status !== "ok" || !r.product) return { ok: false as const, reason: r.status === "not_configured" ? "not_configured" : "not_found" };
    const p = r.product;
    let host: string | null = null;
    try { host = new URL(data.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    const offer = p.offers.find((o) => o.domain === host) ?? p.offers.filter((o) => o.inStock).sort((a, b) => a.price - b.price)[0] ?? p.offers[0];
    if (!offer) return { ok: false as const, reason: "not_found" };
    // Lookup has no country setting, so a shop may answer in another currency; never fill a price we can't use.
    if (offer.currency !== DEFAULT_CURRENCY) return { ok: false as const, reason: "not_found" };
    return { ok: true as const, product: { title: p.title, image_url: p.image, retailer: offer.domain, price: offer.price, offer_url: offer.url, channel3_product_id: p.id } };
  });
