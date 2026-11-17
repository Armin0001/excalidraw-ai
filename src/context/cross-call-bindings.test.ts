import { describe, expect, it } from "vitest";
import { applyCrossCallBindings, mergeBoundElements } from "./cross-call-bindings";

// The agent often draws shapes in one addElements call and the arrows between them in the next.
// Excalidraw's skeleton helper only resolves arrow ends within one batch, so these helpers bind
// the new arrows to shapes that are already on the canvas.

const canvas = [
  { id: "api", boundElements: null },
  { id: "db", boundElements: [{ id: "old-arrow", type: "arrow" }] },
];

describe("applyCrossCallBindings", () => {
  it("binds a new arrow to shapes drawn in an earlier call", () => {
    const skeletons = [{ type: "arrow", id: "a1", start: { id: "api" }, end: { id: "db" } }];
    const runtime: { id: string; startBinding?: unknown; endBinding?: unknown }[] = [{ id: "a1" }];

    const result = applyCrossCallBindings(skeletons, runtime, canvas);

    expect(runtime[0].startBinding).toEqual({ elementId: "api", focus: 0, gap: 8 });
    expect(runtime[0].endBinding).toEqual({ elementId: "db", focus: 0, gap: 8 });
    expect([...result.patchedTargetIds].sort()).toEqual(["api", "db"]);
    expect(result.arrowsByTargetId.get("db")).toEqual(["a1"]);
  });

  it("keeps bindings the skeleton helper already resolved within the same batch", () => {
    const resolved = { elementId: "cache", focus: 0.2, gap: 4 };
    const skeletons = [{ type: "arrow", id: "a1", start: { id: "api" }, end: { id: "cache" } }];
    const runtime = [{ id: "a1", endBinding: resolved }];

    applyCrossCallBindings(skeletons, runtime, canvas);

    expect(runtime[0].endBinding).toBe(resolved);
  });

  it("leaves ends alone when they point at nothing on the canvas", () => {
    const skeletons = [{ type: "arrow", id: "a1", start: { id: "ghost" }, end: { id: "db" } }];
    const runtime: { id: string; startBinding?: unknown; endBinding?: unknown }[] = [{ id: "a1" }];

    const result = applyCrossCallBindings(skeletons, runtime, canvas);

    expect(runtime[0].startBinding).toBeUndefined();
    expect([...result.patchedTargetIds]).toEqual(["db"]);
  });

  it("only touches arrows and lines that made it into the runtime batch", () => {
    const skeletons = [
      { type: "rectangle", id: "r1", start: { id: "api" } },
      { type: "arrow", id: "missing", start: { id: "api" } },
      { type: "line", id: "l1", start: { id: "api" } },
    ];
    const runtime: { id: string; startBinding?: unknown }[] = [{ id: "r1" }, { id: "l1" }];

    const result = applyCrossCallBindings(skeletons, runtime, canvas);

    expect(runtime[0].startBinding).toBeUndefined();
    expect(runtime[1].startBinding).toEqual({ elementId: "api", focus: 0, gap: 8 });
    expect(result.arrowsByTargetId.get("api")).toEqual(["l1"]);
  });
});

describe("mergeBoundElements", () => {
  it("adds the new arrows to a shape's boundElements without duplicates", () => {
    expect(mergeBoundElements(canvas[1], ["old-arrow", "a1", "a2"])).toEqual([
      { id: "old-arrow", type: "arrow" },
      { id: "a1", type: "arrow" },
      { id: "a2", type: "arrow" },
    ]);
  });

  it("starts a list for a shape that had no bound elements", () => {
    expect(mergeBoundElements(canvas[0], ["a1"])).toEqual([{ id: "a1", type: "arrow" }]);
  });
});
