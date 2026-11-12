import { describe, expect, it } from "vitest";
import { CHIP_GAP_MS, CHIP_LEAD_MS, DEMO_ACTS, DEMO_TOTAL_MS, SCENES, demoSplit, finalOrder, sceneAt, sceneStart, voteTally } from "./demoTimeline";
import { DEMO_HOME_PICKS } from "./demoPicks";

describe("demo stage timeline", () => {
  it("plays the five acts in order: chip in, shop, vote, split, wrapped", () => {
    const acts = SCENES.map((s) => s.act).filter((a, i, all) => all.indexOf(a) === i);
    expect(acts).toEqual(["chip", "shop", "vote", "split", "wrapped"]);
    expect(DEMO_ACTS.map((a) => a.id)).toEqual(acts);
    // acts never come back once finished
    const firstIdx = SCENES.map((s) => DEMO_ACTS.findIndex((a) => a.id === s.act));
    expect([...firstIdx].sort((a, b) => a - b)).toEqual(firstIdx);
  });
  it("runs about a minute (55 to 65 seconds)", () => {
    expect(DEMO_TOTAL_MS).toBeGreaterThanOrEqual(55_000);
    expect(DEMO_TOTAL_MS).toBeLessThanOrEqual(65_000);
  });
  it("first chip-in lands within 300ms and the rest every 1.2s", () => {
    expect(CHIP_LEAD_MS).toBeLessThanOrEqual(300);
    expect(CHIP_GAP_MS).toBe(1200);
  });
  it("finds the right scene for a moment and ends after the last", () => {
    expect(sceneAt(0)?.scene.id).toBe("chip");
    expect(sceneAt(sceneStart(3))?.scene.id).toBe("vote");
    expect(sceneAt(DEMO_TOTAL_MS)).toBeNull();
  });
  it("six of nine vote, and the top pick wins 4 to 2", () => {
    expect(voteTally()).toEqual([4, 2, 0]);
  });
});

describe("demo split", () => {
  it("captures sum exactly to the £119 gift and the rest is released", () => {
    const price = finalOrder(DEMO_HOME_PICKS)[0]!.price;
    expect(price).toBe(119);
    const lines = demoSplit(price);
    expect(lines.reduce((s, l) => s + Math.round(l.paid * 100), 0)).toBe(11900);
    expect(lines.reduce((s, l) => s + Math.round(l.released * 100), 0)).toBe(1100);
    lines.forEach((l) => expect(Math.round(l.paid * 100) + Math.round(l.released * 100)).toBe(Math.round(l.held * 100)));
  });
  it("sums exactly for an awkward price too", () => {
    expect(demoSplit(87.37).reduce((s, l) => s + Math.round(l.paid * 100), 0)).toBe(8737);
  });
});
