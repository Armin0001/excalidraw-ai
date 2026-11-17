# Excalidraw AI — Diagram Agent

[![CI](https://github.com/Armin0001/excalidraw-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Armin0001/excalidraw-ai/actions/workflows/ci.yml)

A conversational diagramming agent built on Cloudflare Workers + Excalidraw. You describe a diagram in natural language and the agent draws it, modifies it, and self-corrects layout issues in real time.

Built as a hands-on project while completing the [AI Engineering Fundamentals](https://frontendmasters.com/courses/ai-engineering/) course on Frontend Masters. The course teaches the full AI engineering discipline: building agents, writing evals, measuring improvements, and shipping systems that actually get better over time.

---

![Demo](./assets/demo.gif)

<details>
<summary>📊 Eval results (Braintrust)</summary>

![Eval results](./assets/evals.png)

</details>

---

## What it does

- **Natural language → diagram**: "draw a sequence diagram for OAuth 2.0" produces a labeled, connected Excalidraw diagram
- **Canvas awareness**: the agent can query the live canvas and modify existing elements by id (`queryCanvas`, `updateElements`, `removeElements`)
- **Self-correcting layout**: every `addElements` call returns overlap pairs; the agent sees them and calls `updateElements` to fix collisions before finishing
- **Web search**: `searchWeb` (Tavily) pulls fresh information before drawing systems the model may not know well
- **RAG**: `searchKnowledge` queries a private Upstash Vector index of reference docs (OAuth flows, Kubernetes networking, PostgreSQL internals, etc.) for precise domain accuracy
- **Streaming chat UI**: tool call status, partial updates, and markdown responses rendered live

## Tech stack

| Layer | Tech |
|---|---|
| Agent runtime | Cloudflare Workers + Agents SDK (Durable Objects) |
| LLM | OpenAI via Vercel AI SDK |
| Frontend | React + Vite + Excalidraw |
| RAG / vector store | Upstash Vector |
| Web search | Tavily |
| Evals | Braintrust |

## Evals

The project includes a full eval suite (`evals/`) that runs against a 30-case golden dataset covering create, modify, and domain-knowledge tasks. Scorers measure:

- **Schema** — do all elements have required fields?
- **Structure** — do element counts match what the prompt asked for?
- **BoundLabels** — does every shape have a `containerId` text label?
- **BoundArrows** — do all arrows bind both endpoints to real ids?
- **Connectivity** — are the shapes in a connected graph when the prompt implies flow?
- **NoOverlaps** — do any element bounding boxes collide?
- **ToolChoice** — did the agent call the right tools in the right order?
- **LabelKeyword** — do label texts match expected keywords?

```bash
npm run eval   # runs all scorers, results appear in Braintrust dashboard
```

## Key decisions

- **One overlap detector for both the agent and the eval.** Every `addElements` call returns the overlapping element pairs, so the agent can fix its own layout before it answers, and the NoOverlaps scorer measures layout with the same function ([`src/context/overlaps.ts`](src/context/overlaps.ts)). If the two disagreed, the agent would "fix" what the loop reported while the eval still flagged it.
- **Overlap rules that match what looks wrong to a person.** Arrows and lines are skipped (they cross shapes on purpose), a label inside its own shape is skipped, but labels sitting on arrows are checked, and 4px of overlap is allowed so shapes placed edge to edge don't count.
- **Arrows can connect to shapes drawn in an earlier call.** Excalidraw's skeleton converter only resolves arrow ends within one batch, so [`cross-call-bindings.ts`](src/context/cross-call-bindings.ts) patches the bindings afterwards. That keeps the system prompt's promise that arrows may reference shapes "already on the canvas".
- **Deterministic, graded scorers.** Most scorers return a fraction (for example, the share of arrows bound at both ends) instead of pass/fail, so a change that fixes one arrow out of ten still shows up, and they return `null` when a check doesn't apply, so unrelated cases don't skew the averages.
- **Retrieval for precision, web search for freshness.** A private Upstash Vector index of reference docs keeps domain diagrams (OAuth, Kubernetes networking, Postgres internals) accurate; Tavily covers systems newer than the model.

## Tests

The deterministic parts have 24 unit tests ([Vitest](https://vitest.dev)), separate from the LLM evals:

```bash
npm test
```

- [`src/context/overlaps.test.ts`](src/context/overlaps.test.ts): overlap detection, one test per carve-out (arrows, container labels, arrow labels, the 4px tolerance) plus pair counting.
- [`src/context/cross-call-bindings.test.ts`](src/context/cross-call-bindings.test.ts): binding new arrows to existing shapes, keeping bindings that were already resolved, and merging `boundElements` without duplicates.
- [`evals/scorers/scorers.test.ts`](evals/scorers/scorers.test.ts): the Connectivity, BoundArrows, BoundLabels and NoOverlaps scorers on small hand-built diagrams, because an eval is only as trustworthy as its scorers.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs these tests and a production build of the Worker and the client on every push and pull request. The LLM evals need API keys, so they run on demand with `npm run eval`.

A hosted demo would need the OpenAI, Tavily and Upstash keys behind it, so the demo is the recording at the top of this page.

## Setup

### 1. Install

```bash
git clone https://github.com/Armin0001/excalidraw-ai
cd excalidraw-ai
npm install
```

### 2. Environment variables

Create `.dev.vars` at the project root (see `.dev.vars.example`):

```
OPENAI_API_KEY=sk-...
UPSTASH_VECTOR_REST_URL=https://...upstash.io
UPSTASH_VECTOR_REST_TOKEN=...
BRAINTRUST_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

| Key | Where to get it |
|---|---|
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) → API keys |
| `UPSTASH_VECTOR_REST_URL` + `TOKEN` | [upstash.com](https://upstash.com) → Vector → Create Index (pick any hosted embedding model) |
| `BRAINTRUST_API_KEY` | [braintrust.dev](https://braintrust.dev) → Settings |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) → Dashboard |

### 3. Seed the vector index

```bash
npm run embed   # reads data/corpus/*.md and upserts into Upstash
```

### 4. Run

```bash
npm run dev     # starts at http://localhost:5173
npm run eval    # runs the eval suite against Braintrust
npm test        # unit tests (no API keys needed)
```

## Project structure

```
src/
  agent-core.ts          # shared agent logic (system prompt, tools, eval harness)
  agent.ts               # Cloudflare Worker entry point
  App.tsx                # React app, onToolCall handlers
  tools/                 # one file per tool
    add-elements.ts
    query-canvas.ts
    update-elements.ts
    remove-elements.ts
    search-web.ts
    search-knowledge.ts
    element-schema.ts
  context/
    canvas-state.ts      # serialize live canvas to text for the agent
    overlaps.ts          # AABB overlap detection (shared by agent + eval scorer)
    applySkeleton.ts     # Node-side simulator of convertToExcalidrawElements
    cross-call-bindings.ts
  rag/
    vector-store.ts      # Upstash Vector client
    embed.ts             # one-shot corpus ingestion script

evals/
  diagram.eval.ts        # Braintrust eval definition
  buildMessages.ts       # converts golden test cases to ModelMessage[]
  datasets/
    golden_2.json        # 30-case golden dataset
  scorers/               # one file per scorer

data/
  corpus/                # RAG reference documents (Markdown)
```

## License

[MIT](LICENSE)
