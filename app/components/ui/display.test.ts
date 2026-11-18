import { describe, expect, it } from "vitest";
import { borrowTextAfter, comparePcts, pct2, scaleLabelsCollide } from "./display";

describe("comparePcts", () => {
  it("keeps one decimal when the values already differ", () => {
    expect(comparePcts(10818, 7045)).toEqual({ ltv: "108.2%", limit: "70.5%" });
  });
  it("shows two decimals for both when one decimal would read the same", () => {
    // The real devnet reject: brace blocked ltv=7049 limit=7048.
    expect(comparePcts(7049, 7048)).toEqual({ ltv: "70.49%", limit: "70.48%" });
  });
  it("pct2 formats bps with two decimals", () => {
    expect(pct2(7000)).toBe("70.00%");
  });
});

describe("scaleLabelsCollide", () => {
  it("flags a limit close to liquidation", () => {
    expect(scaleLabelsCollide(7050, 8000)).toBe(true);
  });
  it("leaves far apart labels alone", () => {
    expect(scaleLabelsCollide(5000, 8000)).toBe(false);
  });
  it("is false with no limit read yet", () => {
    expect(scaleLabelsCollide(null, 8000)).toBe(false);
  });
});

describe("borrowTextAfter", () => {
  it("clears the amount after a confirmed borrow", () => {
    expect(borrowTextAfter(true, "20")).toBe("");
  });
  it("keeps the amount after a failed or rejected borrow", () => {
    expect(borrowTextAfter(false, "26.07")).toBe("26.07");
  });
});
