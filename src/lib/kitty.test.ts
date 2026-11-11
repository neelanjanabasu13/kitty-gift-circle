import { describe, expect, it } from "vitest";
import { amountChips, formatMoney, meterPercent, shareMessage, stillToChipIn, suggestedAmount } from "./kitty";

describe("kitty rules", () => {
  it("suggests target divided by expected people, rounded up", () => {
    expect(suggestedAmount(120, 12)).toBe(10);
    expect(suggestedAmount(100, 7)).toBe(15);
  });
  it("offers suggested plus 5/10/15/20 without duplicates", () => {
    expect(amountChips(120, 12)).toEqual([10, 5, 15, 20]);
    expect(amountChips(100, 8)).toEqual([13, 5, 10, 15, 20]);
  });
  it("caps the meter at 100%", () => {
    expect(meterPercent(112, 120)).toBe(93);
    expect(meterPercent(200, 120)).toBe(100);
  });
  it("counts people still to chip in", () => {
    expect(stillToChipIn(12, 9)).toBe(3);
    expect(stillToChipIn(5, 9)).toBe(0);
  });
  it("writes the ready share message", () => {
    expect(shareMessage("Sam", "leaving", "https://x/k/a")).toBe(
      "Chipping in for Sam's leaving gift. It's a hold, so nobody's charged unless the gift happens: https://x/k/a",
    );
  });
  it("formats pounds", () => {
    expect(formatMoney(112, "GBP")).toBe("£112");
  });
});

import { bandFor, cleanProducts, isForeignShop, potFit, quality, rank, totalScore, voteScore, nextUnlock, type Product, type Scored } from "./scoring";

const sig = { rating: 4.5, reviewCount: 100, offerCount: 2, inStock: true, priceConsistent: true, wishlistMatch: 0 };
const cand = (id: string, price: number, category: string, fit: number): Scored => ({ id, price, category, fit, signals: sig });

