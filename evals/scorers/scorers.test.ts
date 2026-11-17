import { describe, expect, it } from "vitest";
import { boundArrowsScorer } from "./boundArrows";
import { boundLabelsScorer } from "./boundLabels";
import { connectivityScorer } from "./connectivity";
import { noOverlapsScorer } from "./noOverlaps";

// The evals are only as trustworthy as their scorers, so the scorers get unit tests of their own,
// with small hand-built diagrams whose correct score is obvious.

type Element = Record<string, unknown>;
type Scorer = (args: never) => unknown;

async function run(scorer: Scorer, elements: Element[], prompt = "") {
  const testCase = { input: prompt };
  const result = await (scorer as (args: unknown) => unknown)({ input: testCase, output: { elements }, expected: testCase });
  return result as { name: string; score: number; metadata: Record<string, unknown> } | null;
}

const shape = (id: string, x = 0, y = 0): Element => ({ id, type: "rectangle", x, y, width: 100, height: 60 });
const label = (id: string, containerId: string): Element => ({ id, type: "text", containerId, x: 0, y: 0, width: 10, height: 10 });
const arrow = (id: string, from?: string, to?: string): Element => ({
  id,
  type: "arrow",
  startBinding: from ? { elementId: from } : null,
  endBinding: to ? { elementId: to } : null,
});

describe("connectivityScorer", () => {
  const prompt = "draw the request flow from client to database";

  it("skips prompts that don't imply a connected diagram", async () => {
    expect(await run(connectivityScorer, [shape("a"), shape("b")], "draw a red square")).toBeNull();
  });

  it("scores 1 when every shape is reachable through bound arrows", async () => {
    const result = await run(connectivityScorer, [shape("a"), shape("b"), shape("c"), arrow("1", "a", "b"), arrow("2", "c", "b")], prompt);
    expect(result?.score).toBe(1);
  });

  it("scores the reachable fraction when the graph is split", async () => {
    const result = await run(connectivityScorer, [shape("a"), shape("b"), shape("c"), shape("d"), arrow("1", "a", "b")], prompt);
    expect(result?.score).toBe(0.5);
  });

  it("does not count arrows with a loose end as connections", async () => {
    const result = await run(connectivityScorer, [shape("a"), shape("b"), arrow("1", "a")], prompt);
    expect(result?.score).toBe(0.5);
  });
});

describe("boundArrowsScorer", () => {
  it("skips diagrams without arrows", async () => {
    expect(await run(boundArrowsScorer, [shape("a")])).toBeNull();
  });

  it("scores the share of arrows bound at both ends to elements that exist", async () => {
    const result = await run(boundArrowsScorer, [
      shape("a"),
      shape("b"),
      arrow("good", "a", "b"),
      arrow("loose", "a"),
      arrow("dangling", "a", "ghost"),
      arrow("also-good", "b", "a"),
    ]);
    expect(result?.score).toBe(0.5);
    expect(result?.metadata.broken).toEqual(["loose", "dangling"]);
  });
});

describe("boundLabelsScorer", () => {
  it("skips diagrams without shapes", async () => {
    expect(await run(boundLabelsScorer, [arrow("1")])).toBeNull();
  });

  it("scores the share of shapes that carry a bound text label", async () => {
    const result = await run(boundLabelsScorer, [shape("a"), shape("b"), shape("c"), shape("d"), label("t1", "a"), label("t2", "c")]);
    expect(result?.score).toBe(0.5);
    expect(result?.metadata.unlabeled).toEqual(["b", "d"]);
  });
});

describe("noOverlapsScorer", () => {
  it("skips diagrams with fewer than two shapes to compare", async () => {
    expect(await run(noOverlapsScorer, [shape("a")])).toBeNull();
  });

  it("scores 1 minus the share of overlapping pairs", async () => {
    // Three shapes make three pairs; only a and b collide.
    const result = await run(noOverlapsScorer, [shape("a", 0, 0), shape("b", 50, 0), shape("c", 400, 0)]);
    expect(result?.score).toBeCloseTo(2 / 3);
    expect(result?.metadata.passed).toBe(false);
  });
});
