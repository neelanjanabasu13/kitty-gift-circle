// Pure, deterministic closing and money rules. No I/O. Everything here is unit-tested.

const cents = (n: number) => Math.round(n * 100);

export type Hold = { id: string; amount: number };

/**
 * Largest-remainder split of `total` pence across integer pence `weights`.
 * Floor every exact share, then hand leftover pennies one by one to the largest fractional
 * remainders (ties to the larger weight, then input order), so shares sum exactly to `total`.
 */
export function splitPence(weights: number[], total: number): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  if (total > sum) throw new Error("Can't split more than the pot holds.");
  const rows = weights.map((w, i) => ({ i, w, floor: Math.floor((w * total) / sum), rem: (w * total) % sum }));
  let left = total - rows.reduce((s, r) => s + r.floor, 0);
  const order = [...rows].sort((x, y) => y.rem - x.rem || y.w - x.w || x.i - y.i);
  for (const r of order) {
    if (left <= 0) break;
    r.floor += 1;
    left -= 1;
  }
  return rows.map((r) => r.floor);
}

/**
 * The surplus rule. Each hold captures amount x (price / pot) with largest-remainder pennies, so
 * captures sum exactly to the price and the rest of each hold is released in proportion.
 */
export function proRata(holds: Hold[], price: number): { id: string; share: number }[] {
  const pot = holds.reduce((s, h) => s + cents(h.amount), 0);
  const p = cents(price);
  if (p > pot) throw new Error("The gift costs more than the pot holds.");
  const shares = splitPence(holds.map((h) => cents(h.amount)), p);
  return holds.map((h, i) => ({ id: h.id, share: shares[i]! / 100 }));
}

/** Per-person view of the surplus rule: held, paid, released. */
export function splitLines(holds: Hold[], price: number) {
  return proRata(holds, price).map((s, i) => {
    const held = holds[i]!.amount;
    return { id: s.id, held, paid: s.share, released: (cents(held) - cents(s.share)) / 100 };
  });
}

/** Share of each hold that gets paid, as a percentage (e.g. 96.7). */
export function paidPercent(price: number, pot: number) {
  return pot > 0 ? Math.round((price / pot) * 1000) / 10 : 0;
}

/** Refund `amount` across captures in the same proportions, largest-remainder pennies. */
export function proportionalRefund(captures: { id: string; amount: number }[], amount: number) {
  const r = splitPence(captures.map((c) => cents(c.amount)), cents(amount));
  return captures.map((c, i) => ({ id: c.id, amount: r[i]! / 100 })).filter((x) => x.amount > 0);
}

/** Money released back to people: everything held minus the gift price. */
export function releasedAmount(held: number, price: number) {
  return Math.max(0, (cents(held) - cents(price)) / 100);
}

export type VoteWindow = "off" | "1h" | "1d" | "all_in";

// ---------- Demo clock: the ONE place time compresses ----------
export const DEMO_FACTOR = 60;
export type Clock = { demo: boolean; factor: number };
/** `true` means demo at the default factor; a pot row works too. */
export type ClockLike = Clock | boolean | { demo_speed: boolean; demo_factor?: number | null };

export function clockOf(c: ClockLike): Clock {
  if (typeof c === "boolean") return { demo: c, factor: DEMO_FACTOR };
  if ("demo" in c) return { demo: c.demo, factor: Math.max(1, c.factor || DEMO_FACTOR) };
  return { demo: !!c.demo_speed, factor: Math.max(1, c.demo_factor || DEMO_FACTOR) };
}
/** Real-world duration -> duration on this pot's clock (1 hour = 1 minute at 60x). */
export function scaleMs(ms: number, clock: ClockLike = false) {
  const c = clockOf(clock);
  return c.demo ? Math.round(ms / c.factor) : ms;
}
/** The deadline as the pot's clock sees it: the gap from creation is compressed. */
export function effectiveDeadline(createdAt: Date, deadline: Date, clock: ClockLike = false) {
  const gap = Math.max(0, deadline.getTime() - createdAt.getTime());
  return new Date(createdAt.getTime() + scaleMs(gap, clock));
}
/** Inverse of effectiveDeadline: the stored deadline that produces `effective`. */
export function storedDeadlineFor(createdAt: Date, effective: Date, clock: ClockLike = false) {
  const c = clockOf(clock);
  const gap = Math.max(0, effective.getTime() - createdAt.getTime());
  return new Date(createdAt.getTime() + (c.demo ? gap * c.factor : gap));
}
/** Reminder nudge is due 24 hours (on the pot's clock) before the deadline. */
export function reminderDueAt(createdAt: Date, deadline: Date, clock: ClockLike = false) {
  return new Date(effectiveDeadline(createdAt, deadline, clock).getTime() - scaleMs(86400_000, clock));
}

// ---------- Seeded demo holds ----------
/** A seeded row with no real sandbox authorization is a demo hold: never sent to PayPal. */
export function isDemoHold(c: { is_seeded?: boolean | null; authorization_id?: string | null }) {
  return !!c.is_seeded && !c.authorization_id;
}
/** Only these may be captured, voided, reauthorised or looked up with PayPal. */
export function paypalHolds<T extends { is_seeded?: boolean | null; authorization_id?: string | null }>(rows: T[]) {
  return rows.filter((r) => !!r.authorization_id && !isDemoHold(r));
}