describe("agent scorer", () => {
  it("pot fit is 1 between 80% and 100% of the pot, 0 above it, and falls off below", () => {
    expect(potFit(100, 112)).toBe(1);
    expect(potFit(112, 112)).toBe(1);
    expect(potFit(113, 112)).toBe(0);
    expect(potFit(44.8, 112)).toBeCloseTo(0.5);
  });
  it("votes can't lift a poor fit above its fit", () => {
    expect(voteScore("cooking", { cooking: 10 }, 0.3)).toBe(0.3);
    expect(voteScore("cooking", { cooking: 1, books: 1 }, 0.9)).toBe(0.5);
    expect(voteScore("cooking", {}, 0.9)).toBe(0);
  });
  it("damps ratings with few reviews toward neutral", () => {
    expect(quality(5, 0)).toBe(0.5);
    expect(quality(5, 1000)).toBeGreaterThan(0.95);
    expect(quality(null, 0)).toBe(0.5);
  });
  it("weights sum to fit 35, vote 20, pot fit 20, wishlist 10, quality 10, reliability 5", () => {
    const perfect: Scored = { id: "x", price: 100, category: "cooking", fit: 1, signals: { rating: 5, reviewCount: 1e9, offerCount: 3, inStock: true, priceConsistent: true, wishlistMatch: 1 } };
    expect(totalScore(perfect, 100, { cooking: 1 })).toBeCloseTo(1, 2);
  });
  it("drops above-pot and fit below 0.4 before ranking", () => {
    const r = rank([cand("a", 130, "cooking", 0.9), cand("b", 90, "cooking", 0.39), cand("c", 90, "books", 0.7)], 112, {});
    expect(r.map((x) => x.id)).toEqual(["c"]);
  });
  it("top 3 are three different kinds of gift; a mug and a baking dish count as the same kind", () => {
    const list = [cand("a", 100, "cooking", 0.95), cand("b", 100, "ceramics", 0.9), cand("c", 100, "coffee", 0.85), cand("d", 100, "books", 0.6), cand("e", 100, "wellbeing", 0.55)];
    expect(rank(list, 112, { cooking: 2, books: 1 }).slice(0, 3).map((x) => x.id)).toEqual(["a", "d", "e"]);
  });
  it("top 3 spans 2+ categories unless votes are unanimous", () => {
    const list = [cand("a", 100, "cooking", 0.95), cand("b", 100, "cooking", 0.9), cand("c", 100, "cooking", 0.85), cand("d", 100, "books", 0.6)];
    expect(new Set(rank(list, 112, { cooking: 2, books: 1 }).slice(0, 3).map((x) => x.category)).size).toBe(2);
    expect(rank(list, 112, { cooking: 3 }).slice(0, 3).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("search bands are 30, 50, 75, 100, 150, 200", () => {
    expect(bandFor(29)).toBe(0);
    expect(bandFor(30)).toBe(30);
    expect(bandFor(112)).toBe(100);
    expect(bandFor(500)).toBe(200);
  });
  it("cleaning dedupes, drops dislikes, above-pot and too-cheap offers", () => {
    const o = (price: number, compareAt: number | null = null) => ({ url: "https://x", domain: "x.com", price, compareAt, currency: "GBP", inStock: true });
    const p = (id: string, title: string, offers: ReturnType<typeof o>[]): Product => ({ id, title, image: null, category: null, rating: null, reviewCount: 0, offers });
    const r = cleanProducts([
      p("1", "Cast iron pot", [o(100)]),
      p("1", "Cast iron pot", [o(100)]),
      p("2", "Scented candle set", [o(30)]),
      p("3", "Stand mixer", [o(300)]),
      p("4", "Knife", [o(10, 100)]),
    ], ["scented stuff"], 112);
    expect(r.kept.map((k) => k.product.id)).toEqual(["1"]);
    expect(r.dropped).toMatchObject({ duplicate: 1, dislike: 1, abovePot: 1, suspicious: 1 });
  });
  it("next unlock is the cheapest decent gift just above the pot", () => {
    const u = nextUnlock([{ price: 150, fit_score: 0.8 }, { price: 118, fit_score: 0.9 }, { price: 115, fit_score: 0.3 }, { price: 100, fit_score: 0.9 }], 112);
    expect(u?.price).toBe(118);
  });
});

describe("shop filters (from the live test run)", () => {
  const offer = (domain: string, price: number, currency = "GBP") => ({ url: `https://${domain}/x`, domain, price, compareAt: null, currency, inStock: true });
  const prod = (id: string, title: string, offers: any[]): Product => ({ id, title, image: null, category: null, rating: null, reviewCount: 0, offers });
  const GB = { country: "GB" as const, currency: "GBP" };
  it("drops overseas storefronts for a UK pot", () => {
    expect(isForeignShop("de.peugeot-saveurs.com", "GB")).toBe(true);
    expect(isForeignShop("next.ie", "GB")).toBe(true);
    expect(isForeignShop("johnlewis.com", "GB")).toBe(false);
    expect(isForeignShop("uk.peugeot-saveurs.com", "GB")).toBe(false);
    const r = cleanProducts([prod("a", "Dish", [offer("de.peugeot-saveurs.com", 40)])], [], 80, GB);
    expect(r.kept).toHaveLength(0);
  });
  it("drops offers in another currency", () => {
    const r = cleanProducts([prod("a", "Mug", [offer("shop.com", 30, "USD")])], [], 80, GB);
    expect(r.kept).toHaveLength(0);
  });
  it("treats the same title from two listings as a duplicate", () => {
    const r = cleanProducts([prod("a", "Ultime Rectangular Baking Dish", [offer("hartsofstur.com", 55)]), prod("b", "Ultime rectangular baking dish", [offer("hartsofstur.com", 45)])], [], 80, GB);
    expect(r.kept).toHaveLength(1);
    expect(r.dropped.duplicate).toBe(1);
  });
});
