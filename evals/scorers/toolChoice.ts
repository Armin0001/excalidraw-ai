// ToolChoice scorer: did the agent reach for the right tool given the test
// case category?
//   create/domain: addElements must have been called
//   modify: queryCanvas must come before updateElements/removeElements
//   edge: returns null (skipped)

import type { EvalScorer } from "braintrust";
import type { AgentOutput } from "./schema";
import type { GoldenTestCase } from "../buildMessages";

export const toolChoiceScorer: EvalScorer<GoldenTestCase, AgentOutput, GoldenTestCase> = ({
  output,
  expected,
}) => {
  const calls = output.toolCalls ?? [];
  const category = expected?.category;

  if (category === "create" || category === "domain") {
    const ok = calls.includes("addElements");
    return {
      name: "ToolChoice",
      score: ok ? 1 : 0,
      metadata: { category, calls, reason: ok ? "addElements called" : "addElements not called" },
    };
  }

  if (category === "modify") {
    const queryAt = calls.indexOf("queryCanvas");
    const firstMutator = calls.findIndex(
      (name) => name === "updateElements" || name === "removeElements"
    );
    if (firstMutator < 0) {
      return {
        name: "ToolChoice",
        score: 0,
        metadata: { category, calls, reason: "no updateElements or removeElements call" },
      };
    }
    if (queryAt < 0 || queryAt > firstMutator) {
      return {
        name: "ToolChoice",
        score: 0.5,
        metadata: { category, calls, reason: "mutated without querying canvas first" },
      };
    }
    return {
      name: "ToolChoice",
      score: 1,
      metadata: { category, calls, reason: "queried then mutated" },
    };
  }

  return null;
};
