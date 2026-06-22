// Connectivity scorer: for prompts implying connected structure, build a graph
// from bound arrows and check what fraction of shapes are reachable from the
// first shape. Score = reachable / total. Returns null if prompt has no
// connectivity hints or fewer than 2 shapes.

import type { EvalScorer } from "braintrust";
import type { AgentOutput } from "./schema";
import type { GoldenTestCase } from "../buildMessages";

const CONNECTED_HINTS = ["flow", "sequence", "between", "from", "to ", "pipeline", "chain", "process"];

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

export const connectivityScorer: EvalScorer<GoldenTestCase, AgentOutput, GoldenTestCase> = ({
  output,
  input,
}) => {
  const prompt = (input?.input ?? "").toLowerCase();
  if (!CONNECTED_HINTS.some((h) => prompt.includes(h))) return null;

  const elements = (output.elements ?? []) as Record<string, unknown>[];
  const shapes = elements.filter(
    (el) => typeof el?.type === "string" && SHAPE_TYPES.has(el.type as string)
  );
  if (shapes.length < 2) return null;

  const adj = new Map<string, Set<string>>();
  for (const shape of shapes) {
    if (typeof shape.id === "string") adj.set(shape.id, new Set());
  }

  for (const el of elements) {
    if (el?.type !== "arrow") continue;
    const start = (el.startBinding as { elementId?: string } | null | undefined)?.elementId;
    const end = (el.endBinding as { elementId?: string } | null | undefined)?.elementId;
    if (!start || !end) continue;
    if (adj.has(start) && adj.has(end)) {
      adj.get(start)!.add(end);
      adj.get(end)!.add(start);
    }
  }

  const start = shapes[0]!.id as string;
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return {
    name: "Connectivity",
    score: seen.size / shapes.length,
    metadata: { reachable: seen.size, total: shapes.length },
  };
};