/** All-in votes still stop after 3 days so holds stay within PayPal's honour period. */
export const ALL_IN_CAP_MS = 3 * 86400_000;

export function voteDurationMs(window: VoteWindow, clock: ClockLike = false) {
  if (window === "off") return 0;
  const ms = window === "1h" ? 3600_000 : window === "1d" ? 86400_000 : ALL_IN_CAP_MS;
  return scaleMs(ms, clock);
}

export function voteClosesAt(window: VoteWindow, from: Date, clock: ClockLike = false): Date | null {
  if (window === "off") return null;
  return new Date(from.getTime() + voteDurationMs(window, clock));
}

/** Closes at the window end OR when every contributor who hasn't opted out has voted. */
export function isVoteClosed(o: { closesAt: Date | null; now: Date; eligible: number; voted: number }) {
  if (!o.closesAt) return true;
  if (o.now.getTime() >= o.closesAt.getTime()) return true;
  return o.voted >= o.eligible;
}

/** Most votes wins; ties go to the higher total_score. Nobody voting means the top pick. */
export function pickWinner<T extends { id: string; total_score: number | null; votes: number }>(picks: T[]) {
  if (!picks.length) return { winner: null, nobodyVoted: true };
  const nobodyVoted = picks.every((p) => p.votes === 0);
  const sorted = [...picks].sort((a, b) => b.votes - a.votes || (b.total_score ?? 0) - (a.total_score ?? 0));
  return { winner: sorted[0]!, nobodyVoted };
}

export const VETO_MS = 2 * 3600_000;
export function vetoMs(clock: ClockLike = false) {
  return scaleMs(VETO_MS, clock);
}

/** Whether the pot should close: target reached or deadline passed. */
export function shouldClose(o: { raised: number; target: number; deadline: Date; now: Date }) {
  return cents(o.raised) >= cents(o.target) || o.now.getTime() >= o.deadline.getTime();
}

/**
 * After captures: proceed if captured covers the gift, else swap to the best lower pick that the
 * captured total covers, else refund everything.
 */
export function afterCapture<T extends { id: string; price: number }>(captured: number, price: number, fallbacks: T[]):
  { kind: "proceed" } | { kind: "swap"; to: T } | { kind: "refund" } {
  if (cents(captured) >= cents(price)) return { kind: "proceed" };
  const to = fallbacks.find((f) => cents(f.price) <= cents(captured));
  return to ? { kind: "swap", to } : { kind: "refund" };
}

/**
 * Re-split after a failed capture: spread the shortfall over the holds that were captured, in
 * proportion to what each held (largest-remainder pennies), never taking more than anyone held.
 * Returns the extra each must pay, or null if their holds can't cover the shortfall.
 */
export function resplit(rows: { id: string; held: number; paid: number }[], shortfall: number): { id: string; extra: number }[] | null {
  let left = cents(shortfall);
  const room = new Map(rows.map((r) => [r.id, Math.max(0, cents(r.held) - cents(r.paid))]));
  const extra = new Map(rows.map((r) => [r.id, 0]));
  if (left <= 0) return [];
  if ([...room.values()].reduce((a, b) => a + b, 0) < left) return null;
  while (left > 0) {
    const open = rows.filter((r) => room.get(r.id)! > 0);
    const parts = splitPence(open.map((r) => cents(r.held)), left);
    open.forEach((r, i) => {
      const take = Math.min(parts[i]!, room.get(r.id)!);
      room.set(r.id, room.get(r.id)! - take);
      extra.set(r.id, extra.get(r.id)! + take);
      left -= take;
    });
  }
  return rows.map((r) => ({ id: r.id, extra: extra.get(r.id)! / 100 })).filter((x) => x.extra > 0);
}

/** A hold past its 3-day honour period but within 29 days can be reauthorised. */
export function holdAction(o: { status: string; createdAt: Date; honorExpiresAt: Date | null; authExpiresAt: Date | null; now: Date }):
  "ok" | "reauthorize" | "drop" {
  const s = o.status.toUpperCase();
  if (["VOIDED", "EXPIRED", "DENIED"].includes(s)) return "drop";
  if (o.authExpiresAt && o.authExpiresAt.getTime() <= o.now.getTime()) return "drop";
  if (o.honorExpiresAt && o.honorExpiresAt.getTime() <= o.now.getTime()) {
    return o.now.getTime() - o.createdAt.getTime() < 29 * 86400_000 ? "reauthorize" : "drop";
  }
  return "ok";
}

/** "5pm", "5:30pm" */
export function clockTime(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = h % 12 || 12;
  return `${hh}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** The vote part of the why-line, counted against everyone who chipped in, not just voters. */
export function votePhrase(votes: number, voted: number, contributors: number): string {
  if (!votes || !voted) return "";
  const people = Math.max(contributors, voted);
  if (voted === people) return votes === voted ? "Everyone who chipped in voted for it." : `${votes} of ${people} chipped-in people voted for it.`;
  return votes === voted ? `${voted} of ${people} chipped-in people voted, and they picked it.` : `${voted} of ${people} chipped-in people voted, and ${votes} picked it.`;
}
