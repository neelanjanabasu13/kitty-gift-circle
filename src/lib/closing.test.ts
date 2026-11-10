import { describe, expect, it } from "vitest";
import { afterCapture, excessRefunds, holdAction, isVoteClosed, pickWinner, proRata, releasedAmount, shouldClose, voteClosesAt } from "./closing";

const sum = (xs: { share: number }[]) => Math.round(xs.reduce((s, x) => s + x.share * 100, 0)) / 100;

describe("pro-rata capture", () => {
  it("£122 pot, £118 gift, 10 mixed contributions captures exactly 118.00", () => {
    const amounts = [20, 15, 15, 12, 12, 10, 10, 10, 10, 8];
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(122);
    const r = proRata(amounts.map((a, i) => ({ id: String(i), amount: a })), 118);
    expect(sum(r)).toBe(118);
    r.forEach((x, i) => expect(x.share).toBeLessThanOrEqual(amounts[i]!));
  });
  it("leftover pennies land on the largest contribution", () => {
    const r = proRata([{ id: "a", amount: 10 }, { id: "b", amount: 10 }, { id: "c", amount: 13 }], 10);
    expect(sum(r)).toBe(10);
    expect(r.find((x) => x.id === "c")!.share).toBe(3.94);
  });
  it("full pot captures every hold in full", () => {
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
  it("excess refunds come from the largest captures", () => {
    expect(excessRefunds([{ id: "a", amount: 30 }, { id: "b", amount: 70 }], 95)).toEqual([{ id: "b", amount: 5 }]);
  });
  it("holds past the honour period are reauthorised, dead ones dropped", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const base = { createdAt: new Date("2026-01-01"), authExpiresAt: new Date("2026-01-30"), now };
    expect(holdAction({ ...base, status: "CREATED", honorExpiresAt: new Date("2026-01-04") })).toBe("reauthorize");
    expect(holdAction({ ...base, status: "CREATED", honorExpiresAt: new Date("2026-01-06") })).toBe("ok");
    expect(holdAction({ ...base, status: "VOIDED", honorExpiresAt: null })).toBe("drop");
  });
});
