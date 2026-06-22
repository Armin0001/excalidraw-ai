// NoOverlaps scorer: graded check that no eligible element pairs overlap.
// Score = 1 - (overlapping_pairs / total_eligible_pairs).
// Returns null if fewer than 2 eligible elements (nothing to check).

import type { EvalScorer } from "braintrust";
import type { AgentOutput } from "./schema";
import type { GoldenTestCase } from "../buildMessages";
import { findOverlaps, countOverlapEligiblePairs } from "../../src/context/overlaps";

export const noOverlapsScorer: EvalScorer<GoldenTestCase, AgentOutput, GoldenTestCase> = ({
  output,
}) => {
  const elements = (output.elements ?? []) as unknown[];
  const totalPairs = countOverlapEligiblePairs(elements);
  if (totalPairs === 0) return null;

  const overlapping = findOverlaps(elements);
  const score = 1 - overlapping.length / totalPairs;

  return {
    name: "NoOverlaps",
    score,
    metadata: {
      overlapping_pairs: overlapping,
      total_pairs: totalPairs,
      passed: overlapping.length === 0,
    },
  };
};
