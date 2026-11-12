import { describe, expect, it } from "vitest";
import { seedKinds } from "./scoring";

describe("first ideas at the target budget", () => {
  it("three likes give one idea from each", () => {
    expect(seedKinds(["books", "plants", "tech"])).toEqual(["books", "plants", "tech"]);
  });
  it("two likes give one each plus one popular kind", () => {
    expect(seedKinds(["books", "tech"])).toEqual(["books", "tech", "cooking"]);
  });
  it("one like gives it plus two popular kinds", () => {
    expect(seedKinds(["books"])).toEqual(["books", "cooking", "plants"]);
  });
  it("no likes gives three different popular kinds", () => {
    expect(seedKinds([])).toEqual(["cooking", "plants", "wellbeing"]);
  });
  it("likes of the same kind of gift count once, so the three stay different", () => {
    expect(seedKinds(["cooking", "coffee", "books"])).toEqual(["cooking", "books", "plants"]);
  });
});
