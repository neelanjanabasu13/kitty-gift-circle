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
