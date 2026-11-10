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

/** All-in votes still stop after 3 days so holds stay within PayPal's honour period. */
export const ALL_IN_CAP_MS = 3 * 86400_000;

export function voteDurationMs(window: VoteWindow, demo = false) {
  if (window === "off") return 0;
  const ms = window === "1h" ? 3600_000 : window === "1d" ? 86400_000 : ALL_IN_CAP_MS;
  return demo ? Math.min(ms, window === "1h" ? 120_000 : 300_000) : ms;
}

export function voteClosesAt(window: VoteWindow, from: Date, demo = false): Date | null {
  if (window === "off") return null;
  return new Date(from.getTime() + voteDurationMs(window, demo));
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
export const VETO_DEMO_MS = 3 * 60_000;
export function vetoMs(demo = false) {
  return demo ? VETO_DEMO_MS : VETO_MS;
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
