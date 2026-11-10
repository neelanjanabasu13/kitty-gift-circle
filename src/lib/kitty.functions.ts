import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_CURRENCY } from "./config";

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
      })
      .select("id, slug, admin_token")
      .single();
    if (error || !pot) {
      console.error(error);
      throw new Error("We couldn't start the kitty just now. Please try again.");
    }
    await logEvent(pot.id, "pot_created", `${data.organiser_name} started the kitty for ${data.recipient_name}.`, {
      likes: data.likes,
      mode: data.mode,
    });
    if (data.likes.length) {
      await logEvent(pot.id, "profile_learned", `Kitty noted ${data.recipient_name} likes ${data.likes.slice(0, 3).join(", ")}${data.dislikes.length ? ` and will steer clear of ${data.dislikes.slice(0, 2).join(", ")}` : ""}.`);
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
};

async function loadPot(slug: string, adminToken?: string) {
  const db = await admin();
  const { data: pot } = await db.from("pots").select("*").eq("slug", slug).maybeSingle();
  if (!pot) return null;
  const isAdmin = !!adminToken && adminToken === pot.admin_token;

  const [{ data: contribs }, { data: sigs }, { data: events }, { data: votes }, { data: candidates }] = await Promise.all([
    db.from("contributions").select("id, display_name, visibility, amount, status, created_at").eq("pot_id", pot.id).in("status", LIVE).order("created_at"),
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
  const vs = pot.status === "voting" ? await voteState(pot) : null;
  const vote = vs
    ? { closesAt: pot.vote_closes_at as string | null, eligible: vs.eligible, voted: vs.voted, picks: vs.ids.map((id) => candById.get(id)).filter(Boolean).map((c) => ({ id: c!.id, title: c!.title, price: Number(c!.price), retailer: c!.retailer, image_url: c!.image_url, total_score: c!.total_score != null ? Number(c!.total_score) : null, votes: vs.tally[c!.id] ?? 0 })) }
    : null;

  let receipt: null | {
    gift: { title: string; retailer: string | null; price: number; offer_url: string | null; image_url: string | null } | null;
    held: number; paid: number; released: number;
    payments: { id: string; name: string | null; amount: number | null; capture_id: string | null }[];
    payout: { batch_id: string | null; item_id: string | null; status: string | null; amount: number | null; buy_url: string | null } | null;
  } = null;
  if (pot.status === "done") {
    const [{ data: paidRows }, { data: po }] = await Promise.all([
      db.from("contributions").select("id, display_name, visibility, amount, captured_amount, capture_id, status").eq("pot_id", pot.id).in("status", ["captured", "voided"]).not("planned_capture", "is", null).order("created_at"),
      db.from("payouts").select("*").eq("pot_id", pot.id).maybeSingle(),
    ]);
    const rows = paidRows ?? [];
    const held = rows.reduce((s, r) => s + Number(r.amount), 0);
    const paid = rows.filter((r) => r.status === "captured").reduce((s, r) => s + Number(r.captured_amount ?? 0), 0);
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
      deadline_at: pot.deadline_at,
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
    const { data: pot } = await db.from("pots").select("id, status, currency, recipient_name, deadline_at").eq("slug", data.slug).maybeSingle();
    if (!pot) throw new Error("We can't find this kitty. Check the link with the organiser.");
    if (pot.status !== "collecting") throw new Error("This kitty isn't taking contributions any more.");
    if (new Date(pot.deadline_at).getTime() < Date.now()) throw new Error("The deadline for this kitty has passed.");
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
      await logEvent(c.pot_id, "contribution_held", `${who} chipped in with ${amt}. Held, not charged.`);
      if (pot && raised >= Number(pot.target_amount)) {
        await logEvent(c.pot_id, "target_reached", "The pot has hit its target. Kitty will start lining up gifts.");
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
    await logEvent(c.pot_id, "contribution_withdrawn", `${who} withdrew their hold. It's been released and nothing was charged.`);
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
  } = { secrets, currency: DEFAULT_CURRENCY, token: { ok: false }, order: { ok: false }, database: { ok: false } };

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
    await logEvent(pot.id, "manual_run", "Organiser asked me to take another look.");
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
    await logEvent(pot.id, "profile_updated", `Got it. Updated what ${pot.recipient_name} is into. Re-planning from scratch.`);
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
      await logEvent(pot!.id, "buy_now", `${pot!.organiser_name} said buy it now.`);
      await c.tickPot(pot!.id);
      return { released: 0, failed: 0 };
    }
    if (!data.candidateId || data.candidateId === dec?.candidate_id) throw new Error("Pick a different gift to swap to.");
    const { data: pick } = await db.from("candidates").select("*").eq("id", data.candidateId).eq("pot_id", pot!.id).single();
    const { data: live } = await db.from("contributions").select("amount").eq("pot_id", pot!.id).in("status", ["authorized", "reauthorized"]);
    const total = (live ?? []).reduce((s, x) => s + Number(x.amount), 0);
    if (!pick || Number(pick.price) > total) throw new Error("The pot doesn't cover that gift.");
    await logEvent(pot!.id, "swapped", `${pot!.organiser_name} swapped to ${pick.title.slice(0, 60)}. Countdown restarted.`);
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
    const base = Math.max(Date.now(), new Date(pot!.deadline_at).getTime());
    const deadline = new Date(base + data.days * 86400_000).toISOString();
    await db.from("decisions").update({ vetoed_at: new Date().toISOString() }).eq("pot_id", pot!.id).is("vetoed_at", null);
    await db.from("final_votes").delete().eq("pot_id", pot!.id);
    await db.from("pots").update({ status: "collecting", deadline_at: deadline, vote_closes_at: null, vote_candidate_ids: [], close_search_at: null }).eq("id", pot!.id);
    await logEvent(pot!.id, "extended", `Deadline pushed back ${data.days === 1 ? "a day" : "3 days"}. Kitty's collecting again, and every hold is still only held.`);
    return { deadline };
  });
