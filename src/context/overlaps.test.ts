import { describe, expect, it } from "vitest";
import { countOverlapEligiblePairs, findOverlaps } from "./overlaps";

// findOverlaps feeds both the agent's self-correction loop and the NoOverlaps eval scorer,
// so each documented carve-out in overlaps.ts gets a test here.

const rect = (id: string, x: number, y: number, width = 100, height = 60) => ({ id, type: "rectangle", x, y, width, height });

describe("findOverlaps", () => {
  it("reports overlapping shapes as id pairs in a stable order", () => {
    const elements = [rect("b", 0, 0), rect("a", 50, 30), rect("c", 500, 500)];
    expect(findOverlaps(elements)).toEqual([["a", "b"]]);
  });

  it("allows up to 4px of overlap, so flush neighbours are not flagged", () => {
    expect(findOverlaps([rect("a", 0, 0), rect("b", 100, 0)])).toEqual([]); // touching edges
    expect(findOverlaps([rect("a", 0, 0), rect("b", 96, 0)])).toEqual([]); // 4px overlap
    expect(findOverlaps([rect("a", 0, 0), rect("b", 95, 0)])).toEqual([["a", "b"]]); // 5px overlap
  });

  it("ignores arrows and lines, whose boxes cross the shapes they connect", () => {
    const elements = [
      rect("a", 0, 0),
      rect("b", 300, 0),
      { id: "arrow", type: "arrow", x: 50, y: 20, width: 300, height: 10 },
      { id: "line", type: "line", x: 0, y: 0, width: 400, height: 60 },
    ];
    expect(findOverlaps(elements)).toEqual([]);
  });

  it("ignores a label inside its own shape, but checks labels that sit on arrows", () => {
    const elements = [
      rect("box", 0, 0),
      { id: "box-label", type: "text", containerId: "box", x: 10, y: 20, width: 80, height: 20 },
      { id: "arrow", type: "arrow", x: 100, y: 30, width: 200, height: 0 },
      { id: "arrow-label", type: "text", containerId: "arrow", x: 60, y: 20, width: 80, height: 20 },
    ];
    // box-label is excluded as a container label; arrow-label is checked and collides with box.
    expect(findOverlaps(elements)).toEqual([["arrow-label", "box"]]);
  });

  it("skips elements without an id or a complete bounding box", () => {
    const elements = [rect("a", 0, 0), { type: "rectangle", x: 0, y: 0, width: 100, height: 60 }, { id: "b", type: "ellipse", x: 0, y: 0 }];
    expect(findOverlaps(elements)).toEqual([]);
  });

  it("returns nothing for fewer than two elements or non-array input", () => {
    expect(findOverlaps([rect("a", 0, 0)])).toEqual([]);
    expect(findOverlaps("nope" as unknown as unknown[])).toEqual([]);
  });
});

describe("countOverlapEligiblePairs", () => {
  it("counts n(n-1)/2 pairs over the elements findOverlaps would check", () => {
    const elements = [
      rect("a", 0, 0),
      rect("b", 200, 0),
      rect("c", 400, 0),
      { id: "arrow", type: "arrow", x: 0, y: 0, width: 400, height: 0 },
      { id: "label", type: "text", containerId: "a", x: 0, y: 0, width: 50, height: 20 },
    ];
    expect(countOverlapEligiblePairs(elements)).toBe(3); // a, b and c only
  });

  it("is zero when there is nothing to compare", () => {
    expect(countOverlapEligiblePairs([])).toBe(0);
    expect(countOverlapEligiblePairs([rect("a", 0, 0)])).toBe(0);
  });
});
