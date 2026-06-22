// BoundArrows scorer: checks that every arrow in the output has both
// startBinding and endBinding pointing at ids that exist in the canvas.
// Score = bound arrows / total arrows. Returns null if there are no arrows.

import type { EvalScorer } from "braintrust";
import type { AgentOutput } from "./schema";
import type { GoldenTestCase } from "../buildMessages";

export const boundArrowsScorer: EvalScorer<GoldenTestCase, AgentOutput, GoldenTestCase> = ({
  output,
}) => {
  const elements = (output.elements ?? []) as Record<string, unknown>[];

  const ids = new Set(
    elements.map((el) => (typeof el?.id === "string" ? el.id : null)).filter(Boolean) as string[]
  );

  const arrows = elements.filter((el) => el?.type === "arrow");
  if (arrows.length === 0) return null;

  let bound = 0;
  const broken: string[] = [];
  for (const arrow of arrows) {
    const start = arrow.startBinding as { elementId?: string } | null | undefined;
    const end = arrow.endBinding as { elementId?: string } | null | undefined;
    const ok = !!(
      start?.elementId &&
      end?.elementId &&
      ids.has(start.elementId) &&
      ids.has(end.elementId)
    );
    if (ok) bound += 1;
    else broken.push(typeof arrow.id === "string" ? arrow.id : "(no id)");
  }

  return {
    name: "BoundArrows",
    score: bound / arrows.length,
    metadata: { bound, total: arrows.length, broken },
  };
};
