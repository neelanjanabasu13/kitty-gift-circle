import { describe, expect, it } from "vitest";
import { DEMO_CAST, DEMO_TARGET, DEMO_TOTAL, demoStage } from "./demoScript";
import { splitLines } from "./closing";

describe("demo story", () => {
  it("nine people chip in £130, which passes the £120 target", () => {
    expect(DEMO_CAST.length).toBe(9);
    expect(DEMO_TOTAL).toBe(130);
    expect(DEMO_TOTAL).toBeGreaterThan(DEMO_TARGET);
  });
  it("6 of 9 vote and 3 don't", () => {
    expect(DEMO_CAST.filter((p) => p.vote !== undefined).length).toBe(6);
  });
  it("some suggest likes and some skip", () => {
    expect(DEMO_CAST.filter((p) => p.suggests).length).toBe(5);
  });
  it("a £118 gift: everyone pays in proportion, sums exactly, Jo pays £18.15 of £20", () => {
    const lines = splitLines(DEMO_CAST.map((p, i) => ({ id: String(i), amount: p.amount })), 118);
    expect(Math.round(lines.reduce((s, l) => s + l.paid * 100, 0))).toBe(11800);
    expect(lines[0]).toMatchObject({ held: 20, paid: 18.15, released: 1.85 });
  });
  it("stage follows pot status", () => {
    expect(demoStage("collecting", 4)).toBe("chipping");
    expect(demoStage("collecting", 9)).toBe("closing");
    expect(demoStage("veto", 9)).toBe("countdown");
  });
});
