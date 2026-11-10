import { describe, expect, it } from "vitest";
import { afterCapture, proportionalRefund, splitLines, splitPence, holdAction, isVoteClosed, pickWinner, proRata, releasedAmount, shouldClose, voteClosesAt } from "./closing";

const sum = (xs: { share: number }[]) => Math.round(xs.reduce((s, x) => s + x.share * 100, 0)) / 100;

describe("pro-rata capture", () => {
  it("£122 pot, £118 gift, 10 mixed contributions captures exactly 118.00", () => {
    const amounts = [20, 15, 15, 12, 12, 10, 10, 10, 10, 8];
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(122);
    const r = proRata(amounts.map((a, i) => ({ id: String(i), amount: a })), 118);
    expect(sum(r)).toBe(118);
    r.forEach((x, i) => expect(x.share).toBeLessThanOrEqual(amounts[i]!));
  });
  it("uneven amounts: whoever put in more gets more back", () => {
    const r = splitLines([{ id: "a", amount: 20 }, { id: "b", amount: 5 }], 20);
    expect(r).toEqual([{ id: "a", held: 20, paid: 16, released: 4 }, { id: "b", held: 5, paid: 4, released: 1 }]);
  });
  it("leftover pennies go to the largest fractional remainders", () => {
    // 1000/3300, 1000/3300, 1300/3300 of 1000p: exact 303.03, 303.03, 393.94 -> floors 303, 303, 393, 1p left
    // remainders 0.03, 0.03, 0.94 so the penny goes to c
    expect(splitPence([1000, 1000, 1300], 1000)).toEqual([303, 303, 394]);
    // three equal holds splitting 100p: remainders tie, ties go to input order
    expect(splitPence([500, 500, 500], 100)).toEqual([34, 33, 33]);
    // the larger fractional remainder gets the penny
    expect(splitPence([300, 600], 100)).toEqual([33, 67]);
  });
  it("a single contributor pays exactly the price", () => {
    expect(splitLines([{ id: "a", amount: 122 }], 118)).toEqual([{ id: "a", held: 122, paid: 118, released: 4 }]);
  });
  it("exact match: pot equals price, everyone pays in full", () => {
    expect(proRata([{ id: "a", amount: 7.5 }, { id: "b", amount: 2.5 }], 10).map((x) => x.share)).toEqual([7.5, 2.5]);
  });
  it("refuses a gift above the pot", () => {
    expect(() => proRata([{ id: "a", amount: 5 }], 6)).toThrow();
  });
  it("released is pot minus price", () => {
    expect(releasedAmount(122, 118)).toBe(4);
  });
});

describe("vote close rule", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("closes at the window end", () => {
    expect(isVoteClosed({ closesAt: new Date("2026-01-01T11:59:00Z"), now, eligible: 5, voted: 1 })).toBe(true);
  });
  it("closes early when everyone who wants to vote has voted", () => {
    expect(isVoteClosed({ closesAt: new Date("2026-01-01T15:00:00Z"), now, eligible: 4, voted: 4 })).toBe(true);
    expect(isVoteClosed({ closesAt: new Date("2026-01-01T15:00:00Z"), now, eligible: 4, voted: 3 })).toBe(false);
  });
  it("off means no vote at all", () => {
    expect(voteClosesAt("off", now)).toBeNull();
    expect(voteClosesAt("1h", now)!.toISOString()).toBe("2026-01-01T13:00:00.000Z");
  });
  it("ties go to the higher total score; nobody voting picks the top", () => {
    expect(pickWinner([{ id: "a", total_score: 0.7, votes: 2 }, { id: "b", total_score: 0.9, votes: 2 }]).winner!.id).toBe("b");
    const n = pickWinner([{ id: "a", total_score: 0.9, votes: 0 }, { id: "b", total_score: 0.5, votes: 0 }]);
    expect(n.nobodyVoted).toBe(true);
    expect(n.winner!.id).toBe("a");
  });
});

