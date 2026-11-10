// Pure, deterministic closing and money rules. No I/O. Everything here is unit-tested.

const cents = (n: number) => Math.round(n * 100);

export type Hold = { id: string; amount: number };

/**
 * Pro-rata capture so the captured total equals the gift price exactly.
 * Each share is floored to the penny of amount * price / pot; leftover pennies go to the largest
 * contribution first (never beyond what that person held), then the next largest.
 */
export function proRata(holds: Hold[], price: number): { id: string; share: number }[] {
  const pot = holds.reduce((s, h) => s + cents(h.amount), 0);
  const p = cents(price);
  if (p <= 0) return holds.map((h) => ({ id: h.id, share: 0 }));
  if (p > pot) throw new Error("The gift costs more than the pot holds.");
  const rows = holds.map((h) => {
    const a = cents(h.amount);
    return { id: h.id, a, s: Math.floor((a * p) / pot) };
  });
  let left = p - rows.reduce((s, r) => s + r.s, 0);
  const order = [...rows].sort((x, y) => y.a - x.a);
  for (const r of order) {
    if (left <= 0) break;
    const add = Math.min(left, r.a - r.s);
    r.s += add;
    left -= add;
  }
  return rows.map((r) => ({ id: r.id, share: r.s / 100 }));
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

/** Refund the excess over `target` from the largest captures first. */
export function excessRefunds(captures: { id: string; amount: number }[], target: number) {
  let excess = captures.reduce((s, c) => s + cents(c.amount), 0) - cents(target);
  const out: { id: string; amount: number }[] = [];
  for (const c of [...captures].sort((a, b) => b.amount - a.amount)) {
    if (excess <= 0) break;
    const take = Math.min(excess, cents(c.amount));
    out.push({ id: c.id, amount: take / 100 });
    excess -= take;
  }
  return out;
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