describe("closing and failures", () => {
  it("closes on target or deadline", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(shouldClose({ raised: 120, target: 120, deadline: new Date("2026-02-01"), now })).toBe(true);
    expect(shouldClose({ raised: 86, target: 120, deadline: new Date("2025-12-31"), now })).toBe(true);
    expect(shouldClose({ raised: 86, target: 120, deadline: new Date("2026-02-01"), now })).toBe(false);
  });
  it("after a failed capture: proceed, swap lower, or refund", () => {
    const picks = [{ id: "x", price: 95 }, { id: "y", price: 64 }];
    expect(afterCapture(118, 118, picks).kind).toBe("proceed");
    expect(afterCapture(100, 118, picks)).toEqual({ kind: "swap", to: picks[0] });
    expect(afterCapture(40, 118, picks).kind).toBe("refund");
  });
  it("a refund after capture is split in the same proportions", () => {
    const r = proportionalRefund([{ id: "a", amount: 15.73 }, { id: "b", amount: 7.87 }, { id: "c", amount: 3.94 }], 3);
    expect(Math.round(r.reduce((s, x) => s + x.amount * 100, 0))).toBe(300);
    expect(r).toEqual([{ id: "a", amount: 1.71 }, { id: "b", amount: 0.86 }, { id: "c", amount: 0.43 }]);
  });
  it("holds past the honour period are reauthorised, dead ones dropped", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const base = { createdAt: new Date("2026-01-01"), authExpiresAt: new Date("2026-01-30"), now };
    expect(holdAction({ ...base, status: "CREATED", honorExpiresAt: new Date("2026-01-04") })).toBe("reauthorize");
    expect(holdAction({ ...base, status: "CREATED", honorExpiresAt: new Date("2026-01-06") })).toBe("ok");
    expect(holdAction({ ...base, status: "VOIDED", honorExpiresAt: null })).toBe("drop");
  });
});

import { clockOf, effectiveDeadline, isDemoHold, paypalHolds, reminderDueAt, scaleMs, storedDeadlineFor, vetoMs, voteDurationMs } from "./closing";

describe("demo clock", () => {
  const demo = { demo_speed: true, demo_factor: 60 };
  it("compresses windows at 60x", () => {
    expect(voteDurationMs("1h", demo)).toBe(60_000);
    expect(voteDurationMs("1d", demo)).toBe(24 * 60_000);
    expect(vetoMs(demo)).toBe(2 * 60_000);
  });
  it("leaves real time alone when off", () => {
    expect(voteDurationMs("1h", { demo_speed: false, demo_factor: 60 })).toBe(3600_000);
    expect(vetoMs(false)).toBe(2 * 3600_000);
  });
  it("defaults to 60x", () => {
    expect(clockOf(true).factor).toBe(60);
    expect(scaleMs(3600_000, { demo_speed: true, demo_factor: null })).toBe(60_000);
  });
  it("compresses deadlines from creation and inverts", () => {
    const created = new Date("2026-01-01T12:00:00Z");
    const eff = effectiveDeadline(created, new Date("2026-01-03T12:00:00Z"), demo);
    expect(eff.toISOString()).toBe("2026-01-01T12:48:00.000Z");
    expect(storedDeadlineFor(created, eff, demo).toISOString()).toBe("2026-01-03T12:00:00.000Z");
  });
  it("puts the nudge 24 pot-hours before the deadline", () => {
    const created = new Date("2026-01-01T12:00:00Z");
    expect(reminderDueAt(created, new Date("2026-01-03T12:00:00Z"), demo).toISOString()).toBe("2026-01-01T12:24:00.000Z");
    expect(reminderDueAt(created, new Date("2026-01-03T12:00:00Z"), false).toISOString()).toBe("2026-01-02T12:00:00.000Z");
  });
});

describe("seeded holds", () => {
  it("a seeded row without an authorization is a demo hold", () => {
    expect(isDemoHold({ is_seeded: true, authorization_id: null })).toBe(true);
    expect(isDemoHold({ is_seeded: true, authorization_id: "AUTH1" })).toBe(false);
    expect(isDemoHold({ is_seeded: false, authorization_id: null })).toBe(false);
  });
  it("only real authorizations are sent to PayPal", () => {
    const rows = [
      { id: "a", is_seeded: true, authorization_id: null },
      { id: "b", is_seeded: true, authorization_id: "AUTH-B" },
      { id: "c", is_seeded: false, authorization_id: "AUTH-C" },
    ];
    expect(paypalHolds(rows).map((r) => r.id)).toEqual(["b", "c"]);
  });
});
